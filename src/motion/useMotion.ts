'use client';

import { useCallback, useEffect, useMemo } from 'react';
import type { MotionTimeline } from './masterClock';
import { masterMotionClock } from './masterClock';
import { useReducedMotion } from './reducedMotion';

export function useMotion() {
  const reducedMotion = useReducedMotion();
  const register = useCallback((entry: MotionTimeline) => masterMotionClock.register(entry), []);
  const skip = useCallback(() => masterMotionClock.skip(), []);
  const pause = useCallback(() => masterMotionClock.pause(), []);
  const resume = useCallback(() => masterMotionClock.resume(), []);
  return useMemo(() => ({ reducedMotion, register, skip, pause, resume }), [reducedMotion, register, skip, pause, resume]);
}
