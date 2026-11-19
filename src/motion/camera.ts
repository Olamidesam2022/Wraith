'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { houseConfig } from '../config';
import { motionTokens } from './tokens';
import { useReducedMotion } from './reducedMotion';

export interface CameraTransform { x: number; y: number; scale: number }

export function useHouseCamera() {
  const [camera, setCamera] = useState<CameraTransform>({ x: 0, y: 0, scale: 1 });
  const reduced = useReducedMotion();
  const points = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ x: number; y: number; startX: number; startY: number; distance: number; scale: number; velocityX: number; velocityY: number } | null>(null);
  const inertiaFrame = useRef(0);
  const clampScale = (scale: number) => Math.min(houseConfig.cameraMaxScale, Math.max(houseConfig.cameraMinScale, scale));
  const zoom = useCallback((delta: number) => setCamera((value) => ({ ...value, scale: clampScale(value.scale + delta) })), []);
  const reset = useCallback(() => setCamera({ x: 0, y: 0, scale: 1 }), []);
  const setScale = useCallback((scale: number) => setCamera((value) => ({ ...value, scale: clampScale(scale) })), []);
  const distanceBetweenPointers = () => {
    const values = [...points.current.values()];
    if (values.length < 2) return houseConfig.cameraPinchMinimumDistance;
    return Math.max(houseConfig.cameraPinchMinimumDistance, Math.hypot(values[0].x - values[1].x, values[0].y - values[1].y));
  };
  const onPointerDown = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    if ((event.target as HTMLElement).closest('.house-marker')) return;
    cancelAnimationFrame(inertiaFrame.current);
    points.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    drag.current = { x: event.clientX, y: event.clientY, startX: camera.x, startY: camera.y, distance: distanceBetweenPointers(), scale: camera.scale, velocityX: 0, velocityY: 0 };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [camera.x, camera.y]);
  const onPointerMove = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (!drag.current) return;
    drag.current.velocityX = event.clientX - drag.current.x;
    drag.current.velocityY = event.clientY - drag.current.y;
    points.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (points.current.size > 1) {
      const currentDistance = distanceBetweenPointers();
      setCamera((value) => ({ ...value, scale: clampScale(drag.current!.scale * currentDistance / drag.current!.distance) }));
      return;
    }
    setCamera((value) => ({ ...value, x: drag.current!.startX + event.clientX - drag.current!.x, y: drag.current!.startY + event.clientY - drag.current!.y }));
  }, []);
  const onPointerUp = useCallback((event: React.PointerEvent<HTMLElement>) => {
    const velocity = drag.current ? { x: drag.current.velocityX, y: drag.current.velocityY } : { x: 0, y: 0 };
    points.current.delete(event.pointerId);
    drag.current = null;
    if (reduced || points.current.size > 0) return;
    let frame = 0;
    const coast = () => {
      frame += 1;
      setCamera((value) => ({ ...value, x: value.x + velocity.x, y: value.y + velocity.y }));
      velocity.x *= houseConfig.cameraInertiaDecay;
      velocity.y *= houseConfig.cameraInertiaDecay;
      if (frame < houseConfig.cameraInertiaFrames && Math.abs(velocity.x) + Math.abs(velocity.y) > houseConfig.cameraInertiaMinimumSpeed) {
        inertiaFrame.current = requestAnimationFrame(coast);
      }
    };
    if (Math.abs(velocity.x) + Math.abs(velocity.y) > houseConfig.cameraInertiaMinimumSpeed) inertiaFrame.current = requestAnimationFrame(coast);
  }, [reduced]);
  const onWheel = useCallback((event: React.WheelEvent<HTMLElement>) => {
    if (event.ctrlKey || event.deltaY !== 0) zoom(event.deltaY < 0 ? houseConfig.cameraWheelStep : -houseConfig.cameraWheelStep);
  }, [zoom]);
  const onKeyDown = useCallback((event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === '+' || event.key === '=') zoom(houseConfig.cameraKeyStep);
    if (event.key === '-') zoom(-houseConfig.cameraKeyStep);
    if (event.key === 'ArrowLeft') setCamera((value) => ({ ...value, x: value.x + houseConfig.cameraPanStep }));
    if (event.key === 'ArrowRight') setCamera((value) => ({ ...value, x: value.x - houseConfig.cameraPanStep }));
    if (event.key === 'ArrowUp') setCamera((value) => ({ ...value, y: value.y + houseConfig.cameraPanStep }));
    if (event.key === 'ArrowDown') setCamera((value) => ({ ...value, y: value.y - houseConfig.cameraPanStep }));
    if (event.key.toLowerCase() === 'r') reset();
  }, [reset, zoom]);
  useEffect(() => { if (reduced) reset(); }, [reduced, reset]);
  useEffect(() => () => cancelAnimationFrame(inertiaFrame.current), []);
  return {
    camera,
    style: {
      transform: `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.scale})`,
      transition: reduced ? `transform ${motionTokens.duration.fast}ms ${motionTokens.easing.out}` : 'none',
      transformOrigin: 'center center',
    },
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onWheel, onKeyDown },
    zoom,
    setScale,
    reset,
  };
}
