import { gsap } from 'gsap';
import { houseConfig } from '../../config';
import { motionTokens } from '../tokens';
import type { MotionTimeline } from '../masterClock';

export function createGhostHoverTimeline(ghost: Element, detail: Element, dependencyLines: readonly Element[]): MotionTimeline {
  const timeline = gsap.timeline({ paused: true });
  timeline.to(ghost, { y: -6, duration: motionTokens.duration.fast / 1000, ease: motionTokens.easing.out });
  if (dependencyLines.length) timeline.to(dependencyLines, { opacity: 1, duration: motionTokens.duration.fast / 1000 }, 0);
  timeline.to(detail, { opacity: 1, y: 0, duration: motionTokens.duration.base / 1000, ease: motionTokens.easing.out }, 0);
  return {
    timeline,
    reducedForm: () => gsap.timeline({ paused: true }).to([ghost, detail, ...dependencyLines], {
      opacity: 1,
      duration: motionTokens.duration.fast / 1000,
    }),
  };
}

export function createRoomDoorTimeline(door: Element, camera: Element, open: boolean): MotionTimeline {
  const timeline = gsap.timeline({ paused: true });
  timeline.to(door, {
    rotateY: open ? houseConfig.roomDoorRotation : 0,
    duration: (open ? motionTokens.duration.set / 2 : motionTokens.duration.slow + motionTokens.duration.fast) / 1000,
    ease: motionTokens.easing.door,
    transformOrigin: 'left center',
  });
  timeline.to(camera, {
    scale: open ? houseConfig.roomCameraScale : 1,
    duration: (open ? motionTokens.duration.set * 2 / 3 : motionTokens.duration.set * 5 / 12) / 1000,
    ease: motionTokens.easing.inOut,
  }, 0);
  return {
    timeline,
    reducedForm: () => {
      const reduced = gsap.timeline({ paused: true });
      reduced.set(door, { rotateY: open ? houseConfig.roomDoorRotation : 0 }, 0);
      reduced.set(camera, { scale: open ? houseConfig.roomCameraScale : 1 }, 0);
      reduced.to([door, camera], { opacity: 1, duration: motionTokens.duration.fast / 1000 });
      return reduced;
    },
  };
}
