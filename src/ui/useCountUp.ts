import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'react-native-reanimated';

/** easeOutExpo: fast start, long soft landing — reads like a counter settling. */
function easeOut(t: number) {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

/**
 * Animates a number from 0 (first time) or from its previous value to `target`.
 * Driven by requestAnimationFrame, meant for a handful of numbers on screen;
 * instant when Reduce Motion is on.
 */
export function useCountUp(target: number, duration = 900, delay = 0): number {
  const reduceMotion = useReducedMotion();
  const [value, setValue] = useState(0);
  const shown = useRef(0);

  useEffect(() => {
    const from = shown.current;
    const animate = !reduceMotion && Number.isFinite(target) && from !== target;
    let start: number | null = null;
    let frame = 0;
    const tick = (now: number) => {
      if (start === null) start = now + delay;
      const t = animate ? Math.max(0, (now - start) / duration) : 1;
      const v = from + (target - from) * easeOut(t);
      shown.current = v;
      setValue(v);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration, delay, reduceMotion]);

  return value;
}
