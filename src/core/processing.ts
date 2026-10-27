import type {
  AlignmentMethod,
  GpsFix,
  QualityLevel,
  RawRecording,
  SessionSeries,
  SessionSummary,
} from '@/models/session';

import { applyAlignment, fitAlignment, IDENTITY_ALIGNMENT, type Alignment, type AlignmentPair } from './alignment';
import { binAverage, movingAverage } from './filters';
import { distanceXY, makeProjection, wrapAngle, type XY } from './geo';
import { fuseSpeed, type SpeedMeasurement } from './speedFusion';
import { deltas, median } from './stats';
import { placeAlongPath } from './trajectory';

/** Output grid step (10 Hz). */
export const GRID_STEP_MS = 100;
/** Fixes with a worse accuracy radius are discarded. */
const MAX_FIX_ACCURACY_M = 50;
/** Below this speed the vehicle is considered stopped. */
export const MOVING_SPEED = 1;
/** Minimum speed to derive a heading / lateral acceleration from GPS. */
const HEADING_MIN_SPEED = 3;
/** Window used for peak values (smooths out single-sample spikes). */
const PEAK_WINDOW_MS = 500;
/** 360 km/h: anything faster is treated as a GPS error. */
export const MAX_PLAUSIBLE_SPEED = 100;
/** 1.5 g between two GPS speed measurements: beyond that, the measurement is an outlier. */
const MAX_PLAUSIBLE_ACCEL = 15;
/** Speeds derived from positions need fixes far enough apart in time. */
const MIN_DERIVED_SPEED_DT_S = 0.8;

export interface ProcessResult {
  summary: SessionSummary;
  series: SessionSeries;
  alignment: Alignment;
}

export function cleanFixes(gps: readonly GpsFix[], durationMs: number): GpsFix[] {
  const valid = gps
    .filter(
      (f) =>
        Number.isFinite(f.latitude) &&
        Number.isFinite(f.longitude) &&
        Number.isFinite(f.t) &&
        f.t >= -2000 &&
        f.t <= durationMs + 2000 &&
        (f.accuracy === null || f.accuracy <= MAX_FIX_ACCURACY_M),
    )
    .sort((a, b) => a.t - b.t);
  // Keep the last fix for duplicated timestamps.
  const out: GpsFix[] = [];
  for (const f of valid) {
    if (out.length > 0 && out[out.length - 1].t === f.t) out[out.length - 1] = f;
    else out.push(f);
  }
  return out;
}

function validSpeed(s: number | null): s is number {
  return s !== null && Number.isFinite(s) && s >= 0 && s <= MAX_PLAUSIBLE_SPEED;
}

/**
 * Drops "teleporting" fixes: the displacement from the last kept fix, minus both
 * accuracy radii, would require more than MAX_PLAUSIBLE_SPEED.
 */
export function rejectJumps(fixes: readonly GpsFix[], xy: readonly XY[]): number[] {
  const kept: number[] = [];
  for (let i = 0; i < fixes.length; i++) {
    const last = kept[kept.length - 1];
    if (last === undefined) {
      kept.push(i);
      continue;
    }
    const dt = (fixes[i].t - fixes[last].t) / 1000;
    const slack = (fixes[i].accuracy ?? 10) + (fixes[last].accuracy ?? 10);
    const d = Math.max(0, distanceXY(xy[last], xy[i]) - slack);
    if (dt > 0 && d / dt <= MAX_PLAUSIBLE_SPEED) kept.push(i);
  }
  return kept;
}

/**
 * GPS speed per fix: Doppler speed when valid, otherwise derived from the
 * neighbouring positions — only over a long enough interval, and as 0 when the
 * displacement is within the position uncertainty (typical when stopped, where
 * iOS reports no Doppler speed and positions wander by several meters).
 */
function fixSpeeds(fixes: readonly GpsFix[], xy: readonly XY[]): ({ speed: number; sigma: number } | null)[] {
  return fixes.map((f, i) => {
    const accuracyFactor = f.accuracy !== null && f.accuracy > 20 ? 2 : 1;
    if (validSpeed(f.speed)) return { speed: f.speed, sigma: 0.4 * accuracyFactor };
    const prev = i > 0 ? i - 1 : i;
    const next = i < fixes.length - 1 ? i + 1 : i;
    const dt = (fixes[next].t - fixes[prev].t) / 1000;
    if (prev === next || dt < MIN_DERIVED_SPEED_DT_S || dt > 5) return null;
    const uncertainty = (fixes[prev].accuracy ?? 10) + (fixes[next].accuracy ?? 10);
    const d = distanceXY(xy[prev], xy[next]);
    const sigma = Math.max(1, uncertainty / dt);
    return d <= uncertainty ? { speed: 0, sigma } : { speed: d / dt, sigma };
  });
}

/**
 * Rejects speed measurements implying an impossible acceleration versus the last
 * accepted one (allowing for both measurement uncertainties).
 */
export function gateMeasurements(measurements: readonly SpeedMeasurement[], stepS: number): SpeedMeasurement[] {
  const out: SpeedMeasurement[] = [];
  for (const m of measurements) {
    if (m.speed > MAX_PLAUSIBLE_SPEED) continue;
    const last = out[out.length - 1];
    if (last) {
      const dt = (m.index - last.index) * stepS;
      const allowed = MAX_PLAUSIBLE_ACCEL * Math.max(dt, stepS) + 2 * (m.sigma + last.sigma);
      if (Math.abs(m.speed - last.speed) > allowed) continue;
    }
    out.push(m);
  }
  return out;
}

function mean(values: ArrayLike<number>, from: number, to: number): number {
  let s = 0;
  let c = 0;
  for (let i = Math.max(0, from); i <= Math.min(values.length - 1, to); i++) {
    s += values[i];
    c++;
  }
  return c > 0 ? s / c : 0;
}

function inInterruption(t: number, interruptions: RawRecording['interruptions']): boolean {
  return interruptions.some((r) => t >= r.from - 1000 && t <= r.to + 1000);
}

/**
 * Builds pairs (phone horizontal acceleration ↔ GPS-derived vehicle acceleration)
 * around each fix where the heading is reliable.
 */
function alignmentPairs(
  fixes: readonly GpsFix[],
  xy: readonly XY[],
  speeds: ReturnType<typeof fixSpeeds>,
  h1: Float64Array,
  h2: Float64Array,
  rec: RawRecording,
): AlignmentPair[] {
  const pairs: AlignmentPair[] = [];
  for (let i = 1; i < fixes.length - 1; i++) {
    const a = fixes[i - 1];
    const b = fixes[i];
    const c = fixes[i + 1];
    const va = speeds[i - 1];
    const vb = speeds[i];
    const vc = speeds[i + 1];
    if (!va || !vb || !vc) continue;
    const span = (c.t - a.t) / 1000;
    if (span <= 0 || span > 4 || vb.speed < HEADING_MIN_SPEED) continue;
    if (inInterruption(b.t, rec.interruptions)) continue;
    const d1 = distanceXY(xy[i - 1], xy[i]);
    const d2 = distanceXY(xy[i], xy[i + 1]);
    if (d1 < 1.5 || d2 < 1.5) continue;
    const psi1 = Math.atan2(xy[i].y - xy[i - 1].y, xy[i].x - xy[i - 1].x);
    const psi2 = Math.atan2(xy[i + 1].y - xy[i].y, xy[i + 1].x - xy[i].x);
    const yawRate = wrapAngle(psi2 - psi1) / (span / 2);
    const long = (vc.speed - va.speed) / span;
    const lat = vb.speed * yawRate;
    // Average the phone acceleration over the same window as the GPS derivatives.
    const from = Math.round(a.t / GRID_STEP_MS);
    const to = Math.round(c.t / GRID_STEP_MS);
    pairs.push({ h1: mean(h1, from, to), h2: mean(h2, from, to), long, lat });
  }
  return pairs;
}

function cumulativeDistance(speed: Float64Array, dt: number): Float64Array {
  const out = new Float64Array(speed.length);
  for (let i = 1; i < speed.length; i++) out[i] = out[i - 1] + ((speed[i] + speed[i - 1]) / 2) * dt;
  return out;
}

function fmtSeconds(ms: number): string {
  return `${Math.round(ms / 1000)} s`;
}

/** Turns a raw recording into the summary and the 10 Hz series shown to the user. */
export function processRecording(rec: RawRecording): ProcessResult {
  const durationMs = Math.max(0, rec.durationMs);
  const n = Math.floor(durationMs / GRID_STEP_MS) + 1;
  const dt = GRID_STEP_MS / 1000;
  const grid = new Float64Array(n);
  for (let i = 0; i < n; i++) grid[i] = i * GRID_STEP_MS;

  const warnings: string[] = [];
  let invalid = false;

  // --- Motion -------------------------------------------------------------
  const m = rec.motion;
  const hasMotion = m.t.length >= 20;
  const motionSpan = hasMotion ? m.t[m.t.length - 1] - m.t[0] : 0;
  const motionRateHz = hasMotion && motionSpan > 0 ? ((m.t.length - 1) / motionSpan) * 1000 : null;
  const h1 = hasMotion ? movingAverage(binAverage(m.t, m.h1, grid, GRID_STEP_MS), 3) : new Float64Array(n);
  const h2 = hasMotion ? movingAverage(binAverage(m.t, m.h2, grid, GRID_STEP_MS), 3) : new Float64Array(n);

  // --- GPS ----------------------------------------------------------------
  const cleaned = cleanFixes(rec.gps, durationMs);
  const projection = cleaned.length > 0 ? makeProjection(cleaned[0]) : null;
  const cleanedXY = projection ? cleaned.map((f) => projection.toXY(f)) : [];
  const kept = rejectJumps(cleaned, cleanedXY);
  const fixes = kept.map((i) => cleaned[i]);
  const xy = kept.map((i) => cleanedXY[i]);
  const speeds = fixSpeeds(fixes, xy);
  const rawMeasurements: SpeedMeasurement[] = [];
  fixes.forEach((f, i) => {
    const s = speeds[i];
    const index = Math.round(f.t / GRID_STEP_MS);
    if (s && index >= 0 && index < n) rawMeasurements.push({ index, speed: s.speed, sigma: s.sigma });
  });
  const measurements = gateMeasurements(rawMeasurements, dt);
  const outliers = cleaned.length - fixes.length + rawMeasurements.length - measurements.length;

  // --- Axis alignment -----------------------------------------------------
  let alignment = IDENTITY_ALIGNMENT;
  let alignmentMethod: AlignmentMethod = 'mounting';
  if (hasMotion) {
    const pairs = alignmentPairs(fixes, xy, speeds, h1, h2, rec);
    const energy = pairs.reduce((s, p) => s + p.long ** 2 + p.lat ** 2, 0) / Math.max(1, pairs.length);
    const fit = fitAlignment(pairs);
    if (pairs.length >= 12 && energy >= 0.16 && fit.r2 >= 0.2) {
      alignment = fit;
      alignmentMethod = 'gps';
    } else {
      alignment = { ...IDENTITY_ALIGNMENT, pairs: pairs.length, r2: fit.r2 };
    }
  }

  const long = new Float64Array(n);
  const lat = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const v = applyAlignment(alignment, h1[i], h2[i]);
    long[i] = v.long;
    lat[i] = v.lat;
  }

  // --- Speed and distance -------------------------------------------------
  let speed: Float64Array;
  if (measurements.length === 0) {
    speed = new Float64Array(n);
    invalid = true;
  } else if (hasMotion && alignmentMethod === 'gps') {
    speed = fuseSpeed(dt, long, measurements);
  } else {
    // Without trusted accelerometer axes: GPS only, smoothed and weighted by each
    // measurement's uncertainty (same filter, zero acceleration input).
    speed = fuseSpeed(dt, new Float64Array(n), measurements, { accelNoise: 2 });
  }
  for (let i = 0; i < n; i++) speed[i] = Math.min(speed[i], MAX_PLAUSIBLE_SPEED);
  const distance = cumulativeDistance(speed, dt);

  // --- Trajectory ---------------------------------------------------------
  const latitude = new Float64Array(n);
  const longitude = new Float64Array(n);
  if (projection && fixes.length > 0) {
    const path = placeAlongPath(
      fixes.map((f) => f.t),
      xy,
      grid,
      distance,
    );
    path.forEach((p, i) => {
      const ll = projection.toLatLon(p);
      latitude[i] = ll.latitude;
      longitude[i] = ll.longitude;
    });
  }

  // --- Statistics ---------------------------------------------------------
  const peakWindow = Math.max(1, Math.round(PEAK_WINDOW_MS / GRID_STEP_MS) | 1);
  const longPeak = movingAverage(long, peakWindow);
  const latPeak = movingAverage(lat, peakWindow);
  let maxSpeed = 0;
  let movingSamples = 0;
  let peakAccel = 0;
  let peakBrake = 0;
  let peakLatLeft = 0;
  let peakLatRight = 0;
  let peakCombined = 0;
  let sumAbsLong = 0;
  let sumAbsLat = 0;
  for (let i = 0; i < n; i++) {
    if (speed[i] > maxSpeed) maxSpeed = speed[i];
    if (speed[i] <= MOVING_SPEED) continue;
    movingSamples++;
    sumAbsLong += Math.abs(long[i]);
    sumAbsLat += Math.abs(lat[i]);
    peakAccel = Math.max(peakAccel, longPeak[i]);
    peakBrake = Math.max(peakBrake, -longPeak[i]);
    peakLatLeft = Math.max(peakLatLeft, latPeak[i]);
    peakLatRight = Math.max(peakLatRight, -latPeak[i]);
    peakCombined = Math.max(peakCombined, Math.hypot(longPeak[i], latPeak[i]));
  }
  const movingTimeMs = movingSamples * GRID_STEP_MS;
  const distanceM = distance[n - 1] ?? 0;

  // --- Quality ------------------------------------------------------------
  const fixIntervals = deltas(fixes.map((f) => f.t));
  const gpsMedianIntervalMs = median(fixIntervals);
  const accuracies = fixes.map((f) => f.accuracy).filter((a): a is number => a !== null);
  const gpsMedianAccuracyM = median(accuracies);
  const largestGap = fixIntervals.length > 0 ? Math.max(...fixIntervals) : 0;
  let serious = 0;

  if (durationMs < 5000) {
    invalid = true;
    warnings.push('Mesure trop courte pour être exploitée.');
  }
  if (fixes.length < 3) {
    invalid = true;
    warnings.push('Pas assez de points GPS : vitesse et trajet indisponibles.');
  }
  if (gpsMedianIntervalMs !== null && gpsMedianIntervalMs > 2000) {
    serious++;
    warnings.push(`GPS peu fréquent : un point toutes les ${(gpsMedianIntervalMs / 1000).toFixed(1)} s.`);
  }
  if (gpsMedianAccuracyM !== null && gpsMedianAccuracyM > 15) {
    serious++;
    warnings.push(`Précision GPS faible (± ${Math.round(gpsMedianAccuracyM)} m).`);
  }
  if (outliers > 0) warnings.push(`${outliers} mesure(s) GPS aberrante(s) ignorée(s).`);
  if (largestGap > 5000) {
    serious++;
    warnings.push(`Coupure GPS de ${fmtSeconds(largestGap)}.`);
  }
  if (!hasMotion || (motionRateHz !== null && motionRateHz < 20)) {
    serious++;
    warnings.push('Capteurs de mouvement insuffisants : forces G indisponibles, vitesse issue du GPS seul.');
  } else if (alignmentMethod === 'mounting') {
    warnings.push(
      'Alignement automatique impossible (pas assez de virages ou d’accélérations) : axes supposés d’après le montage, vitesse issue du GPS seul.',
    );
  }
  const interruptedMs = rec.interruptions.reduce((s, r) => s + Math.max(0, r.to - r.from), 0);
  if (interruptedMs > 0) {
    serious++;
    warnings.push(`Application en arrière-plan pendant ${fmtSeconds(interruptedMs)} : données manquantes.`);
  }
  if (rec.maxTiltDriftDeg > 8) {
    serious++;
    warnings.push(`Téléphone déplacé pendant la mesure (${Math.round(rec.maxTiltDriftDeg)}°) : forces G moins fiables.`);
  }
  if (rec.source === 'demo') warnings.unshift('Données simulées (mode démo), pas une vraie mesure.');

  const realWarnings = warnings.length - (rec.source === 'demo' ? 1 : 0);
  const quality: QualityLevel = invalid ? 'invalid' : serious >= 2 ? 'poor' : realWarnings > 0 ? 'fair' : 'good';

  const summary: SessionSummary = {
    durationMs,
    movingTimeMs,
    distanceM,
    maxSpeed,
    avgSpeed: durationMs > 0 ? distanceM / (durationMs / 1000) : 0,
    movingAvgSpeed: movingTimeMs > 0 ? distanceM / (movingTimeMs / 1000) : 0,
    peakAccel,
    peakBrake,
    peakLatLeft,
    peakLatRight,
    peakCombined,
    meanAbsLong: movingSamples > 0 ? sumAbsLong / movingSamples : 0,
    meanAbsLat: movingSamples > 0 ? sumAbsLat / movingSamples : 0,
    alignment: alignmentMethod,
    alignmentR2: alignment.r2,
    gpsFixes: fixes.length,
    gpsMedianIntervalMs,
    gpsMedianAccuracyM,
    motionRateHz,
    quality,
    warnings,
  };

  return { summary, series: { t: grid, speed, long, lat, latitude, longitude }, alignment };
}
