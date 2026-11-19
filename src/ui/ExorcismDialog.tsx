'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { buildExorcismSpec, type ExorcismMode } from '../exorcism/spec';
import { exorcismConfig } from '../config';
import type { FileRiskScores, RiskReport } from '../types';
import { capParticleCount } from '../motion/particles';

export function ExorcismDialog({ report, file, onClose }: { report: RiskReport; file: FileRiskScores; onClose: () => void }) {
  const [mode, setMode] = useState<ExorcismMode>('document');
  const [revealedLines, setRevealedLines] = useState(0);
  const particles = useRef<HTMLCanvasElement>(null);
  const spec = useMemo(() => buildExorcismSpec(report, file, mode), [report, file, mode]);
  const lines = useMemo(() => spec.split('\n'), [spec]);
  useEffect(() => {
    let line = 0;
    const interval = window.setInterval(() => { line += 1; setRevealedLines(line); if (line >= lines.length) window.clearInterval(interval); }, Math.max(1, Math.floor(exorcismConfig.maximumDurationMs / lines.length)));
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); setRevealedLines(lines.length); } };
    window.addEventListener('keydown', key);
    return () => { window.clearInterval(interval); window.removeEventListener('keydown', key); };
  }, [onClose, spec, lines.length]);
  useEffect(() => {
    const canvas = particles.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const count = capParticleCount(exorcismConfig.maximumParticles);
    const seed = Array.from({ length: count }, (_, index) => ({ angle: index * Math.PI * 2 / count, speed: exorcismConfig.particleSpeedMinimum + ((index * 37) % 100) / 100 * (exorcismConfig.particleSpeedMaximum - exorcismConfig.particleSpeedMinimum), radius: exorcismConfig.particleRadiusMinimum + index % 3 }));
    const color = getComputedStyle(document.documentElement).getPropertyValue('--bone-100').trim();
    const started = performance.now();
    let frame = 0;
    const draw = (now: number) => {
      const progress = Math.min(1, (now - started) / exorcismConfig.dissolveMs);
      context.clearRect(0, 0, canvas.width, canvas.height);
      for (const particle of seed) {
        context.globalAlpha = 1 - progress;
        context.fillStyle = color;
        context.beginPath();
        context.arc(canvas.width / 2 + Math.cos(particle.angle) * particle.speed * progress * 28, canvas.height / 2 + Math.sin(particle.angle) * particle.speed * progress * 28, particle.radius, 0, Math.PI * 2);
        context.fill();
      }
      if (progress < 1) frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);
  const complete = revealedLines >= lines.length;
  const shown = lines.slice(0, revealedLines).join('\n');
  async function copy() { await navigator.clipboard.writeText(spec); setRevealedLines(lines.length); }
  function download() { const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([spec], { type: 'text/markdown' })); link.download = `${file.path.split('/').pop()}-exorcism.md`; link.click(); URL.revokeObjectURL(link.href); }
  return <div className="exorcism-backdrop" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <section className="exorcism-dialog" role="dialog" aria-modal="true" aria-label={`Exorcism plan for ${file.path}`}>
      <header><h2>Exorcise <code>{file.path}</code></h2><button onClick={onClose} aria-label="Close exorcism plan">Close</button></header>
      <fieldset><legend>Choose a task mode</legend>{(['document','tests','refactor'] as const).map((m) => <label key={m}><input type="radio" name="exorcism-mode" value={m} checked={mode === m} onChange={() => { setMode(m); setRevealedLines(0); }} /> {m === 'tests' ? 'Add tests' : m === 'refactor' ? 'Safe refactor' : 'Document'}</label>)}</fieldset>
      <div className="ritual" aria-hidden="true"><svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="32" /><text x="40" y="48" textAnchor="middle">✦</text></svg><canvas ref={particles} width={exorcismConfig.particleCanvasSize} height={exorcismConfig.particleCanvasSize} /><span>{capParticleCount(exorcismConfig.maximumParticles)} particles max</span></div>
      <pre className="exorcism-spec" aria-live="polite">{shown}</pre>
      <footer><button onClick={() => setRevealedLines(lines.length)}>Skip ritual</button><button onClick={copy}>Copy Markdown</button><button onClick={download}>Download .md</button></footer>
    </section>
  </div>;
}
