import { kmhToMs } from '@/core/units';
import type { SessionSeries } from '@/models/session';

export type MapFilter = 'route' | 'speed' | 'g';

export type ColorStop = { at: number; color: string };

/** Fixed speed scale: absolute, not relative to the session. */
export const SPEED_SCALE_MAX_MS = kmhToMs(250);

/** 0 km/h cyan · 90 yellow · 170 orange · ≥ 250 vivid red. */
export const SPEED_STOPS: ColorStop[] = [
  { at: 0, color: '#4FC3F7' },
  { at: 90 / 250, color: '#FFD54F' },
  { at: 170 / 250, color: '#FF8A1F' },
  { at: 1, color: '#FF1A1A' },
];

/** G: light red → very dark red, relative to the session peak. */
export const G_STOPS: ColorStop[] = [
  { at: 0, color: '#FFC9C4' },
  { at: 0.5, color: '#E2453A' },
  { at: 1, color: '#7A0A06' },
];

export const ROUTE_COLOR = '#F5F5F7';

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Piecewise-linear color scale over positioned stops, f ∈ [0, 1] (clamped). */
export function scaleColor(stops: readonly ColorStop[], f: number): string {
  const x = Math.min(1, Math.max(0, Number.isFinite(f) ? f : 0));
  let i = 0;
  while (i < stops.length - 2 && x > stops[i + 1].at) i++;
  const a = stops[i];
  const b = stops[i + 1];
  const u = b.at > a.at ? Math.min(1, Math.max(0, (x - a.at) / (b.at - a.at))) : 0;
  const ca = hexToRgb(a.color);
  const cb = hexToRgb(b.color);
  const c = ca.map((v, k) => Math.round(v + (cb[k] - v) * u));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** Colors for a CSS/LinearGradient legend. */
export function gradientOf(stops: readonly ColorStop[]) {
  return { colors: stops.map((s) => s.color), locations: stops.map((s) => s.at) };
}

/** Indices kept for the map polyline (max `maxPoints`, first and last included). */
export function polylineIndices(length: number, maxPoints = 800): number[] {
  if (length <= maxPoints) return Array.from({ length }, (_, i) => i);
  const step = (length - 1) / (maxPoints - 1);
  return Array.from({ length: maxPoints }, (_, i) => Math.round(i * step));
}

export type LatLng = { latitude: number; longitude: number };

export interface ColoredRoute {
  coordinates: LatLng[];
  /**
   * Colored pieces of the route, each drawn as its own single-color polyline.
   * (A single polyline with per-point `strokeColors` is only applied by iOS when
   * the overlay is first rendered, which caused colors to appear late.)
   */
  segments: { coordinates: LatLng[]; color: string }[] | null;
  /** Value range for the legend, in SI units (m/s or m/s²). */
  range: [number, number] | null;
}

/** Points per colored segment: ~130 segments for a full-length route. */
const SEGMENT_POINTS = 6;

function segmentsOf(coordinates: LatLng[], values: number[], toColor: (v: number) => string) {
  const out: { coordinates: LatLng[]; color: string }[] = [];
  for (let i = 0; i < coordinates.length - 1; i += SEGMENT_POINTS) {
    const end = Math.min(coordinates.length - 1, i + SEGMENT_POINTS);
    let sum = 0;
    for (let k = i; k <= end; k++) sum += values[k];
    // Shares its last point with the next segment so the line stays continuous.
    out.push({ coordinates: coordinates.slice(i, end + 1), color: toColor(sum / (end - i + 1)) });
  }
  return out;
}

export function colorRoute(series: SessionSeries, filter: MapFilter, maxPoints = 800): ColoredRoute {
  const idx = polylineIndices(series.t.length, maxPoints);
  const coordinates = idx.map((i) => ({ latitude: series.latitude[i], longitude: series.longitude[i] }));
  if (filter === 'route') return { coordinates, segments: null, range: null };
  if (filter === 'speed') {
    const values = idx.map((i) => series.speed[i]);
    return {
      coordinates,
      segments: segmentsOf(coordinates, values, (v) => scaleColor(SPEED_STOPS, v / SPEED_SCALE_MAX_MS)),
      range: [0, SPEED_SCALE_MAX_MS],
    };
  }
  const values = idx.map((i) => Math.hypot(series.long[i], series.lat[i]));
  const max = Math.max(...values, 1e-6);
  return { coordinates, segments: segmentsOf(coordinates, values, (v) => scaleColor(G_STOPS, v / max)), range: [0, max] };
}
