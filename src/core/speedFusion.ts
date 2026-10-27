/**
 * Speed reconstruction by fusing the longitudinal accelerometer (high rate, drifts)
 * with GPS speed (≈1 Hz, unbiased). Kalman filter on [speed, accelerometer bias],
 * followed by a Rauch–Tung–Striebel smoother: the session is processed after the
 * fact, so each instant uses the GPS fixes both before and after it.
 */
export interface SpeedMeasurement {
  /** Grid index the measurement applies to. */
  index: number;
  speed: number;
  /** Standard deviation of the measurement, m/s. */
  sigma: number;
}

export interface FusionOptions {
  /** Accelerometer noise density driving the speed (m/s² per √Hz-ish, tuned empirically). */
  accelNoise?: number;
  /** Random walk of the bias (m/s³). */
  biasNoise?: number;
}

/**
 * @param dt Grid step, seconds.
 * @param accel Longitudinal acceleration on the grid, m/s².
 * @param measurements Sorted by index.
 * @returns Smoothed speed (m/s, clamped ≥ 0) on the grid.
 */
export function fuseSpeed(
  dt: number,
  accel: ArrayLike<number>,
  measurements: readonly SpeedMeasurement[],
  options: FusionOptions = {},
): Float64Array {
  const n = accel.length;
  const out = new Float64Array(n);
  if (n === 0) return out;
  const qa = (options.accelNoise ?? 0.6) ** 2 * dt;
  const qb = (options.biasNoise ?? 0.02) ** 2 * dt;

  // Filtered (post) and predicted (prior) states and covariances [p00, p01, p11].
  const xv = new Float64Array(n);
  const xb = new Float64Array(n);
  const P = new Float64Array(n * 3);
  const pv = new Float64Array(n);
  const pb = new Float64Array(n);
  const PP = new Float64Array(n * 3);

  const first = measurements[0];
  let v = first ? first.speed : 0;
  let b = 0;
  let p00 = first ? first.sigma ** 2 : 25;
  let p01 = 0;
  let p11 = 0.25;
  let mi = 0;

  for (let k = 0; k < n; k++) {
    if (k > 0) {
      // x_k = F x_{k-1} + B a, with F = [[1, -dt], [0, 1]]
      v = v + (accel[k - 1] - b) * dt;
      const n00 = p00 - 2 * dt * p01 + dt * dt * p11 + qa;
      const n01 = p01 - dt * p11;
      const n11 = p11 + qb;
      p00 = n00;
      p01 = n01;
      p11 = n11;
    }
    pv[k] = v;
    pb[k] = b;
    PP[k * 3] = p00;
    PP[k * 3 + 1] = p01;
    PP[k * 3 + 2] = p11;

    while (mi < measurements.length && measurements[mi].index === k) {
      const m = measurements[mi++];
      const s = p00 + m.sigma ** 2;
      const k0 = p00 / s;
      const k1 = p01 / s;
      const innovation = m.speed - v;
      v += k0 * innovation;
      b += k1 * innovation;
      const n00 = (1 - k0) * p00;
      const n01 = (1 - k0) * p01;
      const n11 = p11 - k1 * p01;
      p00 = n00;
      p01 = n01;
      p11 = n11;
    }
    while (mi < measurements.length && measurements[mi].index < k) mi++;

    xv[k] = v;
    xb[k] = b;
    P[k * 3] = p00;
    P[k * 3 + 1] = p01;
    P[k * 3 + 2] = p11;
  }

  // RTS smoother: x_k^s = x_k + C (x_{k+1}^s - x_{k+1}^-), C = P_k Fᵀ (P_{k+1}^-)^-1
  let sv = xv[n - 1];
  let sb = xb[n - 1];
  out[n - 1] = Math.max(0, sv);
  for (let k = n - 2; k >= 0; k--) {
    const a00 = P[k * 3];
    const a01 = P[k * 3 + 1];
    const a11 = P[k * 3 + 2];
    // P_k Fᵀ
    const c00 = a00 - dt * a01;
    const c01 = a01;
    const c10 = a01 - dt * a11;
    const c11 = a11;
    // inverse of predicted covariance at k+1
    const q00 = PP[(k + 1) * 3];
    const q01 = PP[(k + 1) * 3 + 1];
    const q11 = PP[(k + 1) * 3 + 2];
    const det = q00 * q11 - q01 * q01;
    if (Math.abs(det) < 1e-12) {
      sv = xv[k];
      sb = xb[k];
    } else {
      const i00 = q11 / det;
      const i01 = -q01 / det;
      const i11 = q00 / det;
      const g00 = c00 * i00 + c01 * i01;
      const g01 = c00 * i01 + c01 * i11;
      const g10 = c10 * i00 + c11 * i01;
      const g11 = c10 * i01 + c11 * i11;
      const dv = sv - pv[k + 1];
      const db = sb - pb[k + 1];
      sv = xv[k] + g00 * dv + g01 * db;
      sb = xb[k] + g10 * dv + g11 * db;
    }
    out[k] = Math.max(0, sv);
  }
  return out;
}
