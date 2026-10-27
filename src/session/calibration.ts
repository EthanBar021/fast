import type { Vec3 } from '@/sensors/motionProbe';

/**
 * Calibration at rest, from real DeviceMotion samples:
 * - gravity direction → tilt of the phone, defines "up";
 * - stillness check (no vibration or handling);
 * - imposed mounting (portrait, screen facing the driver) → assumed forward axis.
 *
 * The forward direction cannot be measured at rest; it is assumed from the mounting
 * here and verified/corrected later from GPS during processing.
 */
export type { Vec3 };

export interface VehicleBasis {
  /** Unit vectors, in phone coordinates. */
  up: Vec3;
  forward: Vec3;
  left: Vec3;
}

export interface CalibrationResult {
  basis: VehicleBasis;
  /** Mean gravity reading at rest (m/s², phone coordinates). */
  gravity: Vec3;
  /** Largest per-axis standard deviation during the window (m/s²). */
  noise: number;
  /** Angle between the phone's long axis and vertical (0 = perfectly upright). */
  tiltDeg: number;
  samples: number;
}

export type CalibrationFailure = 'unstable' | 'orientation' | 'sensor';

export interface MotionSample {
  t: number;
  /** accelerationIncludingGravity, m/s² */
  incl: Vec3;
  /** acceleration (gravity removed), m/s², may be null */
  user: Vec3 | null;
}

export const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
export const norm = (a: Vec3) => Math.sqrt(dot(a, a));
export const scale = (a: Vec3, k: number): Vec3 => ({ x: a.x * k, y: a.y * k, z: a.z * k });
export const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
export const unit = (a: Vec3): Vec3 => scale(a, 1 / (norm(a) || 1));

/** Gravity part of a sample (direction of "up" in the convention of the sensor). */
export function gravityOf(s: Pick<MotionSample, 'incl' | 'user'>): Vec3 {
  return s.user ? sub(s.incl, s.user) : s.incl;
}

/** Thresholds, m/s². */
const MAX_AXIS_STD = 0.12;
const JOLT = 0.6;
const GRAVITY_TOLERANCE = 0.8;
/** |g·y| / |g| below this means the phone is not mounted in portrait. */
const MIN_PORTRAIT_RATIO = 0.6;

export function buildBasis(gravity: Vec3): VehicleBasis {
  const up = unit(gravity);
  // Screen faces the driver → the back of the phone (−z) points forward.
  const back: Vec3 = { x: 0, y: 0, z: -1 };
  let forward = sub(back, scale(up, dot(back, up)));
  if (norm(forward) < 0.2) {
    // Phone almost flat: fall back to the top of the phone as forward.
    const top: Vec3 = { x: 0, y: 1, z: 0 };
    forward = sub(top, scale(up, dot(top, up)));
  }
  forward = unit(forward);
  return { up, forward, left: unit(cross(up, forward)) };
}

export function analyzeWindow(
  samples: readonly MotionSample[],
): { ok: true; result: CalibrationResult } | { ok: false; reason: CalibrationFailure | 'noisy' } {
  const n = samples.length;
  if (n < 20) return { ok: false, reason: 'noisy' };
  const mean = { x: 0, y: 0, z: 0 };
  const g = { x: 0, y: 0, z: 0 };
  for (const s of samples) {
    mean.x += s.incl.x / n;
    mean.y += s.incl.y / n;
    mean.z += s.incl.z / n;
    const gs = gravityOf(s);
    g.x += gs.x / n;
    g.y += gs.y / n;
    g.z += gs.z / n;
  }
  let vx = 0;
  let vy = 0;
  let vz = 0;
  for (const s of samples) {
    vx += (s.incl.x - mean.x) ** 2 / n;
    vy += (s.incl.y - mean.y) ** 2 / n;
    vz += (s.incl.z - mean.z) ** 2 / n;
  }
  const noise = Math.sqrt(Math.max(vx, vy, vz));
  if (noise > MAX_AXIS_STD) return { ok: false, reason: 'noisy' };
  const gNorm = norm(g);
  if (Math.abs(gNorm - 9.80665) > GRAVITY_TOLERANCE) return { ok: false, reason: 'sensor' };
  if (Math.abs(g.y) / gNorm < MIN_PORTRAIT_RATIO) return { ok: false, reason: 'orientation' };
  const tiltDeg = (Math.acos(Math.min(1, Math.abs(g.y) / gNorm)) * 180) / Math.PI;
  return { ok: true, result: { basis: buildBasis(g), gravity: g, noise, tiltDeg, samples: n } };
}

export type CollectorStatus =
  | { phase: 'collecting'; progress: number; restarts: number }
  | { phase: 'done'; result: CalibrationResult }
  | { phase: 'failed'; reason: CalibrationFailure };

/**
 * Accumulates samples until the phone has been still for `windowMs`.
 * Any jolt restarts the window; after `timeoutMs` without a still window it fails.
 */
export class CalibrationCollector {
  private window: MotionSample[] = [];
  private startedAt: number | null = null;
  private windowStart = 0;
  private restarts = 0;
  private finished: CollectorStatus | null = null;

  constructor(
    private readonly windowMs = 2000,
    private readonly timeoutMs = 10000,
  ) {}

  push(sample: MotionSample): CollectorStatus {
    if (this.finished) return this.finished;
    if (this.startedAt === null) {
      this.startedAt = sample.t;
      this.windowStart = sample.t;
    }
    if (this.window.length > 0) {
      const ref = this.window[0].incl;
      if (norm(sub(sample.incl, ref)) > JOLT) this.restart(sample.t);
    }
    this.window.push(sample);

    const elapsed = sample.t - this.windowStart;
    if (elapsed >= this.windowMs) {
      const analysis = analyzeWindow(this.window);
      if (analysis.ok) return (this.finished = { phase: 'done', result: analysis.result });
      if (analysis.reason === 'orientation' || analysis.reason === 'sensor') {
        return (this.finished = { phase: 'failed', reason: analysis.reason });
      }
      this.restart(sample.t);
      this.window.push(sample);
    }
    if (sample.t - this.startedAt >= this.timeoutMs) return (this.finished = { phase: 'failed', reason: 'unstable' });
    return { phase: 'collecting', progress: Math.min(1, (sample.t - this.windowStart) / this.windowMs), restarts: this.restarts };
  }

  private restart(t: number) {
    this.window = [];
    this.windowStart = t;
    this.restarts++;
  }
}

/** Angle between two vectors, degrees. */
export function angleDeg(a: Vec3, b: Vec3): number {
  const c = dot(a, b) / ((norm(a) || 1) * (norm(b) || 1));
  return (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;
}
