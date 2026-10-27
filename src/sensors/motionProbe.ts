import { DeviceMotion } from 'expo-sensors';

import { deltas, eventRate, median, RingBuffer } from '@/core/stats';

export type Vec3 = { x: number; y: number; z: number };

export interface MotionSnapshot {
  samples: number;
  /** Events per second actually received in JS (last second). */
  rateHz: number | null;
  /** Median gap between native timestamps, in the raw native unit (not documented by Expo). */
  medianNativeDelta: number | null;
  lastNativeTimestamp: number | null;
  /** `interval` field reported by expo-sensors (ms). */
  reportedIntervalMs: number | null;
  /** m/s², gravity removed (may be null on some devices). */
  acceleration: Vec3 | null;
  /** m/s², gravity included. */
  accelerationIncludingGravity: Vec3 | null;
  /** Raw rotation values (unit not documented by Expo). */
  rotation: { alpha: number; beta: number; gamma: number } | null;
}

const EMPTY: MotionSnapshot = {
  samples: 0,
  rateHz: null,
  medianNativeDelta: null,
  lastNativeTimestamp: null,
  reportedIntervalMs: null,
  acceleration: null,
  accelerationIncludingGravity: null,
  rotation: null,
};

/**
 * Diagnostic listener on DeviceMotion. Events are stored in plain mutable state
 * (never React state); the UI pulls a snapshot at its own pace.
 */
export function startMotionProbe(requestedIntervalMs: number) {
  const arrivals = new RingBuffer(400);
  const nativeTimes = new RingBuffer(200);
  let latest: MotionSnapshot = { ...EMPTY };

  DeviceMotion.setUpdateInterval(requestedIntervalMs);
  const subscription = DeviceMotion.addListener((m) => {
    arrivals.push(performance.now());
    const ts = m.accelerationIncludingGravity?.timestamp ?? null;
    if (ts !== null) nativeTimes.push(ts);
    latest = {
      ...latest,
      samples: latest.samples + 1,
      lastNativeTimestamp: ts,
      reportedIntervalMs: m.interval ?? null,
      acceleration: m.acceleration ? { x: m.acceleration.x, y: m.acceleration.y, z: m.acceleration.z } : null,
      accelerationIncludingGravity: m.accelerationIncludingGravity
        ? {
            x: m.accelerationIncludingGravity.x,
            y: m.accelerationIncludingGravity.y,
            z: m.accelerationIncludingGravity.z,
          }
        : null,
      rotation: m.rotation ? { alpha: m.rotation.alpha, beta: m.rotation.beta, gamma: m.rotation.gamma } : null,
    };
  });

  return {
    snapshot(): MotionSnapshot {
      return {
        ...latest,
        rateHz: eventRate(arrivals.values(), performance.now(), 1000),
        medianNativeDelta: median(deltas(nativeTimes.values())),
      };
    },
    stop() {
      subscription.remove();
    },
  };
}
