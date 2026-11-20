'use client';

import { gsap } from 'gsap';
import { prefersReducedMotion } from './reducedMotion';

export interface MotionTimeline {
  timeline: gsap.core.Timeline;
  reducedForm: () => gsap.core.Timeline;
}

export interface MotionEffect {
  pause(): void;
  resume(): void;
  skip(): void;
  setCalmMode(calm: boolean): void;
}

class MasterMotionClock {
  private readonly master = gsap.timeline({ paused: true });
  private readonly entries = new Set<MotionTimeline>();
  private readonly activeTimelines = new Map<MotionTimeline, gsap.core.Timeline>();
  private readonly effects = new Set<MotionEffect>();
  private hidden = false;
  private calmMode = false;

  constructor() {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibility);
    }
  }

  register(entry: MotionTimeline): () => void {
    this.entries.add(entry);
    const activeTimeline = this.calmMode || prefersReducedMotion() ? entry.reducedForm() : entry.timeline;
    this.activeTimelines.set(entry, activeTimeline);
    this.master.add(activeTimeline, this.master.time());
    // Factories return paused timelines for deterministic setup and tests; once
    // nested, let the master clock own their play state.
    activeTimeline.paused(false);
    if (!this.hidden) this.master.play();
    return () => {
      this.entries.delete(entry);
      const active = this.activeTimelines.get(entry);
      if (active) this.master.remove(active);
      this.activeTimelines.delete(entry);
    };
  }

  skip(): void {
    this.master.progress(1);
    this.effects.forEach((effect) => effect.skip());
  }

  pause(): void { this.master.pause(); this.effects.forEach((effect) => effect.pause()); }
  resume(): void { if (!this.hidden) { this.master.play(); this.effects.forEach((effect) => effect.resume()); } }

  registerEffect(effect: MotionEffect): () => void {
    this.effects.add(effect);
    effect.setCalmMode(this.calmMode || prefersReducedMotion());
    if (this.hidden) effect.pause();
    return () => { this.effects.delete(effect); effect.pause(); };
  }

  setCalmMode(calm: boolean): void {
    this.calmMode = calm || prefersReducedMotion();
    this.effects.forEach((effect) => effect.setCalmMode(this.calmMode));
    const entries = [...this.entries];
    this.master.pause(0).clear();
    this.activeTimelines.clear();
    entries.forEach((entry) => {
      const active = this.calmMode ? entry.reducedForm() : entry.timeline;
      this.activeTimelines.set(entry, active);
      this.master.add(active, 0);
      active.paused(false);
    });
    if (!this.hidden) this.master.play(0);
  }

  private readonly handleVisibility = (): void => {
    this.hidden = document.hidden;
    document.documentElement.classList.toggle('motion-paused', this.hidden);
    if (this.hidden) { this.master.pause(); this.effects.forEach((effect) => effect.pause()); }
    else { this.master.play(); this.effects.forEach((effect) => effect.resume()); }
  };
}

export const masterMotionClock = new MasterMotionClock();
