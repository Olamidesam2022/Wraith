import { calculateRiskReport } from '../scoring';
import { scoringConfig } from '../config';
import type { FileHistory, RepoSnapshot } from '../types';

const scannedAt = '2026-11-19T12:00:00.000Z';
const now = Date.parse(scannedAt);
const dayMs = scoringConfig.millisecondsPerDay;
const atDaysAgo = (days: number) => new Date(now - days * dayMs).toISOString();

const roomNames = [
  'src/core', 'src/auth', 'src/data', 'src/api', 'src/jobs',
  'src/ui', 'src/editor', 'src/testing', 'src/docs', 'src/examples',
];
const fileNames = ['index.ts', 'service.ts', 'worker.ts', 'types.ts'];
const filePaths = roomNames.flatMap((room) => fileNames.map((name) => `${room}/${name}`));

const ghosts: Record<string, { staleDays: number; departedCommits: number }> = {
  'src/core/index.ts': { staleDays: 730, departedCommits: 10 },
  'src/core/service.ts': { staleDays: 584, departedCommits: 10 },
  'src/core/worker.ts': { staleDays: 146, departedCommits: 8 },
  'src/auth/index.ts': { staleDays: 292, departedCommits: 5 },
  'src/data/index.ts': { staleDays: 300, departedCommits: 9 },
};

const cobwebs: Record<string, number> = {
  'src/jobs/index.ts': 600,
  'src/jobs/service.ts': 520,
  'src/ui/view.ts': 600,
  'src/editor/editor.ts': 730,
  'src/docs/readme.ts': 600,
  'src/examples/sample.ts': 520,
};

const poltergeists: Record<string, number> = {
  'src/auth/worker.ts': 14,
  'src/api/worker.ts': 10,
};

function makeHistory(path: string): FileHistory {
  const ghost = ghosts[path];
  const fixCount = poltergeists[path];
  if (ghost) {
    const activeCommits = 10 - ghost.departedCommits;
    const authors = [
      { login: 'former-contributor', commitCount: ghost.departedCommits, lastActivityAt: atDaysAgo(600) },
      ...(activeCommits > 0 ? [{ login: 'active-maintainer', commitCount: activeCommits, lastActivityAt: scannedAt }] : []),
    ];
    return {
      commitCount: 10,
      lastTouchedAt: atDaysAgo(ghost.staleDays),
      authors,
      commitsLast180Days: 0,
      fixOrRevertCommitsLast180Days: 0,
      historyIsPartial: false,
    };
  }

  const staleDays = cobwebs[path];
  if (staleDays !== undefined) {
    return {
      commitCount: 8,
      lastTouchedAt: atDaysAgo(staleDays),
      authors: [{ login: 'active-maintainer', commitCount: 8, lastActivityAt: scannedAt }],
      commitsLast180Days: 0,
      fixOrRevertCommitsLast180Days: 0,
      historyIsPartial: false,
    };
  }

  if (fixCount !== undefined) {
    return {
      commitCount: 30,
      lastTouchedAt: scannedAt,
      authors: [{ login: 'active-maintainer', commitCount: 30, lastActivityAt: scannedAt }],
      commitsLast180Days: 20,
      fixOrRevertCommitsLast180Days: fixCount,
      historyIsPartial: false,
    };
  }

  return {
    commitCount: 10,
    lastTouchedAt: scannedAt,
    authors: [{ login: 'active-maintainer', commitCount: 10, lastActivityAt: scannedAt }],
    commitsLast180Days: 5,
    fixOrRevertCommitsLast180Days: 0,
    historyIsPartial: false,
  };
}

export const housePreviewSnapshot: RepoSnapshot = {
  repoName: 'wraith/house-preview',
  defaultBranch: 'main',
  scannedAt,
  files: filePaths.map((path) => ({ path, language: 'TypeScript', size: 2_048 })),
  historyByPath: Object.fromEntries(filePaths.map((path) => [path, makeHistory(path)])),
  importGraph: [
    { importer: 'src/core/service.ts', imported: 'src/core/index.ts' },
    { importer: 'src/core/worker.ts', imported: 'src/core/service.ts' },
    { importer: 'src/core/types.ts', imported: 'src/core/worker.ts' },
    { importer: 'src/auth/service.ts', imported: 'src/auth/index.ts' },
    { importer: 'src/api/index.ts', imported: 'src/data/index.ts' },
  ],
  scan: {
    fileLimit: 400,
    scannedFileCount: filePaths.length,
    skippedFileCount: 0,
    skippedLanguages: [],
    dependencyLanguages: ['JavaScript', 'TypeScript', 'Python'],
    languagesWithoutDependencyData: [],
    filesWithoutDependencyData: [],
    anonymous: false,
    historyIsPartial: false,
    treeIsPartial: false,
  },
};

// Fixture scores are always produced by the production scoring implementation.
export const housePreviewReport = calculateRiskReport(housePreviewSnapshot, now);
