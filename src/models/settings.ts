import type { AccelUnit, SpeedUnit } from '@/core/units';

/**
 * - `auto`: native Liquid Glass when available, simulated glass otherwise.
 * - `simulated`: always the blur-based approximation.
 * - `opaque`: no transparency at all.
 */
export type GlassPreference = 'auto' | 'simulated' | 'opaque';

/** Sensor rate during a measurement. 120 Hz is offered only on ProMotion iPhones. */
export type MotionRate = 60 | 120;

export interface Settings {
  speedUnit: SpeedUnit;
  accelUnit: AccelUnit;
  glass: GlassPreference;
  haptics: boolean;
  /** Prevents auto-lock while measuring or running diagnostics. */
  keepAwake: boolean;
  /** Shows the welcome screen on launch; otherwise opens the dashboard directly. */
  showWelcome: boolean;
  /** Requested DeviceMotion rate during a measurement. */
  motionRateHz: MotionRate;
}

export const DEFAULT_SETTINGS: Settings = {
  speedUnit: 'kmh',
  accelUnit: 'g',
  glass: 'auto',
  haptics: true,
  keepAwake: true,
  showWelcome: true,
  motionRateHz: 60,
};

const SPEED_UNITS: readonly SpeedUnit[] = ['kmh', 'mph'];
const ACCEL_UNITS: readonly AccelUnit[] = ['g', 'ms2'];
const MOTION_RATES: readonly MotionRate[] = [60, 120];
const GLASS_PREFERENCES: readonly GlassPreference[] = ['auto', 'simulated', 'opaque'];

function oneOf<T>(allowed: readonly T[], value: unknown, fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/** Validates stored settings field by field; unknown or invalid values fall back to defaults. */
export function parseSettings(raw: unknown): Settings {
  const d = DEFAULT_SETTINGS;
  if (typeof raw !== 'object' || raw === null) return { ...d };
  const r = raw as Record<string, unknown>;
  return {
    speedUnit: oneOf(SPEED_UNITS, r.speedUnit, d.speedUnit),
    accelUnit: oneOf(ACCEL_UNITS, r.accelUnit, d.accelUnit),
    glass: oneOf(GLASS_PREFERENCES, r.glass, d.glass),
    haptics: bool(r.haptics, d.haptics),
    keepAwake: bool(r.keepAwake, d.keepAwake),
    showWelcome: bool(r.showWelcome, d.showWelcome),
    motionRateHz: oneOf(MOTION_RATES, r.motionRateHz, d.motionRateHz),
  };
}
