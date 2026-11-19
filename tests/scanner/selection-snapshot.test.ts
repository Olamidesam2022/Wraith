import { describe, expect, it } from 'vitest';
import { selectFiles } from '../../src/scanner/selection';
import { buildSnapshot } from '../../src/scanner/snapshot';
import type { FileHistory, RepoFile } from '../../src/types';

describe('scan selection and snapshot building', () => {
  it('prefers highly depended-on and recently touched files, then uses stable path order', () => {
    const files = [
      { path: 'z.ts', language: 'TypeScript', size: 1 },
      { path: 'b.ts', language: 'TypeScript', size: 1, dependentCount: 4 },
      { path: 'a.ts', language: 'TypeScript', size: 1, lastTouchedAt: '2026-01-01T00:00:00Z' },
      { path: 'c.ts', language: 'TypeScript', size: 1, lastTouchedAt: '2026-01-01T00:00:00Z' },
    ];
    const selected = selectFiles(files, 3);
    expect(selected.selected.map(({ path }) => path)).toEqual(['b.ts', 'a.ts', 'c.ts']);
    expect(selected.skippedCount).toBe(1);
  });

  it('reports skipped files and languages without dependency parsing', () => {
    const files: RepoFile[] = [
      { path: 'src/main.ts', language: 'TypeScript', size: 10 },
      { path: 'pkg/main.go', language: 'Go', size: 10 },
    ];
    const history: FileHistory = { commitCount: 1, lastTouchedAt: null, authors: [], commitsLast180Days: 0, fixOrRevertCommitsLast180Days: 0, historyIsPartial: false };
    const snapshot = buildSnapshot({
      repoName: 'owner/repo', defaultBranch: 'main', files, sourceByPath: {},
      historyByPath: { 'src/main.ts': history }, skippedFileCount: 6, fileLimit: 10, anonymous: true,
      scannedAt: '2026-01-01T00:00:00Z',
    });
    expect(snapshot.scan.skippedFileCount).toBe(6);
    expect(snapshot.scan.skippedLanguages).toEqual(['Go']);
    expect(snapshot.scan.dependencyLanguages).toEqual(['JavaScript', 'TypeScript', 'Python']);
    expect(snapshot.scan.languagesWithoutDependencyData).toEqual(['Go', 'TypeScript']);
    expect(snapshot.scan.filesWithoutDependencyData).toEqual(['src/main.ts']);
    expect(snapshot.scan.scannedFileCount).toBe(2);
  });
});
