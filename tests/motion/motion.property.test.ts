import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { houseConfig } from '../../src/config';
import { motionTokens } from '../../src/motion/tokens';
import { assemblyStaggerDelays, createAssemblyTimeline } from '../../src/motion/timelines/assembly';
import { createGhostHoverTimeline, createRoomDoorTimeline } from '../../src/motion/timelines/interaction';

describe('motion foundation properties', () => {
  it('clamps assembly stagger for every room count from 0 through 5000', () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 5_000 }), (roomCount) => {
      const delays = assemblyStaggerDelays(roomCount);
      expect(delays.length).toBe(roomCount);
      expect(delays.every((delay) => delay <= houseConfig.assemblyMaxStaggerMs)).toBe(true);
      expect((delays.at(-1) ?? 0) + motionTokens.duration.slow).toBeLessThanOrEqual(houseConfig.assemblyMaxStaggerMs);
    }), { numRuns: 250 });
  });

  it('keeps room delays non-decreasing when rooms are ordered by risk', () => {
    fc.assert(fc.property(fc.array(fc.integer({ min: 0, max: 100 }), { maxLength: 100 }), (riskValues) => {
      const rooms = riskValues.map((risk, index) => ({ selector: `.room-${index}`, risk }));
      const ordered = [...rooms].sort((left, right) => right.risk - left.risk || left.selector.localeCompare(right.selector));
      const timeline = createAssemblyTimeline(rooms);
      expect(timeline.timeline.totalDuration() * 1_000).toBeLessThanOrEqual(houseConfig.assemblyMaxStaggerMs);
      expect(assemblyStaggerDelays(ordered.length)).toEqual([...assemblyStaggerDelays(ordered.length)].sort((a, b) => a - b));
    }), { numRuns: 200 });
  });

  it('returns a reduced assembly form no longer than 200ms', () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 100 }), (roomCount) => {
      const rooms = Array.from({ length: roomCount }, (_, index) => ({ selector: `.room-${index}`, risk: roomCount - index }));
      const reduced = createAssemblyTimeline(rooms).reducedForm();
      expect(reduced.totalDuration() * 1_000).toBeLessThanOrEqual(houseConfig.reducedMotionMaxMs);
    }), { numRuns: 200 });
  });

  it('keeps reduced ghost and room forms at or below 200ms', () => {
    fc.assert(fc.property(fc.boolean(), (open) => {
      const ghost = document.createElement('g');
      const detail = document.createElement('aside');
      const line = document.createElement('path');
      const reducedHover = createGhostHoverTimeline(ghost, detail, [line]).reducedForm();
      const reducedRoom = createRoomDoorTimeline(ghost, detail, open).reducedForm();
      expect(reducedHover.totalDuration() * 1000).toBeLessThanOrEqual(houseConfig.reducedMotionMaxMs);
      expect(reducedRoom.totalDuration() * 1000).toBeLessThanOrEqual(houseConfig.reducedMotionMaxMs);
    }), { numRuns: 250 });
  });
});
