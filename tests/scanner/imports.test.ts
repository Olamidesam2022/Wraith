import { describe, expect, it } from 'vitest';
import { buildImportGraph, parseJavaScriptImports, parsePythonImports, resolveImportPath } from '../../src/scanner/imports';
import type { RepoFile } from '../../src/types';

describe('JavaScript and TypeScript import parsing', () => {
  it('reads CommonJS, static ES modules, dynamic imports, and mixed syntax', () => {
    const source = `
      const common = require('../common');
      import value from './value';
      import './register.js';
      const lazy = import('./lazy');
    `;
    expect(parseJavaScriptImports(source)).toEqual(['../common', './value', './register.js', './lazy']);
  });

  it('returns no imports for a file with none', () => {
    expect(parseJavaScriptImports('export const answer = 42;')).toEqual([]);
  });

  it('resolves relative imports, parent paths, explicit indexes, and missing extensions', () => {
    const known = new Set(['src/x.ts', 'src/lib/index.js', 'src/folder/index.js', 'src/folder/file.tsx']);
    expect(resolveImportPath('src/main.ts', './x', known)).toBe('src/x.ts');
    expect(resolveImportPath('src/sub/main.ts', '../x', known)).toBe('src/x.ts');
    expect(resolveImportPath('src/main.ts', './lib', known)).toBe('src/lib/index.js');
    expect(resolveImportPath('src/main.ts', './folder/index.js', known)).toBe('src/folder/index.js');
    expect(resolveImportPath('src/main.ts', './folder/file', known)).toBe('src/folder/file.tsx');
    expect(resolveImportPath('src/main.ts', 'react', known)).toBeNull();
  });

  it('builds deterministically deduplicated dependency edges', () => {
    const files: RepoFile[] = [
      { path: 'src/a.js', language: 'JavaScript', size: 1 },
      { path: 'src/b.js', language: 'JavaScript', size: 1 },
    ];
    expect(buildImportGraph(files, { 'src/a.js': "require('./b'); import('./b.js')" })).toEqual([{ importer: 'src/a.js', imported: 'src/b.js' }]);
  });

  it('parses lightweight Python import forms', () => {
    expect(parsePythonImports('import os.path\nfrom .helpers import run\n# from nope import no')).toEqual(['os.path', '.helpers']);
  });
});
