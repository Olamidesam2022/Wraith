import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { housePreviewReport } from '../../src/fixtures/houseReport';
import HouseSvg from '../../src/house/HouseSvg';
import { FindingsList } from '../../src/ui/FindingsList';
import type { RiskReport } from '../../src/types';

afterEach(cleanup);

function baseEmptyReport(): RiskReport {
  return {
    repoName: 'fixture/empty',
    generatedAt: '2026-11-19T12:00:00.000Z',
    files: {},
    rooms: {},
    findings: [],
    summary: { ghosts: 0, cobwebs: 0, poltergeists: 0, riskyRooms: 0 },
    scan: {
      fileLimit: 50,
      scannedFileCount: 0,
      skippedFileCount: 0,
      skippedLanguages: [],
      dependencyLanguages: [],
      languagesWithoutDependencyData: [],
      filesWithoutDependencyData: [],
      anonymous: true,
      historyIsPartial: false,
      treeIsPartial: false,
    },
  };
}

describe('static house and list renderer', () => {
  it('renders an empty risk report without errors', () => {
    render(<HouseSvg report={baseEmptyReport()} />);
    expect(screen.getByText('No rooms in this report.')).toBeTruthy();
  });

  it('renders a room with zero findings without errors', () => {
    const report = baseEmptyReport();
    report.repoName = 'fixture/one-room';
    report.rooms = { 'src/lonely': { path: 'src/lonely', health: 100, fileCount: 1, riskTotal: 0 } };
    render(<HouseSvg report={report} />);
    expect(screen.getByRole('group', { name: /Room src\/lonely, health 100 percent/ })).toBeTruthy();
  });

  it('renders every finding exactly once in the sortable list view', () => {
    render(<FindingsList report={housePreviewReport} sort="risk-desc" />);
    const rows = screen.getAllByTestId('finding-row');
    const renderedKeys = rows.map((row) => row.getAttribute('data-finding-key'));
    const expectedKeys = housePreviewReport.findings.map((finding) => `${finding.kind}:${finding.path}`);
    expect(renderedKeys).toHaveLength(housePreviewReport.findings.length);
    expect(new Set(renderedKeys).size).toBe(housePreviewReport.findings.length);
    expect([...renderedKeys].sort()).toEqual([...expectedKeys].sort());
  });

  it('builds the hand-written ten-room fixture through the production scoring functions', () => {
    expect(Object.keys(housePreviewReport.rooms)).toHaveLength(10);
    expect(Object.keys(housePreviewReport.files)).toHaveLength(40);
    expect(housePreviewReport.summary.ghosts).toBeGreaterThanOrEqual(4);
    expect(housePreviewReport.summary.ghosts).toBeLessThanOrEqual(6);
    const ghostScores = housePreviewReport.findings.filter((finding) => finding.kind === 'ghost').map((finding) => finding.score);
    expect(new Set(ghostScores).size).toBeGreaterThanOrEqual(4);
    expect(housePreviewReport.summary.cobwebs).toBeGreaterThan(3);
    expect(housePreviewReport.summary.poltergeists).toBe(2);
    const health = Object.values(housePreviewReport.rooms).map((room) => room.health);
    expect(Math.min(...health)).toBeLessThan(30);
    expect(Math.max(...health)).toBe(100);
  });
});
