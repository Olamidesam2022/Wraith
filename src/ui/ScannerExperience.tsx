'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Lenis from 'lenis';
import { calculateRiskReport } from '../scoring';
import { housePreviewSnapshot } from '../fixtures/houseReport';
import type { RepoSnapshot, RiskReport } from '../types';
import { RiskExplorer } from './RiskExplorer';

type ScanState = 'empty' | 'loading' | 'error' | 'not-found' | 'rate-limited' | 'token-required' | 'report';

const exampleRepository = 'expressjs/express';
const exampleSnapshotName = 'expressjs-express.json';

function errorState(status: number, code: string): ScanState {
  if (status === 404 || code === 'REPO_NOT_FOUND') return 'not-found';
  if (status === 429 || code === 'RATE_LIMITED') return 'rate-limited';
  if (status === 401 || code === 'TOKEN_REQUIRED') return 'token-required';
  return 'error';
}

export default function ScannerExperience() {
  const [repoUrl, setRepoUrl] = useState('');
  const [visitorToken, setVisitorToken] = useState('');
  const [state, setState] = useState<ScanState>('empty');
  const [message, setMessage] = useState('');
  const [report, setReport] = useState<RiskReport | null>(null);
  const [usingFixture, setUsingFixture] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [easterEgg, setEasterEgg] = useState(false);

  useEffect(() => {
    const reduced = !window.matchMedia || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const lenis = reduced ? null : new Lenis({ duration: 0.8, smoothWheel: true, autoRaf: true });
    const keydown = (event: KeyboardEvent) => {
      if (event.key === '?') setShortcutsOpen((open) => !open);
      if (event.key.toLowerCase() === 'w' && event.altKey) setEasterEgg((active) => !active);
    };
    window.addEventListener('keydown', keydown);
    return () => { lenis?.destroy(); window.removeEventListener('keydown', keydown); };
  }, []);

  const showSnapshot = useCallback((snapshot: RepoSnapshot, fixture: boolean) => {
    setReport(calculateRiskReport(snapshot));
    setUsingFixture(fixture);
    setState('report');
    setMessage('');
  }, []);

  const tryExample = useCallback(async () => {
    setState('loading');
    setMessage('Loading a local example. No GitHub request is made.');
    try {
      const response = await fetch(`/snapshots/${exampleSnapshotName}`, { cache: 'force-cache' });
      if (response.ok) {
        showSnapshot(await response.json() as RepoSnapshot, false);
        setRepoUrl(`https://github.com/${exampleRepository}`);
        return;
      }
    } catch { /* The bundled fixture keeps the example available offline. */ }
    showSnapshot({ ...housePreviewSnapshot, repoName: `Fixture · ${exampleRepository}` }, true);
    setRepoUrl(`https://github.com/${exampleRepository}`);
    setMessage(`Offline fixture loaded for ${exampleRepository}. It is illustrative sample data, not a live scan.`);
  }, [showSnapshot]);

  const scan = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setState('loading');
    setMessage('Reading repository files and history from GitHub.');
    setReport(null);
    setUsingFixture(false);
    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl, ...(visitorToken ? { token: visitorToken } : {}) }),
        cache: 'no-store',
      });
      const result = await response.json() as { snapshot?: RepoSnapshot; error?: string; message?: string };
      if (!response.ok || !result.snapshot) {
        setState(errorState(response.status, result.error ?? 'GITHUB_ERROR'));
        setMessage(result.message ?? 'The scan could not be completed.');
        return;
      }
      showSnapshot(result.snapshot, false);
      setVisitorToken('');
    } catch {
      setState('error');
      setMessage('The scan service could not be reached. Check the connection and try again.');
    }
  }, [repoUrl, showSnapshot, visitorToken]);

  const reset = () => {
    setReport(null);
    setState('empty');
    setMessage('');
    setUsingFixture(false);
    setVisitorToken('');
  };

  return (
    <main className="landing-shell">
      <header className="landing-nav">
        <a className="wordmark" href="/" aria-label="Wraith home">Wraith<span aria-hidden="true">/</span></a>
        <a className="nav-link" href="/house-preview">House preview</a>
      </header>
      {!report ? (
        <>
          <section className="landing-hero" aria-labelledby="landing-title">
            <p className="eyebrow">Repository maintenance intelligence</p>
            <h1 id="landing-title">The code that still depends on people who left.</h1>
            <p className="landing-lede">Wraith turns hidden ownership loss, staleness, and repair churn into a house you can inspect.</p>
            <form className="repo-form" onSubmit={scan}>
              <label htmlFor="repo-url">Public GitHub repository</label>
              <div className="repo-form__input-row">
                <input
                  id="repo-url"
                  name="repoUrl"
                  type="url"
                  inputMode="url"
                  autoComplete="url"
                  placeholder="https://github.com/owner/repository"
                  value={repoUrl}
                  onChange={(event) => setRepoUrl(event.currentTarget.value)}
                  aria-describedby="repo-help"
                  required
                />
                <button className="primary-action magnetic-action" type="submit" disabled={state === 'loading'}>Scan repository</button>
              </div>
              <p id="repo-help" className="form-note">Live scans run through Wraith’s route and query GitHub GraphQL.</p>
              <details className="token-disclosure">
                <summary>Add a GitHub token for a larger scan</summary>
                <label htmlFor="github-token">GitHub token</label>
                <input
                  id="github-token"
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  value={visitorToken}
                  onChange={(event) => setVisitorToken(event.currentTarget.value)}
                  aria-describedby="token-help"
                />
                <p id="token-help">Kept only in this page’s memory. Sent only to the scan route for this request, then cleared after a successful scan.</p>
              </details>
            </form>
            <button className="example-action" type="button" onClick={tryExample} disabled={state === 'loading'}>
              Try a famous repo · offline example
            </button>
          </section>

          <section className="landing-proof" aria-label="What the house shows">
            <article><span className="proof-index">01</span><h2>Ghosts</h2><p>Load-bearing files with silent authors and active dependents.</p></article>
            <article><span className="proof-index">02</span><h2>Cobwebs</h2><p>Files with a long gap since the last touch.</p></article>
            <article><span className="proof-index">03</span><h2>Poltergeists</h2><p>Areas where fixes and reversions keep returning.</p></article>
          </section>
          <section className="landing-story" aria-label="How Wraith works">
            <p className="eyebrow">From history to a room you can act on</p>
            <div><span>01 · Scan</span><p>Read file history and dependency edges in bounded batches.</p></div>
            <div><span>02 · Assemble</span><p>Turn risky paths into rooms and explain each signal with an icon and score.</p></div>
            <div><span>03 · Repair</span><p>Inspect ownership, dependents, and a practical Markdown task plan.</p></div>
            <a href="#repo-url">Skip story and scan a repository ↑</a>
          </section>
        </>
      ) : (
        <section className="live-report" aria-label={`Risk report for ${report.repoName}`}>
          <div className="report-heading">
            <div>
              <p className="eyebrow">{usingFixture ? 'Bundled offline fixture' : 'Repository scan'} · {report.repoName}</p>
              <h1>What the history left behind.</h1>
              {usingFixture && <p className="fixture-notice">Illustrative fixture data; no live repository scan has been run.</p>}
            </div>
            <button className="secondary-action" type="button" onClick={reset}>Scan another repository</button>
          </div>
          <ReportNotices report={report} />
          <RiskExplorer report={report} />
        </section>
      )}

      {state === 'loading' && (
        <div className="scan-status" role="status" aria-live="polite">
          <p>{message}</p>
          <div className="scan-skeleton" aria-hidden="true"><span /><span /><span /></div>
        </div>
      )}
      {state !== 'empty' && state !== 'loading' && state !== 'report' && (
        <div className={`scan-status scan-status--${state}`} role="alert">
          <strong>{state === 'rate-limited' ? 'GitHub is rate limiting scans.' : state === 'not-found' ? 'Repository not found.' : state === 'token-required' ? 'A token is needed for a live scan.' : 'The scan did not finish.'}</strong>
          <p>{message}</p>
          {(state === 'rate-limited' || state === 'token-required') && (
            <button className="secondary-action" type="button" onClick={tryExample}>Load the offline example</button>
          )}
        </div>
      )}
      <button className="shortcut-help" onClick={() => setShortcutsOpen((open) => !open)} aria-label="Keyboard shortcuts">?</button>
      {shortcutsOpen && <div className="shortcut-sheet" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts"><h2>Keyboard shortcuts</h2><p>House: arrow keys pan, plus/minus zoom, R resets, Enter opens a focused room or ghost.</p><p>Press Escape to close details. Press ? to close this sheet.</p><button onClick={() => setShortcutsOpen(false)}>Close</button></div>}
      {easterEgg && <p className="easter-egg" role="status">The house remembers every hand that built it.</p>}
    </main>
  );
}

function ReportNotices({ report }: { report: RiskReport }) {
  const notices: string[] = [];
  if (report.scan.skippedFileCount > 0) notices.push(`Scanned ${report.scan.scannedFileCount} files and skipped ${report.scan.skippedFileCount} files at the ${report.scan.fileLimit}-file cap.`);
  if (report.scan.anonymous) notices.push('This scan used the anonymous file cap. Add a token to scan more files.');
  if (report.scan.languagesWithoutDependencyData.length > 0) notices.push(`Dependency data is unavailable for: ${report.scan.languagesWithoutDependencyData.join(', ')}.`);
  if (report.scan.filesWithoutDependencyData.length > 0) notices.push(`${report.scan.filesWithoutDependencyData.length} scanned files could not be parsed for dependency data.`);
  if (report.scan.historyIsPartial) notices.push('Some file histories or author activity could not be retrieved; scores use the available history.');
  if (report.scan.treeIsPartial) notices.push('The repository tree was capped or partially unavailable.');
  if (report.findings.length === 0) notices.push('No files crossed the configured risk thresholds.');
  return notices.length > 0 ? <ul className="report-notices" aria-label="Scan limits and data notes">{notices.map((notice) => <li key={notice}>{notice}</li>)}</ul> : null;
}
