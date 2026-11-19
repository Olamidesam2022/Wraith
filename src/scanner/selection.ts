import { scanConfig } from '../config';
import type { RepoFile } from '../types';

export interface FilePriority extends RepoFile {
  lastTouchedAt?: string | null;
  dependentCount?: number;
}

export function selectFiles<T extends FilePriority>(files: readonly T[], limit: number): { selected: T[]; skippedCount: number } {
  const count = Math.max(0, Math.floor(limit));
  const ranked = [...files].sort((a, b) => {
    const dependents = (b.dependentCount ?? 0) - (a.dependentCount ?? 0);
    if (dependents !== 0) return dependents;
    const aTouched = Date.parse(a.lastTouchedAt ?? '') || 0;
    const bTouched = Date.parse(b.lastTouchedAt ?? '') || 0;
    return bTouched - aTouched || a.path.localeCompare(b.path);
  });
  return { selected: ranked.slice(0, count), skippedCount: Math.max(0, ranked.length - count) };
}

export function chooseScanLimit(hasToken: boolean): number {
  return hasToken ? scanConfig.maxFiles : scanConfig.anonymousMaxFiles;
}
