import { exorcismConfig } from '../config';

export function capParticleCount(requested: number, cap = exorcismConfig.maximumParticles): number {
  return Math.max(0, Math.min(Math.floor(requested), cap));
}
export function particleCounts(effects: readonly number[], cap = exorcismConfig.maximumParticles): number[] {
  let left = cap;
  return effects.map((count) => { const accepted = capParticleCount(Math.min(left, count), cap); left -= accepted; return accepted; });
}
