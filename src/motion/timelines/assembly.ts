import { gsap } from 'gsap';
import { houseConfig } from '../../config';
import { motionTokens } from '../tokens';
import type { MotionTimeline } from '../masterClock';

export interface AssemblyRoom { selector: string; risk: number }

export function assemblyStaggerDelays(roomCount: number, stagger = houseConfig.assemblyStaggerMs): number[] {
  const finalStartLimit = Math.max(0, houseConfig.assemblyMaxStaggerMs - motionTokens.duration.slow);
  return Array.from({ length: Math.max(0, Math.floor(roomCount)) }, (_, index) =>
    Math.min(index * stagger, finalStartLimit));
}

export function createAssemblyTimeline(rooms: readonly AssemblyRoom[]): MotionTimeline {
  const ordered = [...rooms].sort((a, b) => b.risk - a.risk || a.selector.localeCompare(b.selector));
  const delays = assemblyStaggerDelays(ordered.length);
  const timeline = gsap.timeline({ paused: true });
  ordered.forEach((room, index) => {
    timeline.fromTo(room.selector, { opacity: 0.3, y: -52, scaleX: 0.96, scaleY: 0.82 }, {
      opacity: 1,
      y: 0,
      scaleX: 1,
      scaleY: 1,
      duration: motionTokens.duration.slow / 1000,
      ease: motionTokens.easing.bounce,
    }, delays[index] / 1000);
  });
  const reducedForm = () => gsap.timeline({ paused: true }).to(ordered.map((room) => room.selector), {
    opacity: 1,
    duration: Math.min(motionTokens.duration.fast, houseConfig.reducedMotionMaxMs) / 1000,
  });
  return { timeline, reducedForm };
}
