/** Standard gravity in m/s² (same value as DeviceMotion.Gravity in expo-sensors). */
export const STANDARD_GRAVITY = 9.80665;

const MS_TO_KMH = 3.6;
const MS_TO_MPH = 3600 / 1609.344;

export type SpeedUnit = 'kmh' | 'mph';
export type AccelUnit = 'g' | 'ms2';

/** m/s → km/h */
export function msToKmh(speedMs: number): number {
  return speedMs * MS_TO_KMH;
}

/** km/h → m/s */
export function kmhToMs(speedKmh: number): number {
  return speedKmh / MS_TO_KMH;
}

/** m/s → mph */
export function msToMph(speedMs: number): number {
  return speedMs * MS_TO_MPH;
}

/** m/s² → g */
export function ms2ToG(accelMs2: number): number {
  return accelMs2 / STANDARD_GRAVITY;
}

/** g → m/s² */
export function gToMs2(accelG: number): number {
  return accelG * STANDARD_GRAVITY;
}

export const SPEED_UNIT_LABEL: Record<SpeedUnit, string> = { kmh: 'km/h', mph: 'mph' };
export const ACCEL_UNIT_LABEL: Record<AccelUnit, string> = { g: 'g', ms2: 'm/s²' };

/** Converts a speed in m/s to the display unit. */
export function speedIn(unit: SpeedUnit, speedMs: number): number {
  return unit === 'kmh' ? msToKmh(speedMs) : msToMph(speedMs);
}

/** Converts an acceleration in m/s² to the display unit. */
export function accelIn(unit: AccelUnit, accelMs2: number): number {
  return unit === 'g' ? ms2ToG(accelMs2) : accelMs2;
}
