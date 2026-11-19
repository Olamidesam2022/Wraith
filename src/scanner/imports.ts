import type { ImportEdge, RepoFile } from '../types';

const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts'];
const importPattern = /\bimport\s*(?:\(\s*["']([^"']+)["']\s*\)|(?:[^'";]*?\s+from\s*)?["']([^"']+)["'])|\brequire\s*\(\s*["']([^"']+)["']\s*\)/g;

export function parseJavaScriptImports(source: string): string[] {
  const found = new Set<string>();
  importPattern.lastIndex = 0;
  for (const match of source.matchAll(importPattern)) found.add(match[1] ?? match[2] ?? match[3]);
  return [...found];
}

export function parsePythonImports(source: string): string[] {
  const found: string[] = [];
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, '').trim();
    const fromImport = line.match(/^from\s+([.\w]+)\s+import\s+/);
    const directImport = line.match(/^import\s+([\w.]+)/);
    const module = fromImport?.[1] ?? directImport?.[1];
    if (module) found.push(module);
  }
  return [...new Set(found)];
}

function normalizePath(path: string): string {
  const stack: string[] = [];
  for (const part of path.replaceAll('\\', '/').split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') stack.pop();
    else stack.push(part);
  }
  return stack.join('/');
}

export function resolveImportPath(importer: string, specifier: string, knownPaths: ReadonlySet<string>): string | null {
  if (!specifier.startsWith('.')) return null;
  const base = normalizePath(`${importer.slice(0, importer.lastIndexOf('/') + 1)}${specifier}`);
  const candidates = new Set([base]);
  for (const extension of extensions) candidates.add(`${base}${extension}`);
  for (const extension of extensions) candidates.add(`${base}/index${extension}`);
  for (const candidate of candidates) if (knownPaths.has(candidate)) return candidate;
  return null;
}

export function buildImportGraph(files: readonly RepoFile[], sourceByPath: Readonly<Record<string, string>>): ImportEdge[] {
  const knownPaths = new Set(files.map(({ path }) => path));
  const edgeKeys = new Set<string>();
  const edges: ImportEdge[] = [];
  for (const file of files) {
    if (!['JavaScript', 'TypeScript', 'Python'].includes(file.language ?? '')) continue;
    const source = sourceByPath[file.path];
    if (source === undefined) continue;
    const imports = file.language === 'Python' ? parsePythonImports(source) : parseJavaScriptImports(source);
    for (const specifier of imports) {
      const imported = resolveImportPath(file.path, specifier, knownPaths);
      if (!imported) continue;
      const key = `${file.path}\0${imported}`;
      if (edgeKeys.has(key)) continue;
      edgeKeys.add(key);
      edges.push({ importer: file.path, imported });
    }
  }
  return edges.sort((a, b) => a.importer.localeCompare(b.importer) || a.imported.localeCompare(b.imported));
}
