import type { QualityLevel, SessionSummary } from './session';

const QUALITY: readonly QualityLevel[] = ['good', 'fair', 'poor', 'invalid'];

function num(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function numOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * Reads a stored summary defensively: missing or corrupted fields never crash
 * the history, and an unreadable summary is shown as invalid rather than as a result.
 */
export function parseSummary(raw: unknown): SessionSummary {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const quality = QUALITY.includes(r.quality as QualityLevel) ? (r.quality as QualityLevel) : 'invalid';
  return {
    durationMs: num(r.durationMs),
    movingTimeMs: num(r.movingTimeMs),
    distanceM: num(r.distanceM),
    maxSpeed: num(r.maxSpeed),
    avgSpeed: num(r.avgSpeed),
    movingAvgSpeed: num(r.movingAvgSpeed),
    peakAccel: num(r.peakAccel),
    peakBrake: num(r.peakBrake),
    peakLatLeft: num(r.peakLatLeft),
    peakLatRight: num(r.peakLatRight),
    peakCombined: num(r.peakCombined),
    meanAbsLong: num(r.meanAbsLong),
    meanAbsLat: num(r.meanAbsLat),
    alignment: r.alignment === 'gps' ? 'gps' : 'mounting',
    alignmentR2: num(r.alignmentR2),
    gpsFixes: num(r.gpsFixes),
    gpsMedianIntervalMs: numOrNull(r.gpsMedianIntervalMs),
    gpsMedianAccuracyM: numOrNull(r.gpsMedianAccuracyM),
    motionRateHz: numOrNull(r.motionRateHz),
    quality,
    warnings: Array.isArray(r.warnings) ? r.warnings.filter((w): w is string => typeof w === 'string') : [],
  };
}
