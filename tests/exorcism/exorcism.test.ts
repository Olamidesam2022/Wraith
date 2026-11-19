import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { typingDurationMs, buildExorcismSpec } from '../../src/exorcism/spec';
import { particleCounts } from '../../src/motion/particles';
import { housePreviewReport } from '../../src/fixtures/houseReport';

describe('exorcism plans and limits', () => {
  it('finishes typing within 3.5 seconds for every spec length', () => fc.assert(fc.property(fc.integer({ min: 1, max: 20_000 }), (n) => typingDurationMs(n) <= 3500), { numRuns: 300 }));
  it('caps particles regardless of how effects are ordered', () => fc.assert(fc.property(fc.array(fc.integer({ min: 0, max: 500 }), { maxLength: 30 }), (counts) => particleCounts(counts, 120).reduce((a,b) => a+b,0) <= 120), { numRuns: 300 }));
  it('creates valid sections for every ghost finding', () => {
    const ghosts = housePreviewReport.findings.filter((f) => f.kind === 'ghost');
    expect(ghosts.length).toBeGreaterThan(0);
    for (const ghost of ghosts) {
      const md = buildExorcismSpec(housePreviewReport, housePreviewReport.files[ghost.path], 'document');
      expect(md).toMatch(/^# Exorcism plan:/);
      for (const section of ['Why this file is risky', 'Dependents', 'Task modes', 'Suggested order of work']) expect(md).toContain(`## ${section}`);
      expect(md).toContain('### Add focused tests');
      expect(md).toContain('### Refactor safely');
    }
  });
});
