import { describe, expect, it } from 'vitest';
import { motionTokens } from '../src/motion/tokens';
import { scanConfig, scoringConfig } from '../src/config';

describe('project foundation', () => {
  it('keeps shared motion and scan constants available', () => {
    expect(motionTokens.duration.set).toBe(1200);
    expect(scanConfig.maxFiles).toBe(400);
    expect(scoringConfig.thresholds.ghost).toBe(40);
  });
});
