import { scanConfig, scoringConfig } from '../config';
import { buildSnapshot } from './snapshot';
import { chooseScanLimit, selectFiles } from './selection';
import type { AuthorHistory, FileHistory, RepoFile, RepoSnapshot } from '../types';

export type GraphqlCode = 'RATE_LIMITED' | 'REPO_NOT_FOUND' | 'GITHUB_ERROR';
export class GithubScanError extends Error {
  constructor(readonly code: GraphqlCode) { super(code); }
}

interface GraphqlEnvelope<T> { data?: T | null; errors?: Array<{ message?: string; type?: string; extensions?: { code?: string } }> }
export type GraphqlTransport = (query: string, token: string) => Promise<GraphqlEnvelope<Record<string, unknown>>>;

export async function githubGraphql(query: string, token: string, fetcher: typeof fetch = fetch): Promise<GraphqlEnvelope<Record<string, unknown>>> {
  const response = await fetcher('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/vnd.github+json' },
    body: JSON.stringify({ query }),
    cache: 'no-store',
  });
  let envelope: GraphqlEnvelope<Record<string, unknown>>;
  try { envelope = await response.json() as GraphqlEnvelope<Record<string, unknown>>; }
  catch { throw new GithubScanError(response.status === 429 || response.status === 403 ? 'RATE_LIMITED' : 'GITHUB_ERROR'); }
  if (response.status === 429 || response.status === 403 || envelope.errors?.some((error) => error.extensions?.code === 'RATE_LIMITED' || error.type === 'RATE_LIMITED')) {
    throw new GithubScanError('RATE_LIMITED');
  }
  if (!response.ok && !envelope.data) throw new GithubScanError('GITHUB_ERROR');
  if (!envelope.data && envelope.errors?.length) throw new GithubScanError('GITHUB_ERROR');
  return envelope;
}

interface TreeEntry { name: string; type: 'blob' | 'tree'; oid: string; object?: { byteSize?: number | null } | null }
interface InternalFile extends RepoFile { oid: string; lastTouchedAt?: string | null; dependentCount?: number }
const languageByExtension: Record<string, string> = {
  ts: 'TypeScript', tsx: 'TypeScript', mts: 'TypeScript', cts: 'TypeScript',
  js: 'JavaScript', jsx: 'JavaScript', mjs: 'JavaScript', cjs: 'JavaScript',
  py: 'Python',
  go: 'Go', rs: 'Rust', java: 'Java', rb: 'Ruby', php: 'PHP', cs: 'C#',
  c: 'C', h: 'C', cpp: 'C++', hpp: 'C++', swift: 'Swift', kt: 'Kotlin',
};
function languageFor(path: string): string | null { return languageByExtension[path.split('.').pop()?.toLowerCase() ?? ''] ?? null; }
function gqlString(value: string): string { return JSON.stringify(value); }

function repoLocation(input: string): { owner: string; repo: string } {
  let url: URL;
  try { url = new URL(input); } catch { throw new GithubScanError('REPO_NOT_FOUND'); }
  const parts = url.pathname.split('/').filter(Boolean);
  if (url.hostname !== 'github.com' || parts.length < 2) throw new GithubScanError('REPO_NOT_FOUND');
  return { owner: parts[0], repo: parts[1].replace(/\.git$/, '') };
}

function ensureData<T>(envelope: GraphqlEnvelope<Record<string, unknown>>, select: (data: Record<string, unknown>) => T | null): T {
  if (!envelope.data) throw new GithubScanError('GITHUB_ERROR');
  const value = select(envelope.data);
  if (value === null) throw new GithubScanError('REPO_NOT_FOUND');
  return value;
}

async function fetchTree(
  owner: string, repo: string, branch: string, token: string, transport: GraphqlTransport,
): Promise<{ files: InternalFile[]; partial: boolean }> {
  const directories = [''];
  const files: InternalFile[] = [];
  let visitedEntries = 0;
  let partial = false;
  while (directories.length && visitedEntries < scanConfig.maxTreeEntries) {
    const batch = directories.splice(0, scanConfig.graphQlBatchSize);
    const fields = batch.map((directory, index) => `d${index}: object(expression: ${gqlString(`${branch}:${directory}`)}) { ... on Tree { entries { name type oid object { ... on Blob { byteSize } } } } }`).join('\n');
    const query = `query { repository(owner: ${gqlString(owner)}, name: ${gqlString(repo)}) { ${fields} } }`;
    let data: Record<string, unknown>;
    try { data = ensureData(await transport(query, token), (raw) => raw.repository as Record<string, unknown> | null); }
    catch (error) {
      if (error instanceof GithubScanError && error.code !== 'GITHUB_ERROR') throw error;
      partial = true;
      continue;
    }
    for (let index = 0; index < batch.length; index += 1) {
      const result = data[`d${index}`] as { entries?: TreeEntry[] } | null;
      if (!result?.entries) { partial = true; continue; }
      for (const entry of result.entries) {
        visitedEntries += 1;
        const path = batch[index] ? `${batch[index]}/${entry.name}` : entry.name;
        if (entry.type === 'tree') directories.push(path);
        else if (entry.type === 'blob') files.push({ path, language: languageFor(path), size: entry.object?.byteSize ?? 0, oid: entry.oid });
        if (visitedEntries >= scanConfig.maxTreeEntries) { partial = true; break; }
      }
    }
  }
  if (directories.length) partial = true;
  return { files, partial };
}

async function fetchContents(files: readonly InternalFile[], token: string, transport: GraphqlTransport): Promise<Record<string, string>> {
  const sources: Record<string, string> = {};
  const supported = files.filter((file) => file.language === 'JavaScript' || file.language === 'TypeScript' || file.language === 'Python');
  for (let offset = 0; offset < supported.length; offset += scanConfig.graphQlBatchSize) {
    const batch = supported.slice(offset, offset + scanConfig.graphQlBatchSize);
    const fields = batch.map((file, index) => `f${index}: node(id: ${gqlString(file.oid)}) { ... on Blob { text } }`).join('\n');
    try {
      const repository = ensureData(await transport(`query { ${fields} }`, token), (data) => data);
      batch.forEach((file, index) => {
        const text = (repository[`f${index}`] as { text?: string | null } | null)?.text;
        if (typeof text === 'string') sources[file.path] = text;
      });
    } catch { /* Missing or oversized blobs do not invalidate repository history. */ }
  }
  return sources;
}

interface CommitNode {
  committedDate: string;
  messageHeadline?: string;
  author?: { email?: string | null; name?: string | null; user?: { id?: string | null; login?: string | null } | null } | null;
}
interface HistoryResult { totalCount: number; nodes: CommitNode[] }
interface AuthorFilter { userId?: string; email?: string }
function historyFromResult(result: HistoryResult | null | undefined, recentResult: HistoryResult | null | undefined, filters: Map<string, AuthorFilter>): FileHistory {
  const commits = result?.nodes ?? [];
  const byAuthor = new Map<string, number>();
  for (const commit of commits) {
    const login = commit.author?.user?.login ?? commit.author?.name ?? 'Unknown author';
    byAuthor.set(login, (byAuthor.get(login) ?? 0) + 1);
    const userId = commit.author?.user?.id;
    const email = commit.author?.email;
    if (userId) filters.set(login, { userId });
    else if (email) filters.set(login, { email });
  }
  const authors: AuthorHistory[] = [...byAuthor].map(([login, commitCount]) => ({ login, commitCount, lastActivityAt: null })).sort((a, b) => a.login.localeCompare(b.login));
  const recentCommits = recentResult?.nodes ?? [];
  const fixes = recentCommits.filter((commit) => scoringConfig.fixMessagePattern.test(commit.messageHeadline ?? '')).length;
  return {
    commitCount: result?.totalCount ?? commits.length,
    lastTouchedAt: commits[0]?.committedDate ?? null,
    authors,
    commitsLast180Days: recentResult?.totalCount ?? recentCommits.length,
    fixOrRevertCommitsLast180Days: fixes,
    historyIsPartial: (result?.totalCount ?? commits.length) > commits.length
      || (recentResult?.totalCount ?? recentCommits.length) > recentCommits.length
      || !recentResult
      || commits.some((commit) => !commit.author?.user?.id && !commit.author?.email),
  };
}

async function fetchHistory(
  files: readonly InternalFile[], owner: string, repo: string, branch: string, token: string, transport: GraphqlTransport,
): Promise<Record<string, FileHistory>> {
  const authorFilters = new Map<string, AuthorFilter>();
  const histories: Record<string, FileHistory> = {};
  for (let offset = 0; offset < files.length; offset += scanConfig.graphQlBatchSize) {
    const batch = files.slice(offset, offset + scanConfig.graphQlBatchSize);
    const since = new Date(Date.now() - scoringConfig.fixWindowDays * scoringConfig.millisecondsPerDay).toISOString();
    const fields = batch.flatMap((file, index) => [
      `h${index}: history(first: ${scanConfig.graphQlHistoryPageSize}, path: ${gqlString(file.path)}) { totalCount nodes { committedDate messageHeadline author { name email user { id login } } } }`,
      `r${index}: history(first: ${scanConfig.graphQlHistoryPageSize}, path: ${gqlString(file.path)}, since: ${gqlString(since)}) { totalCount nodes { committedDate messageHeadline } }`,
    ]).join('\n');
    const query = `query { repository(owner: ${gqlString(owner)}, name: ${gqlString(repo)}) { ref(qualifiedName: ${gqlString(`refs/heads/${branch}`)}) { target { ... on Commit { ${fields} } } } } }`;
    try {
      const envelope = await transport(query, token);
      const repository = ensureData(envelope, (data) => data.repository as Record<string, unknown> | null);
      const target = (repository.ref as { target?: Record<string, unknown> } | null)?.target;
      batch.forEach((file, index) => {
        const result = target?.[`h${index}`] as HistoryResult | null | undefined;
        const recentResult = target?.[`r${index}`] as HistoryResult | null | undefined;
        histories[file.path] = historyFromResult(result, recentResult, authorFilters);
        if (!result || !recentResult || envelope.errors?.length) histories[file.path].historyIsPartial = true;
      });
    } catch {
      batch.forEach((file) => { histories[file.path] = historyFromResult(null, null, authorFilters); histories[file.path].historyIsPartial = true; });
    }
  }

  const activity = new Map<string, string>();
  const filters = [...authorFilters];
  for (let offset = 0; offset < filters.length; offset += scanConfig.graphQlBatchSize) {
    const batch = filters.slice(offset, offset + scanConfig.graphQlBatchSize);
    const fields = batch.map(([login, filter], index) => {
      const author = filter.userId ? `{ id: ${gqlString(filter.userId)} }` : `{ emails: [${gqlString(filter.email ?? '')}] }`;
      return `a${index}: history(first: 1, author: ${author}) { nodes { committedDate } }`;
    }).join('\n');
    const query = `query { repository(owner: ${gqlString(owner)}, name: ${gqlString(repo)}) { ref(qualifiedName: ${gqlString(`refs/heads/${branch}`)}) { target { ... on Commit { ${fields} } } } } }`;
    try {
      const repository = ensureData(await transport(query, token), (data) => data.repository as Record<string, unknown> | null);
      const target = (repository.ref as { target?: Record<string, unknown> } | null)?.target;
      batch.forEach(([login], index) => {
        const result = target?.[`a${index}`] as { nodes?: Array<{ committedDate: string }> } | null;
        const lastActivityAt = result?.nodes?.[0]?.committedDate;
        if (lastActivityAt) activity.set(login, lastActivityAt);
        else if (result === undefined) for (const history of Object.values(histories)) history.historyIsPartial = true;
      });
    } catch { for (const history of Object.values(histories)) history.historyIsPartial = true; }
  }
  for (const history of Object.values(histories)) {
    history.authors = history.authors.map((author) => ({ ...author, lastActivityAt: activity.get(author.login) ?? null }));
  }
  return histories;
}

export async function scanGithubRepository(repoUrl: string, token: string, transport: GraphqlTransport = githubGraphql, visitorHasToken = Boolean(token)): Promise<RepoSnapshot> {
  const { owner, repo } = repoLocation(repoUrl);
  const repoQuery = `query { repository(owner: ${gqlString(owner)}, name: ${gqlString(repo)}) { nameWithOwner defaultBranchRef { name } } }`;
  const repoData = ensureData(await transport(repoQuery, token), (data) => data.repository as Record<string, unknown> | null);
  const branch = (repoData.defaultBranchRef as { name?: string } | null)?.name;
  if (!branch) {
    return buildSnapshot({
      repoName: repoData.nameWithOwner as string,
      defaultBranch: '', files: [], sourceByPath: {}, historyByPath: {},
      skippedFileCount: 0, fileLimit: chooseScanLimit(visitorHasToken), anonymous: !visitorHasToken,
      scannedAt: new Date().toISOString(), treeIsPartial: false,
    });
  }

  const tree = await fetchTree(owner, repo, branch, token, transport);
  const limit = chooseScanLimit(visitorHasToken);
  const selected = selectFiles(tree.files, limit);
  const selectedInternal = selected.selected;
  const selectedWithoutScores = selectedInternal.map(({ oid: _oid, ...file }) => file);
  const [historyByPath, sourceByPath] = await Promise.all([
    fetchHistory(selectedInternal, owner, repo, branch, token, transport),
    fetchContents(selectedInternal, token, transport),
  ]);
  const historyPartial = Object.values(historyByPath).some((history) => history.historyIsPartial);
  const snapshot = buildSnapshot({
    repoName: repoData.nameWithOwner as string,
    defaultBranch: branch,
    files: selectedWithoutScores,
    allRepositoryFiles: tree.files.map(({ oid: _oid, ...file }) => file),
    sourceByPath,
    historyByPath,
    skippedFileCount: selected.skippedCount,
    fileLimit: limit,
    anonymous: !visitorHasToken,
    treeIsPartial: tree.partial,
    scannedAt: new Date().toISOString(),
  });
  snapshot.scan.historyIsPartial = historyPartial;
  return snapshot;
}
