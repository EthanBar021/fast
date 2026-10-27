/**
 * Linear interpolation of an irregular series (t ascending) onto `grid`.
 * Values outside the source range are clamped to the first/last value.
 */
export function resampleLinear(t: ArrayLike<number>, v: ArrayLike<number>, grid: ArrayLike<number>): Float64Array {
  const out = new Float64Array(grid.length);
  if (t.length === 0) return out;
  let j = 0;
  for (let i = 0; i < grid.length; i++) {
    const g = grid[i];
    while (j < t.length - 2 && t[j + 1] < g) j++;
    if (g <= t[0]) out[i] = v[0];
    else if (g >= t[t.length - 1]) out[i] = v[t.length - 1];
    else {
      const span = t[j + 1] - t[j];
      const f = span > 0 ? (g - t[j]) / span : 0;
      out[i] = v[j] + f * (v[j + 1] - v[j]);
    }
  }
  return out;
}

/**
 * Average of the source samples whose time falls in each grid cell [g - step/2, g + step/2).
 * Cells with no sample are filled by linear interpolation. Used to downsample
 * high-rate accelerometer data without aliasing spikes.
 */
export function binAverage(t: ArrayLike<number>, v: ArrayLike<number>, grid: ArrayLike<number>, stepMs: number): Float64Array {
  const sums = new Float64Array(grid.length);
  const counts = new Uint32Array(grid.length);
  if (grid.length === 0) return sums;
  const g0 = grid[0];
  for (let i = 0; i < t.length; i++) {
    const k = Math.round((t[i] - g0) / stepMs);
    if (k >= 0 && k < grid.length) {
      sums[k] += v[i];
      counts[k]++;
    }
  }
  const knownT: number[] = [];
  const knownV: number[] = [];
  for (let k = 0; k < grid.length; k++) {
    if (counts[k] > 0) {
      knownT.push(grid[k]);
      knownV.push(sums[k] / counts[k]);
    }
  }
  return knownT.length === 0 ? sums : resampleLinear(knownT, knownV, grid);
}

/** Centered moving average over `window` samples (odd), edges use the available samples. */
export function movingAverage(v: ArrayLike<number>, window: number): Float64Array {
  const half = Math.max(0, Math.floor(window / 2));
  const out = new Float64Array(v.length);
  let sum = 0;
  let lo = 0;
  let hi = -1;
  for (let i = 0; i < v.length; i++) {
    const from = Math.max(0, i - half);
    const to = Math.min(v.length - 1, i + half);
    while (hi < to) sum += v[++hi];
    while (lo < from) sum -= v[lo++];
    out[i] = sum / (hi - lo + 1);
  }
  return out;
}
