import { buildImportGraph } from './imports';
import type { FileHistory, RepoFile, RepoSnapshot } from '../types';

export interface SnapshotInput {
  repoName: string;
  defaultBranch: string;
  files: RepoFile[];
  allRepositoryFiles?: RepoFile[];
  sourceByPath: Record<string, string>;
  historyByPath: Record<string, FileHistory>;
  skippedFileCount: number;
  fileLimit: number;
  anonymous: boolean;
  treeIsPartial?: boolean;
  scannedAt: string;
}

export function buildSnapshot(input: SnapshotInput): RepoSnapshot {
  const dependencyLanguages = ['JavaScript', 'TypeScript', 'Python'];
  const supported = new Set(dependencyLanguages);
  const scannedPaths = new Set(input.files.map((file) => file.path));
  return {
    repoName: input.repoName,
    defaultBranch: input.defaultBranch,
    scannedAt: input.scannedAt,
    files: [...input.files].sort((a, b) => a.path.localeCompare(b.path)),
    historyByPath: input.historyByPath,
    importGraph: buildImportGraph(input.files, input.sourceByPath),
    scan: {
      fileLimit: input.fileLimit,
      scannedFileCount: input.files.length,
      skippedFileCount: input.skippedFileCount,
      skippedLanguages: [...new Set((input.allRepositoryFiles ?? input.files).filter((file) => !supported.has(file.language ?? '')).map((file) => file.language ?? 'Unknown'))].sort(),
      dependencyLanguages,
      languagesWithoutDependencyData: [...new Set([
        ...(input.allRepositoryFiles ?? input.files).filter((file) => !supported.has(file.language ?? '') || !scannedPaths.has(file.path)).map((file) => file.language ?? 'Unknown'),
        ...input.files.filter((file) => supported.has(file.language ?? '') && input.sourceByPath[file.path] === undefined).map((file) => file.language ?? 'Unknown'),
      ])].sort(),
      filesWithoutDependencyData: input.files.filter((file) => supported.has(file.language ?? '') && input.sourceByPath[file.path] === undefined).map((file) => file.path).sort(),
      anonymous: input.anonymous,
      historyIsPartial: Object.values(input.historyByPath).some((history) => history.historyIsPartial),
      treeIsPartial: input.treeIsPartial ?? false,
    },
  };
}
