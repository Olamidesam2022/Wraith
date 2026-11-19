'use client';
import { useEffect, useMemo, useState } from 'react';
import { buildExorcismSpec, type ExorcismMode } from '../exorcism/spec';
import { exorcismConfig } from '../config';
import type { FileRiskScores, RiskReport } from '../types';
import { capParticleCount } from '../motion/particles';

export function ExorcismDialog({ report, file, onClose }: { report: RiskReport; file: FileRiskScores; onClose: () => void }) {
  const [mode, setMode] = useState<ExorcismMode>('document');
  const [complete, setComplete] = useState(false);
  const spec = useMemo(() => buildExorcismSpec(report, file, mode), [report, file, mode]);
  useEffect(() => {
    const timer = window.setTimeout(() => setComplete(true), exorcismConfig.maximumDurationMs);
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { setComplete(true); onClose(); } };
    window.addEventListener('keydown', key);
    return () => { clearTimeout(timer); window.removeEventListener('keydown', key); };
  }, [onClose, spec]);
  const shown = complete ? spec : spec.slice(0, Math.ceil(spec.length * 0.42));
  async function copy() { await navigator.clipboard.writeText(spec); setComplete(true); }
  function download() { const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([spec], { type: 'text/markdown' })); link.download = `${file.path.split('/').pop()}-exorcism.md`; link.click(); URL.revokeObjectURL(link.href); }
  return <div className="exorcism-backdrop" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <section className="exorcism-dialog" role="dialog" aria-modal="true" aria-label={`Exorcism plan for ${file.path}`}>
      <header><h2>Exorcise <code>{file.path}</code></h2><button onClick={onClose} aria-label="Close exorcism plan">Close</button></header>
      <fieldset><legend>Choose a task mode</legend>{(['document','tests','refactor'] as const).map((m) => <label key={m}><input type="radio" name="exorcism-mode" value={m} checked={mode === m} onChange={() => { setMode(m); setComplete(false); }} /> {m === 'tests' ? 'Add tests' : m === 'refactor' ? 'Safe refactor' : 'Document'}</label>)}</fieldset>
      <div className="ritual" aria-hidden="true"><svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="32" /><text x="40" y="48" textAnchor="middle">✦</text></svg><span>{capParticleCount(exorcismConfig.maximumParticles)} particles max</span></div>
      <pre className="exorcism-spec" aria-live="polite">{shown}</pre>
      <footer><button onClick={() => setComplete(true)}>Skip ritual</button><button onClick={copy}>Copy Markdown</button><button onClick={download}>Download .md</button></footer>
    </section>
  </div>;
}
