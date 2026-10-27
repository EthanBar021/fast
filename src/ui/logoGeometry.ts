/**
 * Geometry of the Fast logo: a tachometer, needle resting at the rev limiter.
 * viewBox 0 0 200 200, center (100, 100). Angles in degrees, SVG convention
 * (0° = right, clockwise). The dial sweeps 270° from bottom-left to bottom-right.
 */
export const LOGO = {
  cx: 100,
  cy: 100,
  radius: 84,
  startDeg: 135,
  sweepDeg: 270,
  /** Start of the red zone, as a fraction of the sweep. */
  redline: 0.8,
  /** Needle position at rest, inside the red zone. */
  needle: 0.83,
  /** Major graduations (0 … 8 ×1000 rpm). */
  majors: 8,
  minorsPerMajor: 5,
} as const;

export function angleAt(f: number): number {
  return LOGO.startDeg + LOGO.sweepDeg * f;
}

export function point(deg: number, r: number) {
  const a = (deg * Math.PI) / 180;
  return { x: LOGO.cx + r * Math.cos(a), y: LOGO.cy + r * Math.sin(a) };
}

/** SVG arc path along the dial between fractions `from` and `to`. */
export function arcPath(from: number, to: number, r: number = LOGO.radius): string {
  const a = point(angleAt(from), r);
  const b = point(angleAt(to), r);
  const large = LOGO.sweepDeg * (to - from) > 180 ? 1 : 0;
  return `M${a.x.toFixed(2)} ${a.y.toFixed(2)} A${r} ${r} 0 ${large} 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
}

export interface Tick {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  major: boolean;
  red: boolean;
}

/** Graduations: majors every 1/8, minors in between; red ones beyond the redline. */
export function ticks(): Tick[] {
  const count = LOGO.majors * LOGO.minorsPerMajor;
  return Array.from({ length: count + 1 }, (_, i) => {
    const f = i / count;
    const major = i % LOGO.minorsPerMajor === 0;
    const outer = point(angleAt(f), LOGO.radius - 6);
    const inner = point(angleAt(f), LOGO.radius - (major ? 19 : 12));
    return { x1: outer.x, y1: outer.y, x2: inner.x, y2: inner.y, major, red: f >= LOGO.redline - 1e-9 };
  });
}

/** Numeral positions for the majors (0 … 8). */
export function numerals(): { x: number; y: number; label: string; red: boolean }[] {
  return Array.from({ length: LOGO.majors + 1 }, (_, i) => {
    const f = i / LOGO.majors;
    const p = point(angleAt(f), LOGO.radius - 31);
    return { x: p.x, y: p.y + 4, label: String(i), red: f >= LOGO.redline };
  });
}

/**
 * Tapered needle pointing at the start of the dial (rotate it around the center
 * by `sweepDeg × fraction`). Returns the polygon and the red tip polygon.
 */
export function needlePolygons(): { body: string; tip: string } {
  const a = (angleAt(0) * Math.PI) / 180;
  const dir = { x: Math.cos(a), y: Math.sin(a) };
  const nrm = { x: -dir.y, y: dir.x };
  const at = (along: number, half: number) =>
    `${(LOGO.cx + dir.x * along + nrm.x * half).toFixed(2)},${(LOGO.cy + dir.y * along + nrm.y * half).toFixed(2)}`;
  const tail = -16;
  const tipStart = LOGO.radius - 26;
  const tip = LOGO.radius - 8;
  return {
    body: [at(tail, 2.6), at(tipStart, 1.5), at(tipStart, -1.5), at(tail, -2.6)].join(' '),
    tip: [at(tipStart, 1.5), at(tip, 0.6), at(tip, -0.6), at(tipStart, -1.5)].join(' '),
  };
}
