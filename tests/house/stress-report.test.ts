import { describe, expect, it } from 'vitest';
import { createStressReport } from '../../src/fixtures/stressReport';

describe('generated stress report', () => {
  it('contains 5,000 generated files across 100 rooms without live repository data', () => {
    const report = createStressReport();
    expect(Object.keys(report.files)).toHaveLength(5_000);
    expect(Object.keys(report.rooms)).toHaveLength(100);
    expect(report.scan.scannedFileCount).toBe(5_000);
    expect(report.findings).toEqual([]);
  });
});
