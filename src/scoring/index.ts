import { scoringConfig } from '../config';
import type { Finding, FileHistory, FileRiskScores, RepoSnapshot, RiskKind, RiskReport, RoomHealth } from '../types';

const scoreClamp = (value: number): number => Math.min(
  scoringConfig.scoreScale,
  Math.max(scoringConfig.zero, Number.isFinite(value) ? value : scoringConfig.zero),
);

function daysSince(date: string | null, nowMs: number): number {
  if (!date) return Number.POSITIVE_INFINITY;
  const timestamp = Date.parse(date);
  if (!Number.isFinite(timestamp)) return Number.POSITIVE_INFINITY;
  return Math.max(scoringConfig.zero, (nowMs - timestamp) / scoringConfig.millisecondsPerDay);
}

function ratio(numerator: number, denominator: number): number {
  if (denominator <= scoringConfig.zero) return scoringConfig.zero;
  return Math.min(scoringConfig.ratioMaximum, Math.max(scoringConfig.ratioMinimum, numerator / denominator));
}

function roomForFile(path: string): string {
  const separator = path.lastIndexOf('/');
  return separator < scoringConfig.zero ? scoringConfig.rootRoomPath : path.slice(scoringConfig.zero, separator) || scoringConfig.rootRoomPath;
}

export function scoreFile(
  path: string,
  history: FileHistory,
  dependentPaths: readonly string[],
  maxDependentsInRepo: number,
  nowMs: number,
): FileRiskScores {
  const dependents = [...new Set(dependentPaths)].sort();
  const dependentCount = dependents.length;
  const silence = Math.min(scoringConfig.ratioMaximum, daysSince(history.lastTouchedAt, nowMs) / scoringConfig.silenceWindowDays);
  const orphanCommitCount = history.authors.reduce<number>((sum, author) => {
    const inactive = author.lastActivityAt === null
      || daysSince(author.lastActivityAt, nowMs) >= scoringConfig.orphanActivityDays;
    return inactive ? sum + Math.max(scoringConfig.zero, author.commitCount) : sum;
  }, scoringConfig.zero);
  const orphaned = ratio(orphanCommitCount, history.commitCount);
  const load = maxDependentsInRepo <= scoringConfig.zero
    ? scoringConfig.zero
    : ratio(Math.log1p(dependentCount), Math.log1p(maxDependentsInRepo));
  const ghostScore = dependentCount === scoringConfig.zero
    ? scoringConfig.zero
    : scoreClamp(scoringConfig.scoreScale * load * (scoringConfig.ghostOrphanedWeight * orphaned + scoringConfig.ghostSilenceWeight * silence));
  const cobwebScore = scoreClamp(scoringConfig.scoreScale * silence);
  const fixRatio = ratio(history.fixOrRevertCommitsLast180Days, history.commitsLast180Days);
  const commitActivity = Math.min(scoringConfig.ratioMaximum, ratio(history.commitsLast180Days, scoringConfig.fixCommitSaturation));
  const poltergeistScore = scoreClamp(scoringConfig.scoreScale * fixRatio * commitActivity);
  const fileRisk = scoreClamp(
    scoringConfig.ghostWeight * ghostScore
      + scoringConfig.cobwebWeight * cobwebScore
      + scoringConfig.poltergeistWeight * poltergeistScore,
  );

  return {
    path,
    lastTouchedAt: history.lastTouchedAt,
    authors: history.authors.map((author) => ({ ...author })),
    commitCount: history.commitCount,
    ghostScore,
    cobwebScore,
    poltergeistScore,
    fileRisk,
    dependents,
    room: roomForFile(path),
  };
}

export function calculateRoomHealth(fileRisks: readonly number[]): number {
  const riskTotal = fileRisks.reduce((sum, risk) => sum + scoreClamp(risk), scoringConfig.zero);
  return scoreClamp(scoringConfig.scoreScale * Math.exp(-riskTotal / scoringConfig.roomHealthDivisor));
}

function compareText(left: string, right: string): number {
  return left < right ? -scoringConfig.one : left > right ? scoringConfig.one : scoringConfig.zero;
}

export function rankFindings(findings: readonly Finding[]): Finding[] {
  return [...findings].sort((left, right) => {
    const scoreOrder = right.score - left.score;
    if (scoreOrder !== scoringConfig.zero) return scoreOrder;
    const pathOrder = compareText(left.path, right.path);
    if (pathOrder !== scoringConfig.zero) return pathOrder;
    return scoringConfig.riskKindOrder.indexOf(left.kind) - scoringConfig.riskKindOrder.indexOf(right.kind);
  });
}

export function calculateRiskReport(snapshot: RepoSnapshot, nowMs = Date.parse(snapshot.scannedAt)): RiskReport {
  const effectiveNow = Number.isFinite(nowMs) ? nowMs : scoringConfig.zero;
  const dependentSets = new Map(snapshot.files.map((file) => [file.path, new Set<string>()]));
  for (const edge of snapshot.importGraph) {
    const dependentSet = dependentSets.get(edge.imported);
    if (dependentSet && edge.importer !== edge.imported) dependentSet.add(edge.importer);
  }
  const maxDependents = Math.max(scoringConfig.zero, ...[...dependentSets.values()].map((dependents) => dependents.size));
  const files: Record<string, FileRiskScores> = {};
  for (const file of snapshot.files) {
    const history = snapshot.historyByPath[file.path] ?? {
      commitCount: scoringConfig.zero,
      lastTouchedAt: null,
      authors: [],
      commitsLast180Days: scoringConfig.zero,
      fixOrRevertCommitsLast180Days: scoringConfig.zero,
      historyIsPartial: true,
    } satisfies FileHistory;
    files[file.path] = scoreFile(file.path, history, [...(dependentSets.get(file.path) ?? [])], maxDependents, effectiveNow);
  }

  const riskByRoom = new Map<string, number[]>();
  for (const risk of Object.values(files)) {
    const roomRisks = riskByRoom.get(risk.room) ?? [];
    roomRisks.push(risk.fileRisk);
    riskByRoom.set(risk.room, roomRisks);
  }
  const rooms: Record<string, RoomHealth> = {};
  for (const [path, risks] of [...riskByRoom].sort(([left], [right]) => compareText(left, right))) {
    const riskTotal = risks.reduce((sum, risk) => sum + risk, scoringConfig.zero);
    rooms[path] = { path, health: calculateRoomHealth(risks), fileCount: risks.length, riskTotal };
  }

  const findings: Finding[] = [];
  for (const risk of Object.values(files)) {
    const scoreByKind: Record<RiskKind, number> = {
      ghost: risk.ghostScore,
      cobweb: risk.cobwebScore,
      poltergeist: risk.poltergeistScore,
    };
    for (const kind of scoringConfig.riskKindOrder) {
      const score = scoreByKind[kind];
      if (score >= scoringConfig.thresholds[kind]) findings.push({ path: risk.path, kind, score, room: risk.room });
    }
  }

  const rankedFindings = rankFindings(findings);
  return {
    repoName: snapshot.repoName,
    generatedAt: new Date(effectiveNow).toISOString(),
    files,
    rooms,
    findings: rankedFindings,
    summary: {
      ghosts: Object.values(files).filter((file) => file.ghostScore >= scoringConfig.thresholds.ghost).length,
      cobwebs: Object.values(files).filter((file) => file.cobwebScore >= scoringConfig.thresholds.cobweb).length,
      poltergeists: Object.values(files).filter((file) => file.poltergeistScore >= scoringConfig.thresholds.poltergeist).length,
      riskyRooms: Object.values(rooms).filter((room) => room.health < scoringConfig.riskyRoomHealthThreshold).length,
    },
    scan: snapshot.scan,
  };
}
