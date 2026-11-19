import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoInput = process.argv[2];
if (!repoInput || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repoInput)) {
  console.error('Usage: npm run snapshot -- owner/repo');
  process.exit(2);
}

const root = fileURLToPath(new URL('../', import.meta.url));
const envText = await readFile(path.join(root, '.env.local'), 'utf8').catch(() => '');
const token = envText.match(/^GITHUB_TOKEN=(.*)$/m)?.[1]?.trim();
if (!token) {
  console.error('Set GITHUB_TOKEN in .env.local before generating a snapshot.');
  process.exit(2);
}

const response = await fetch('http://localhost:3000/api/scan', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ repoUrl: `https://github.com/${repoInput}`, token }),
});
const result = await response.json().catch(() => ({}));
if (!response.ok || !result.snapshot) {
  console.error(`Snapshot generation failed (${result.error ?? response.status}). Is the app running at http://localhost:3000?`);
  process.exit(1);
}

const [owner, repo] = repoInput.split('/');
const snapshotDirectory = path.join(root, 'public', 'snapshots');
await mkdir(snapshotDirectory, { recursive: true });
await writeFile(path.join(snapshotDirectory, `${owner}-${repo}.json`), `${JSON.stringify(result.snapshot, null, 2)}\n`, 'utf8');
console.log(`Wrote a token-free snapshot for ${repoInput}.`);
