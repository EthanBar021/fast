import * as Location from 'expo-location';

import { deltas, median, RingBuffer } from '@/core/stats';

export interface LocationSnapshot {
  fixes: number;
  /** m/s; null or negative values are reported as received (invalid speed). */
  speed: number | null;
  /** Horizontal accuracy radius in meters. */
  accuracy: number | null;
  /** Median time between fixes, ms (from GPS timestamps). */
  medianIntervalMs: number | null;
  /** Time since the last fix was received in JS, ms. */
  ageMs: number | null;
  error: string | null;
}

/**
 * Diagnostic GPS listener (foreground only). Coordinates are deliberately not kept.
 */
export function startLocationProbe() {
  const fixTimes = new RingBuffer(30);
  let fixes = 0;
  let speed: number | null = null;
  let accuracy: number | null = null;
  let lastArrival: number | null = null;
  let error: string | null = null;
  let stopped = false;
  let subscription: Location.LocationSubscription | null = null;

  Location.watchPositionAsync(
    { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 0 },
    (fix) => {
      fixes += 1;
      speed = fix.coords.speed;
      accuracy = fix.coords.accuracy;
      fixTimes.push(fix.timestamp);
      lastArrival = performance.now();
    },
    (reason) => {
      error = reason;
    },
  ).then(
    (sub) => {
      if (stopped) sub.remove();
      else subscription = sub;
    },
    (e: unknown) => {
      error = e instanceof Error ? e.message : String(e);
    },
  );

  return {
    snapshot(): LocationSnapshot {
      return {
        fixes,
        speed,
        accuracy,
        medianIntervalMs: median(deltas(fixTimes.values())),
        ageMs: lastArrival === null ? null : performance.now() - lastArrival,
        error,
      };
    },
    stop() {
      stopped = true;
      subscription?.remove();
    },
  };
}
