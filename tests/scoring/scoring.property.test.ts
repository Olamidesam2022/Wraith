import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { scoringConfig } from '../../src/config';
import { calculateRiskReport, calculateRoomHealth, rankFindings, scoreFile } from '../../src/scoring';
import type { FileHistory, Finding, RepoSnapshot, RiskKind } from '../../src/types';

const NOW = Date.parse('2026-11-19T12:00:00.000Z');
const dayMs = scoringConfig.millisecondsPerDay;
const daysAgo = (days: number) => new Date(NOW - days * dayMs).toISOString();
const nonNegative = fc.integer({ min: 0, max: 2_000 });
const dayCount = fc.integer({ min: 0, max: 1_500 });

const historyArbitrary: fc.Arbitrary<FileHistory> = fc.record({
  commitCount: fc.integer({ min: 1, max: 2_000 }),
  staleDays: dayCount,
  departedSharePercent: fc.integer({ min: 0, max: 100 }),
  departedActivityDays: fc.integer({ min: scoringConfig.orphanActivityDays, max: 1_500 }),
  activeActivityDays: fc.integer({ min: 0, max: scoringConfig.orphanActivityDays - 1 }),
  commitsLast180Days: fc.integer({ min: 0, max: 200 }),
  fixCandidate: fc.integer({ min: 0, max: 200 }),
}).map((input) => {
  const departedCount = Math.floor(input.commitCount * input.departedSharePercent / scoringConfig.scoreScale);
  const activeCount = input.commitCount - departedCount;
  const authors = [
    { login: 'departed-author', commitCount: departedCount, lastActivityAt: daysAgo(input.departedActivityDays) },
    { login: 'active-author', commitCount: activeCount, lastActivityAt: daysAgo(input.activeActivityDays) },
  ].filter((author) => author.commitCount > 0);
  return {
    commitCount: input.commitCount,
    lastTouchedAt: daysAgo(input.staleDays),
    authors,
    commitsLast180Days: input.commitsLast180Days,
    fixOrRevertCommitsLast180Days: Math.min(input.commitsLast180Days, input.fixCandidate),
    historyIsPartial: false,
  };
});

function snapshotFor(history: FileHistory, dependents: number): RepoSnapshot {
  const target = 'src/core.ts';
  const dependentFiles = Array.from({ length: dependents }, (_, index) => `src/caller-${index}.ts`);
  const files = [target, ...dependentFiles].map((path) => ({ path, language: 'TypeScript', size: 500 }));
  return {
    repoName: 'fixture/repository',
    defaultBranch: 'main',
    scannedAt: new Date(NOW).toISOString(),
    files,
    historyByPath: { [target]: history },
    importGraph: dependentFiles.map((importer) => ({ importer, imported: target })),
    scan: {
      fileLimit: 400,
      scannedFileCount: files.length,
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
}

function ranked(dependents: number, history: FileHistory, otherMax = 0) {
  return scoreFile('src/core.ts', history, Array.from({ length: dependents }, (_, i) => `src/client-${i}.ts`), Math.max(dependents, otherMax), NOW);
}

describe('scoring properties', () => {
  it('ghost score never falls when dependent count rises', () => {
    fc.assert(fc.property(
      historyArbitrary,
      fc.integer({ min: 0, max: 600 }),
      fc.integer({ min: 0, max: 600 }),
      fc.integer({ min: 0, max: 1_000 }),
      (history, dependentCount, increment, otherMax) => {
        const before = ranked(dependentCount, history, otherMax).ghostScore;
        const after = ranked(dependentCount + increment, history, otherMax).ghostScore;
        expect(after).toBeGreaterThanOrEqual(before);
      },
    ), { numRuns: 200 });
  });

  it('ghost score never rises when a departed author returns and touches the file', () => {
    fc.assert(fc.property(
      fc.integer({ min: 1, max: 700 }),
      fc.integer({ min: 0, max: 700 }),
      fc.integer({ min: 1, max: 1_000 }),
      fc.integer({ min: scoringConfig.orphanActivityDays, max: 1_500 }),
      fc.integer({ min: 0, max: 1_500 }),
      (departedCommits, otherCommits, dependents, inactivityDays, staleDays) => {
        const before: FileHistory = {
          commitCount: departedCommits + otherCommits,
          lastTouchedAt: daysAgo(staleDays),
          authors: [
            { login: 'returned-author', commitCount: departedCommits, lastActivityAt: daysAgo(inactivityDays) },
            { login: 'other-author', commitCount: otherCommits, lastActivityAt: daysAgo(inactivityDays) },
          ].filter((author) => author.commitCount > 0),
          commitsLast180Days: 0,
          fixOrRevertCommitsLast180Days: 0,
          historyIsPartial: false,
        };
        const after: FileHistory = {
          ...before,
          commitCount: before.commitCount + 1,
          lastTouchedAt: new Date(NOW).toISOString(),
          authors: before.authors.map((author) => author.login === 'returned-author'
            ? { ...author, commitCount: author.commitCount + 1, lastActivityAt: new Date(NOW).toISOString() }
            : author),
        };
        expect(ranked(dependents, after).ghostScore).toBeLessThanOrEqual(ranked(dependents, before).ghostScore);
      },
    ), { numRuns: 200 });
  });

  it('keeps every score within 0..100 and returns identical reports for identical inputs', () => {
    fc.assert(fc.property(historyArbitrary, fc.integer({ min: 0, max: 500 }), fc.integer({ min: 0, max: 800 }), (history, dependents, otherMax) => {
      const report = calculateRiskReport(snapshotFor(history, dependents), NOW);
      const repeated = calculateRiskReport(snapshotFor(history, dependents), NOW);
      expect(report).toEqual(repeated);
      for (const risk of Object.values(report.files)) {
        expect(risk.ghostScore).toBeGreaterThanOrEqual(scoringConfig.zero);
        expect(risk.ghostScore).toBeLessThanOrEqual(scoringConfig.scoreScale);
        expect(risk.cobwebScore).toBeGreaterThanOrEqual(scoringConfig.zero);
        expect(risk.cobwebScore).toBeLessThanOrEqual(scoringConfig.scoreScale);
        expect(risk.poltergeistScore).toBeGreaterThanOrEqual(scoringConfig.zero);
        expect(risk.poltergeistScore).toBeLessThanOrEqual(scoringConfig.scoreScale);
        expect(risk.fileRisk).toBeGreaterThanOrEqual(scoringConfig.zero);
        expect(risk.fileRisk).toBeLessThanOrEqual(scoringConfig.scoreScale);
      }
      const targetRisk = ranked(dependents, history, otherMax);
      expect(targetRisk.ghostScore).toBeGreaterThanOrEqual(scoringConfig.zero);
      expect(targetRisk.ghostScore).toBeLessThanOrEqual(scoringConfig.scoreScale);
    }), { numRuns: 200 });
  }, 20_000);

  it('room health never rises when another file is added', () => {
    fc.assert(fc.property(
      fc.array(fc.integer({ min: 0, max: scoringConfig.scoreScale }), { maxLength: 100 }),
      fc.integer({ min: 0, max: scoringConfig.scoreScale }),
      (risks, addedRisk) => {
        expect(calculateRoomHealth([...risks, addedRisk])).toBeLessThanOrEqual(calculateRoomHealth(risks));
      },
    ), { numRuns: 200 });
  });

  it('a stale file with no dependents always has ghost score zero', () => {
    fc.assert(fc.property(historyArbitrary, nonNegative, (history, otherMax) => {
      const staleHistory = { ...history, lastTouchedAt: daysAgo(1_500) };
      expect(ranked(0, staleHistory, otherMax).ghostScore).toBe(scoringConfig.zero);
    }), { numRuns: 200 });
  });

  it('ranks equal scores in the same deterministic order for every input order', () => {
    fc.assert(fc.property(
      fc.uniqueArray(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 30 }),
      fc.array(fc.constantFrom<RiskKind>('ghost', 'cobweb', 'poltergeist'), { minLength: 1, maxLength: 3 }),
      (paths, kinds) => {
        const findings: Finding[] = paths.flatMap((path) => kinds.map((kind) => ({ path, kind, score: 60, room: 'src' })));
        expect(rankFindings(findings)).toEqual(rankFindings([...findings].reverse()));
      },
    ), { numRuns: 200 });
  });
});
