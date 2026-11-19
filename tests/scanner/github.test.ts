import { describe, expect, it, vi } from 'vitest';
import { githubGraphql, scanGithubRepository, type GraphqlTransport } from '../../src/scanner/github';
import { POST } from '../../src/app/api/scan/route';
import type { RepoSnapshot } from '../../src/types';

function repositoryTransport(options: { files?: number; missing?: boolean; empty?: boolean; failHistory?: boolean; author?: boolean } = {}): GraphqlTransport {
  const fileCount = options.files ?? 1;
  return vi.fn(async (query: string) => {
    if (query.includes('nameWithOwner')) {
      return { data: { repository: options.missing ? null : { nameWithOwner: 'owner/repo', defaultBranchRef: options.empty ? null : { name: 'main' } } } };
    }
    if (query.includes('d0: object')) {
      const entries = Array.from({ length: fileCount }, (_, i) => ({ name: `file-${i}.ts`, type: 'blob', oid: `oid-${i}`, object: { byteSize: 10 } }));
      return { data: { repository: { d0: { entries } } } };
    }
    if (query.includes('messageHeadline')) {
      if (options.failHistory) return { data: { repository: { ref: { target: {} } } }, errors: [{ message: 'partial field failure' }] };
      const aliases = [...query.matchAll(/([hr]\d+): history/g)].map((match) => match[1]);
      const nodes = options.author ? [{ committedDate: new Date().toISOString(), messageHeadline: 'fix: sample', author: { name: 'Maker', email: 'private@example.invalid', user: { id: 'user-node-id', login: 'maker' } } }] : [];
      return { data: { repository: { ref: { target: Object.fromEntries(aliases.map((alias) => [alias, { totalCount: nodes.length, nodes }])) } } } };
    }
    if (query.includes('author:')) {
      return {
        data: {
          repository: {
            ref: {
              target: {
                a0: { nodes: [{ committedDate: '2026-10-01T00:00:00Z' }] },
              },
            },
          },
        },
      };
    }
    if (query.includes('history(first:')) return { data: { repository: { ref: { target: { history: { nodes: [] } } } } } };
    if (query.includes('node(id:')) {
      const aliases = [...query.matchAll(/(f\d+): node/g)].map((match) => match[1]);
      return { data: Object.fromEntries(aliases.map((alias) => [alias, { text: 'export const value = 1;' }])) };
    }
    return { data: {} };
  }) as GraphqlTransport;
}

describe('GitHub GraphQL scanner', () => {
  it('maps API rate limits to a safe, stable error code', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ errors: [{ type: 'RATE_LIMITED' }] }), { status: 200 }));
    await expect(githubGraphql('query {}', 'test-only-value', fetcher as typeof fetch)).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  });

  it('maps a missing or private repository to repo-not-found', async () => {
    await expect(scanGithubRepository('https://github.com/owner/repo', 'test-only-value', repositoryTransport({ missing: true })))
      .rejects.toMatchObject({ code: 'REPO_NOT_FOUND' });
  });

  it('returns a valid zero-file snapshot for an empty repository', async () => {
    const snapshot = await scanGithubRepository('https://github.com/owner/repo', 'test-only-value', repositoryTransport({ empty: true }));
    expect(snapshot.files).toEqual([]);
    expect(snapshot.importGraph).toEqual([]);
    expect(snapshot.repoName).toBe('owner/repo');
  });

  it('caps a very large anonymous repository and reports skipped files honestly', async () => {
    const snapshot = await scanGithubRepository('https://github.com/owner/repo', '', repositoryTransport({ files: 80 }));
    expect(snapshot.files).toHaveLength(50);
    expect(snapshot.scan.skippedFileCount).toBe(30);
    expect(snapshot.scan.fileLimit).toBe(50);
  });

  it('keeps partial history failures in the snapshot instead of aborting the scan', async () => {
    const snapshot = await scanGithubRepository('https://github.com/owner/repo', 'test-only-value', repositoryTransport({ failHistory: true }));
    expect(snapshot.scan.historyIsPartial).toBe(true);
    expect(snapshot.files).toHaveLength(1);
  });

  it('batches author activity lookups and counts recent fix commits', async () => {
    const transport = repositoryTransport({ author: true });
    const snapshot = await scanGithubRepository('https://github.com/owner/repo', 'test-only-value', transport);
    const author = snapshot.historyByPath['file-0.ts'].authors[0];
    expect(author).toMatchObject({ login: 'maker', commitCount: 1, lastActivityAt: '2026-10-01T00:00:00Z' });
    expect(snapshot.historyByPath['file-0.ts'].fixOrRevertCommitsLast180Days).toBe(1);
    expect(JSON.stringify(snapshot)).not.toContain('private@example.invalid');
    expect(vi.mocked(transport).mock.calls.some(([query]) => query.includes('author: { id: "user-node-id" }'))).toBe(true);
  });

  it('does not expose or retain a visitor token in the returned snapshot', async () => {
    const token = 'test-only-value-never-a-real-secret';
    const transport = repositoryTransport({ empty: true });
    const snapshot: RepoSnapshot = await scanGithubRepository('https://github.com/owner/repo', token, transport);
    expect(JSON.stringify(snapshot)).not.toContain(token);
    expect(Object.keys(sessionStorage)).toHaveLength(0);
    expect(Object.keys(localStorage)).toHaveLength(0);
  });

  it('forwards a visitor token only to GitHub and never logs or returns it', async () => {
    const token = 'test-only-value-never-a-real-secret';
    const fetcher = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      data: { repository: { nameWithOwner: 'owner/repo', defaultBranchRef: null } },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const logSpy = vi.spyOn(console, 'log');
    const errorSpy = vi.spyOn(console, 'error');
    vi.stubGlobal('fetch', fetcher);
    try {
      const request = new Request('http://localhost/api/scan', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': '198.51.100.71' },
        body: JSON.stringify({ repoUrl: 'https://github.com/owner/repo', token }),
      });
      const response = await POST(request as never);
      const responseText = await response.text();
      expect(response.status).toBe(200);
      expect(responseText).not.toContain(token);
      expect(fetcher).toHaveBeenCalledTimes(1);
      const init = fetcher.mock.calls[0][1];
      expect(new Headers(init?.headers).get('authorization')).toBe(`bearer ${token}`);
      expect(String(init?.body)).not.toContain(token);
      expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining(token));
      expect(errorSpy).not.toHaveBeenCalledWith(expect.stringContaining(token));
      expect(Object.keys(sessionStorage)).toHaveLength(0);
      expect(Object.keys(localStorage)).toHaveLength(0);
    } finally {
      vi.unstubAllGlobals();
      logSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });
});
