'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { masterMotionClock } from './masterClock';
import type { PhysicsKind, PhysicsWorld } from './physics';

export function usePhysicsWorld() {
  const [world, setWorld] = useState<PhysicsWorld | null>(null);
  const instance = useRef<PhysicsWorld | null>(null);
  const loading = useRef<Promise<PhysicsWorld> | null>(null);
  const unregister = useRef<(() => void) | null>(null);
  const load = useCallback(async () => {
    if (instance.current) return instance.current;
    loading.current ??= import('./physics').then(({ PhysicsWorld }) => {
      const next = new PhysicsWorld();
      instance.current = next;
      unregister.current = masterMotionClock.registerEffect(next);
      setWorld(next);
      return next;
    });
    return loading.current;
  }, []);
  useEffect(() => () => { unregister.current?.(); instance.current?.clear(); }, []);
  return { world, load };
}

export function PhysicsLayer({ world, active, ambient }: { world: PhysicsWorld | null; active: boolean; ambient: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => { if (world && !ambient) world.clearKind('dust'); }, [ambient, world]);
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context || !world || !active) return;
    let frame = 0;
    let previous = performance.now();
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.floor(rect.width * ratio));
      canvas.height = Math.max(1, Math.floor(rect.height * ratio));
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      if (ambient) world.seedAmbient(rect.width, rect.height);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    const style = getComputedStyle(document.documentElement);
    const soot = style.getPropertyValue('--soot-950').trim();
    const bone = style.getPropertyValue('--bone-100').trim();
    const bronze = style.getPropertyValue('--bronze-500').trim();
    const oxblood = style.getPropertyValue('--oxblood-600').trim();
    const drawBody = (x: number, y: number, radius: number, kind: PhysicsKind, rotation: number, alpha = 1, squash = 0) => {
      context.save(); context.translate(x, y); context.rotate(rotation); context.scale(1 + squash * 0.15, 1 - squash * 0.15); context.globalAlpha = Math.max(0, Math.min(1, alpha));
      context.fillStyle = kind === 'ember' || kind === 'rain' ? oxblood : kind === 'chunk' ? bronze : bone;
      if (kind === 'chunk') context.fillRect(-radius, -radius, radius * 2, radius * 2);
      else if (kind === 'rain') { context.fillRect(-1, -radius * 2, 2, radius * 4); }
      else { context.beginPath(); context.ellipse(0, 0, radius * (kind === 'ghost' ? 0.78 : 1), radius, 0, 0, Math.PI * 2); context.fill(); if (kind === 'ghost') { context.fillStyle = soot; context.beginPath(); context.arc(-radius * .25, -radius * .1, 1.5, 0, Math.PI * 2); context.arc(radius * .25, -radius * .1, 1.5, 0, Math.PI * 2); context.fill(); } }
      context.restore();
    };
    const tick = (now: number) => {
      const rect = canvas.getBoundingClientRect();
      const delta = now - previous; previous = now;
      world.step(delta, rect.width, rect.height);
      context.clearRect(0, 0, rect.width, rect.height);
      world.activeParticles.forEach((particle) => drawBody(particle.x, particle.y, particle.radius, particle.kind, particle.rotation, Math.min(1, particle.life)));
      world.activeBodies.forEach((body) => drawBody(body.x, body.y, body.radius, body.kind, body.rotation, 1, body.squash));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); context.clearRect(0, 0, canvas.width, canvas.height); };
  }, [active, ambient, world]);
  return <canvas ref={canvasRef} className="physics-canvas" aria-hidden="true" />;
}
