import { describe, expect, it } from 'vitest';
import { scoringConfig } from '../../src/config';
import { calculateRoomHealth, scoreFile } from '../../src/scoring';
import type { FileHistory } from '../../src/types';

const now = Date.parse('2026-11-19T12:00:00.000Z');
const day = scoringConfig.millisecondsPerDay;

function history(overrides: Partial<FileHistory> = {}): FileHistory {
  return {
    commitCount: 10,
    lastTouchedAt: new Date(now - 365 * day).toISOString(),
    authors: [{ login: 'former-owner', commitCount: 10, lastActivityAt: new Date(now - 500 * day).toISOString() }],
    commitsLast180Days: 10,
    fixOrRevertCommitsLast180Days: 5,
    historyIsPartial: false,
    ...overrides,
  };
}

describe('scoring examples', () => {
  it('scores a stale load-bearing file owned by a departed author as a clear ghost', () => {
    const risk = scoreFile('src/core.ts', history(), ['src/a.ts', 'src/b.ts'], 2, now);

    expect(risk.ghostScore).toBe(80);
    expect(risk.cobwebScore).toBe(50);
    expect(risk.poltergeistScore).toBe(25);
    expect(risk.fileRisk).toBe(63);
  });

  it('never labels a file with zero dependents as a ghost, even when fully stale', () => {
    const risk = scoreFile('src/unused.ts', history({ lastTouchedAt: null }), [], 20, now);
    expect(risk.ghostScore).toBe(scoringConfig.zero);
    expect(risk.cobwebScore).toBe(scoringConfig.scoreScale);
  });

  it('uses exponential room health from the total file risk', () => {
    const health = calculateRoomHealth([scoringConfig.scoreScale, scoringConfig.roomHealthDivisor - scoringConfig.scoreScale]);
    expect(health).toBeCloseTo(scoringConfig.scoreScale / Math.E, 10);
  });
});
