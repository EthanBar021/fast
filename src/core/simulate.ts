import type { GpsFix, RawRecording } from '@/models/session';

import { makeProjection } from './geo';

/** Seedable PRNG (mulberry32) so simulated sessions and tests are reproducible. */
export function makeRng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // Box–Muller
  const gauss = () => {
    const u = Math.max(next(), 1e-12);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next());
  };
  return { next, gauss };
}

/** A driving phase: constant longitudinal acceleration and yaw rate (positive = left). */
export interface Phase {
  seconds: number;
  accel: number;
  yawRate: number;
}

/** Launch to ~100 km/h, braking, left and right corners, stop. */
export const DEMO_SCENARIO: Phase[] = [
  { seconds: 3, accel: 0, yawRate: 0 },
  { seconds: 8, accel: 3.5, yawRate: 0 },
  { seconds: 8, accel: 0, yawRate: 0 },
  { seconds: 3, accel: -6, yawRate: 0 },
  { seconds: 7, accel: 0, yawRate: 0.25 },
  { seconds: 6, accel: 2, yawRate: 0 },
  { seconds: 9, accel: 0, yawRate: -0.15 },
  { seconds: 4, accel: 0, yawRate: 0 },
  { seconds: 6, accel: -3.6, yawRate: 0 },
  { seconds: 3, accel: 0, yawRate: 0 },
];

export interface SimulationOptions {
  seed?: number;
  scenario?: Phase[];
  /** Phone mounting: yaw of the phone basis versus the vehicle, radians. */
  mountYaw?: number;
  /** Mirrors the phone lateral axis (unknown sign convention). */
  mirrored?: boolean;
  gpsIntervalMs?: number;
  gpsNoiseM?: number;
  /** Removes GPS fixes in [from, to] ms. */
  gpsGap?: { from: number; to: number };
  /** Reports speed as -1 (invalid) on every fix. */
  invalidGpsSpeed?: boolean;
  motionRateHz?: number;
  /** Disables the accelerometer stream. */
  noMotion?: boolean;
  origin?: { latitude: number; longitude: number };
}

export interface SimulationTruth {
  t: number[];
  speed: number[];
  long: number[];
  lat: number[];
  distanceM: number;
  maxSpeed: number;
}

/**
 * Generates a synthetic recording (GPS + accelerometer with noise, bias and an
 * arbitrary phone mounting) from a scenario. Used by the demo mode and the tests.
 */
export function simulateRecording(options: SimulationOptions = {}): { recording: RawRecording; truth: SimulationTruth } {
  const rng = makeRng(options.seed ?? 1);
  const scenario = options.scenario ?? DEMO_SCENARIO;
  const origin = options.origin ?? { latitude: 46.8641, longitude: 3.1633 };
  const projection = makeProjection(origin);
  const stepMs = 10;
  const yaw = options.mountYaw ?? 0;
  const mirror = options.mirrored ? -1 : 1;

  const truth: SimulationTruth = { t: [], speed: [], long: [], lat: [], distanceM: 0, maxSpeed: 0 };
  const pos: { x: number; y: number }[] = [];
  let v = 0;
  let heading = 0.6;
  let x = 0;
  let y = 0;
  let t = 0;
  for (const phase of scenario) {
    const steps = Math.round((phase.seconds * 1000) / stepMs);
    for (let s = 0; s < steps; s++) {
      const dt = stepMs / 1000;
      const accel = v <= 0 && phase.accel < 0 ? 0 : phase.accel;
      const yawRate = v > 0.5 ? phase.yawRate : 0;
      truth.t.push(t);
      truth.speed.push(v);
      truth.long.push(accel);
      truth.lat.push(v * yawRate);
      pos.push({ x, y });
      const nv = Math.max(0, v + accel * dt);
      const vm = (v + nv) / 2;
      x += vm * Math.cos(heading) * dt;
      y += vm * Math.sin(heading) * dt;
      truth.distanceM += vm * dt;
      heading += yawRate * dt;
      v = nv;
      truth.maxSpeed = Math.max(truth.maxSpeed, v);
      t += stepMs;
    }
  }
  const durationMs = t;

  // GPS fixes
  const gps: GpsFix[] = [];
  const interval = options.gpsIntervalMs ?? 1000;
  const noise = options.gpsNoiseM ?? 1.5;
  for (let ft = 300; ft < durationMs; ft += interval + rng.gauss() * 40) {
    if (options.gpsGap && ft >= options.gpsGap.from && ft <= options.gpsGap.to) continue;
    const k = Math.min(pos.length - 1, Math.round(ft / stepMs));
    const p = projection.toLatLon({ x: pos[k].x + rng.gauss() * noise, y: pos[k].y + rng.gauss() * noise });
    gps.push({
      t: Math.round(ft),
      latitude: p.latitude,
      longitude: p.longitude,
      speed: options.invalidGpsSpeed ? -1 : Math.max(0, truth.speed[k] + rng.gauss() * 0.25),
      accuracy: Math.max(3, noise * 3 + rng.gauss()),
    });
  }

  // Accelerometer, expressed in the phone's calibrated basis.
  const motion = { t: [] as number[], h1: [] as number[], h2: [] as number[], up: [] as number[] };
  if (!options.noMotion) {
    const rate = options.motionRateHz ?? 50;
    const every = Math.max(1, Math.round(1000 / rate / stepMs));
    const bias1 = 0.08;
    const bias2 = -0.05;
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    for (let k = 0; k < truth.t.length; k += every) {
      const vib = 0.12 * Math.sin(k * 0.9) + rng.gauss() * 0.18;
      const L = truth.long[k];
      const A = truth.lat[k];
      // Inverse of M = Rθ·diag(1, mirror): h = diag(1, mirror)·R(-θ)·[L, A]
      const h1 = c * L + s * A;
      const h2 = mirror * (-s * L + c * A);
      motion.t.push(truth.t[k] + rng.gauss() * 2);
      motion.h1.push(h1 + bias1 + vib);
      motion.h2.push(h2 + bias2 + rng.gauss() * 0.18);
      motion.up.push(rng.gauss() * 0.3);
    }
  }

  return {
    recording: {
      startedAt: Date.now(),
      durationMs,
      motion,
      gps,
      interruptions: [],
      maxTiltDriftDeg: 0,
      source: 'demo',
    },
    truth,
  };
}
