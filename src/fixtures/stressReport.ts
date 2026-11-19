import type { FileRiskScores, RiskReport, RoomHealth } from '../types';

export function createStressReport(fileCount = 5_000): RiskReport {
  const files: Record<string, FileRiskScores> = {};
  const rooms: Record<string, RoomHealth> = {};
  const count = Math.max(0, Math.floor(fileCount));
  for (let index = 0; index < count; index += 1) {
    const room = `src/module-${Math.floor(index / 50).toString().padStart(3, '0')}`;
    const path = `${room}/file-${index.toString().padStart(5, '0')}.ts`;
    rooms[room] ??= { path: room, health: 72, fileCount: 0, riskTotal: 0 };
    rooms[room].fileCount += 1;
    files[path] = { path, lastTouchedAt: null, authors: [], commitCount: 0, ghostScore: 0, cobwebScore: 0, poltergeistScore: 0, fileRisk: 0, dependents: [], room };
  }
  return {
    repoName: 'fixture/5000-file-stress', generatedAt: '2026-11-19T12:00:00.000Z', files, rooms, findings: [],
    summary: { ghosts: 0, cobwebs: 0, poltergeists: 0, riskyRooms: 0 },
    scan: { fileLimit: count, scannedFileCount: count, skippedFileCount: 0, skippedLanguages: [], dependencyLanguages: ['JavaScript', 'TypeScript', 'Python'], languagesWithoutDependencyData: [], filesWithoutDependencyData: [], anonymous: false, historyIsPartial: false, treeIsPartial: false },
  };
}
