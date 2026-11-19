'use client';

import { gsap } from 'gsap';
import { prefersReducedMotion } from './reducedMotion';

export interface MotionTimeline {
  timeline: gsap.core.Timeline;
  reducedForm: () => gsap.core.Timeline;
}

class MasterMotionClock {
  private readonly master = gsap.timeline({ paused: true });
  private readonly entries = new Set<MotionTimeline>();
  private readonly activeTimelines = new Map<MotionTimeline, gsap.core.Timeline>();
  private hidden = false;

  constructor() {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibility);
    }
  }

  register(entry: MotionTimeline): () => void {
    this.entries.add(entry);
    const activeTimeline = prefersReducedMotion() ? entry.reducedForm() : entry.timeline;
    this.activeTimelines.set(entry, activeTimeline);
    this.master.add(activeTimeline, this.master.time());
    // Factories return paused timelines for deterministic setup and tests; once
    // nested, let the master clock own their play state.
    activeTimeline.paused(false);
    if (!this.hidden) {
      this.master.progress(0);
      this.master.play();
    }
    return () => {
      this.entries.delete(entry);
      const active = this.activeTimelines.get(entry);
      if (active) this.master.remove(active);
      this.activeTimelines.delete(entry);
    };
  }

  skip(): void {
    this.master.progress(1);
  }

  pause(): void { this.master.pause(); }
  resume(): void { if (!this.hidden) this.master.play(); }

  private readonly handleVisibility = (): void => {
    this.hidden = document.hidden;
    if (this.hidden) this.master.pause();
    else this.master.play();
  };
}

export const masterMotionClock = new MasterMotionClock();
