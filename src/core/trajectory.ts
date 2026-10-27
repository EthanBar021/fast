import type { XY } from './geo';

/** Catmull–Rom point between p1 and p2 at u ∈ [0, 1]. */
function catmullRom(p0: XY, p1: XY, p2: XY, p3: XY, u: number): XY {
  const u2 = u * u;
  const u3 = u2 * u;
  const f = (a: number, b: number, c: number, d: number) =>
    0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3);
  return { x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) };
}

/**
 * Places each grid instant along the smoothed GPS path.
 *
 * Between two fixes, the position advances according to the fused distance
 * travelled (not linearly in time), so braking and acceleration between fixes
 * are reflected on the map. The curve itself is a Catmull–Rom spline through the fixes.
 *
 * @param fixT Fix times (ms), ascending.
 * @param fixXY Fix positions (local meters).
 * @param gridT Grid times (ms).
 * @param gridDist Cumulative fused distance on the grid (m).
 */
export function placeAlongPath(
  fixT: readonly number[],
  fixXY: readonly XY[],
  gridT: ArrayLike<number>,
  gridDist: ArrayLike<number>,
): XY[] {
  const out: XY[] = new Array(gridT.length);
  const n = fixT.length;
  if (n === 0) return out.fill({ x: 0, y: 0 });
  if (n === 1) return out.fill(fixXY[0]);

  // Fused distance at each fix time.
  const distAt = (t: number) => {
    let lo = 0;
    let hi = gridT.length - 1;
    if (t <= gridT[0]) return gridDist[0];
    if (t >= gridT[hi]) return gridDist[hi];
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (gridT[mid] <= t) lo = mid;
      else hi = mid;
    }
    const f = (t - gridT[lo]) / (gridT[hi] - gridT[lo]);
    return gridDist[lo] + f * (gridDist[hi] - gridDist[lo]);
  };
  const fixDist = fixT.map(distAt);

  let seg = 0;
  for (let i = 0; i < gridT.length; i++) {
    const t = gridT[i];
    while (seg < n - 2 && fixT[seg + 1] <= t) seg++;
    if (t <= fixT[0]) {
      out[i] = fixXY[0];
      continue;
    }
    if (t >= fixT[n - 1]) {
      out[i] = fixXY[n - 1];
      continue;
    }
    const d0 = fixDist[seg];
    const d1 = fixDist[seg + 1];
    const span = d1 - d0;
    // Fall back to time when the fused distance is flat (vehicle stopped, or no data).
    let u = span > 0.05 ? (gridDist[i] - d0) / span : (t - fixT[seg]) / (fixT[seg + 1] - fixT[seg]);
    u = Math.min(1, Math.max(0, u));
    const p0 = fixXY[Math.max(0, seg - 1)];
    const p3 = fixXY[Math.min(n - 1, seg + 2)];
    out[i] = catmullRom(p0, fixXY[seg], fixXY[seg + 1], p3, u);
  }
  return out;
}
