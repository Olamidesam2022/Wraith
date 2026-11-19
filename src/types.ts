export type SupportedLanguage = 'TypeScript' | 'JavaScript' | 'Python';

export interface RepoFile {
  path: string;
  language: string | null;
  size: number;
}

export interface AuthorHistory {
  login: string;
  commitCount: number;
  lastActivityAt: string | null;
}

export interface FileHistory {
  commitCount: number;
  lastTouchedAt: string | null;
  authors: AuthorHistory[];
  commitsLast180Days: number;
  fixOrRevertCommitsLast180Days: number;
  historyIsPartial: boolean;
}

export interface ImportEdge {
  importer: string;
  imported: string;
}

export interface RepoSnapshot {
  repoName: string;
  defaultBranch: string;
  scannedAt: string;
  files: RepoFile[];
  historyByPath: Record<string, FileHistory>;
  importGraph: ImportEdge[];
  scan: {
    fileLimit: number;
    scannedFileCount: number;
    skippedFileCount: number;
    skippedLanguages: string[];
    dependencyLanguages: string[];
    languagesWithoutDependencyData: string[];
    filesWithoutDependencyData: string[];
    anonymous: boolean;
    historyIsPartial: boolean;
    treeIsPartial: boolean;
  };
}

export type RiskKind = 'ghost' | 'cobweb' | 'poltergeist';

export interface FileRiskScores {
  path: string;
  lastTouchedAt: string | null;
  authors: AuthorHistory[];
  commitCount: number;
  ghostScore: number;
  cobwebScore: number;
  poltergeistScore: number;
  fileRisk: number;
  dependents: string[];
  room: string;
}

export interface RoomHealth {
  path: string;
  health: number;
  fileCount: number;
  riskTotal: number;
}

export interface Finding {
  path: string;
  kind: RiskKind;
  score: number;
  room: string;
}

export interface RiskReport {
  repoName: string;
  generatedAt: string;
  files: Record<string, FileRiskScores>;
  rooms: Record<string, RoomHealth>;
  findings: Finding[];
  summary: { ghosts: number; cobwebs: number; poltergeists: number; riskyRooms: number };
  scan: RepoSnapshot['scan'];
}
