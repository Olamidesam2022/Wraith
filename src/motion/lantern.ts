'use client';

import { useEffect, useRef, useState } from 'react';
import { houseConfig } from '../config';
import { motionTokens } from './tokens';
import { useReducedMotion } from './reducedMotion';

export function useCursorLantern(enabled = true) {
  const ref = useRef<SVGCircleElement>(null);
  const reduced = useReducedMotion();
  const [active, setActive] = useState(false);

  useEffect(() => {
    const element = ref.current;
    const frame = element?.closest('.house-scroll-frame');
    if (!element || !frame || !enabled || reduced) return;
    let raf = 0;
    let currentX = 0;
    let currentY = 0;
    let targetX = currentX;
    let targetY = currentY;
    const smooth = 1 - Math.exp(-houseConfig.animationFrameMs / houseConfig.lanternSmoothingMs);
    const track = (x: number, y: number) => {
      const bounds = frame.getBoundingClientRect();
      if (x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom) { setActive(false); return; }
      setActive(true);
      const svg = element.ownerSVGElement;
      const viewBox = svg?.viewBox.baseVal;
      targetX = (x - bounds.left) * ((viewBox?.width ?? bounds.width) / bounds.width);
      targetY = (y - bounds.top) * ((viewBox?.height ?? bounds.height) / bounds.height);
      if (!raf) raf = requestAnimationFrame(draw);
    };
    const draw = () => {
      currentX += (targetX - currentX) * smooth;
      currentY += (targetY - currentY) * smooth;
      element.style.transform = `translate(${currentX}px, ${currentY}px)`;
      if (Math.abs(targetX - currentX) > 1 || Math.abs(targetY - currentY) > 1) raf = requestAnimationFrame(draw);
      else raf = 0;
    };
    const move = (event: PointerEvent) => track(event.clientX, event.clientY);
    const tap = (event: TouchEvent) => { const point = event.touches[0]; if (point) track(point.clientX, point.clientY); };
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('touchstart', tap, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('touchstart', tap);
    };
  }, [enabled, reduced]);

  return { ref, active: enabled && !reduced && active };
}
