/**
 * Finds how the phone's horizontal axes map onto the vehicle's axes.
 *
 * Input pairs: phone horizontal acceleration (h1, h2) expressed in the basis built
 * at calibration, and the same moment's vehicle acceleration derived from GPS
 * (longitudinal = dv/dt, lateral = v·dψ/dt, positive to the left).
 *
 * We fit an orthogonal 2×2 matrix (rotation, or rotation + mirror) by least squares
 * (2-D Procrustes). The mirror case covers an unknown sign convention of the
 * accelerometer axes, so no assumption about Expo/iOS signs is needed.
 */
export interface AlignmentPair {
  h1: number;
  h2: number;
  long: number;
  lat: number;
}

export interface Alignment {
  /** Row-major 2×2: [long, lat] = M · [h1, h2]. */
  m: [number, number, number, number];
  mirrored: boolean;
  angleRad: number;
  /** Share of the GPS-derived acceleration variance explained by the fit (0..1). */
  r2: number;
  pairs: number;
}

export const IDENTITY_ALIGNMENT: Alignment = { m: [1, 0, 0, 1], mirrored: false, angleRad: 0, r2: 0, pairs: 0 };

function fitRotation(pairs: readonly AlignmentPair[], mirror: boolean) {
  // Rotation θ maximizing Σ g·(Rθ h'), with h' = h mirrored on h2 if requested.
  let dot = 0;
  let cross = 0;
  for (const p of pairs) {
    const h2 = mirror ? -p.h2 : p.h2;
    dot += p.h1 * p.long + h2 * p.lat;
    cross += p.h1 * p.lat - h2 * p.long;
  }
  const angle = Math.atan2(cross, dot);
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  // M = Rθ · diag(1, ±1)
  const m: [number, number, number, number] = mirror ? [c, s, s, -c] : [c, -s, s, c];
  let sse = 0;
  for (const p of pairs) {
    const long = m[0] * p.h1 + m[1] * p.h2;
    const lat = m[2] * p.h1 + m[3] * p.h2;
    sse += (long - p.long) ** 2 + (lat - p.lat) ** 2;
  }
  return { m, angle, sse };
}

export function fitAlignment(pairs: readonly AlignmentPair[]): Alignment {
  if (pairs.length === 0) return IDENTITY_ALIGNMENT;
  const a = fitRotation(pairs, false);
  const b = fitRotation(pairs, true);
  const best = b.sse < a.sse ? b : a;
  let sst = 0;
  for (const p of pairs) sst += p.long ** 2 + p.lat ** 2;
  return {
    m: best.m,
    mirrored: best === b,
    angleRad: best.angle,
    r2: sst > 0 ? Math.max(0, 1 - best.sse / sst) : 0,
    pairs: pairs.length,
  };
}

export function applyAlignment(al: Alignment, h1: number, h2: number): { long: number; lat: number } {
  return { long: al.m[0] * h1 + al.m[1] * h2, lat: al.m[2] * h1 + al.m[3] * h2 };
}
