import type { Session } from '@/models/session';

export interface PeriodSummary {
  sessions: number;
  distanceM: number;
  movingTimeMs: number;
  maxSpeed: number;
  peakAccel: number;
  peakBrake: number;
  peakLat: number;
}

const DAY_MS = 86_400_000;

/**
 * Totals and records over the last `days` days. Only real measurements count:
 * demo sessions and invalid measurements are excluded.
 */
export function periodSummary(sessions: readonly Session[], now: number, days = 30): PeriodSummary {
  const from = now - days * DAY_MS;
  const out: PeriodSummary = { sessions: 0, distanceM: 0, movingTimeMs: 0, maxSpeed: 0, peakAccel: 0, peakBrake: 0, peakLat: 0 };
  for (const s of sessions) {
    if (s.source !== 'device' || s.summary.quality === 'invalid' || s.startedAt < from || s.startedAt > now) continue;
    const m = s.summary;
    out.sessions++;
    out.distanceM += m.distanceM;
    out.movingTimeMs += m.movingTimeMs;
    out.maxSpeed = Math.max(out.maxSpeed, m.maxSpeed);
    out.peakAccel = Math.max(out.peakAccel, m.peakAccel);
    out.peakBrake = Math.max(out.peakBrake, m.peakBrake);
    out.peakLat = Math.max(out.peakLat, m.peakLatLeft, m.peakLatRight);
  }
  return out;
}

/** Last 30 days up to now. */
export function recentSummary(sessions: readonly Session[]): PeriodSummary {
  return periodSummary(sessions, Date.now(), 30);
}
