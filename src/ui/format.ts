import { ACCEL_UNIT_LABEL, accelIn, SPEED_UNIT_LABEL, speedIn, type AccelUnit, type SpeedUnit } from '@/core/units';

export function formatNumber(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return '—';
  return value.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** 75 s → "1:15", 3725 s → "1:02:05" */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

export function formatDistance(m: number): { value: string; unit: string } {
  return m < 1000 ? { value: formatNumber(m, 0), unit: 'm' } : { value: formatNumber(m / 1000, m < 10_000 ? 2 : 1), unit: 'km' };
}

export function formatSpeed(speedMs: number, unit: SpeedUnit, digits = 0): { value: string; unit: string } {
  return { value: formatNumber(speedIn(unit, speedMs), digits), unit: SPEED_UNIT_LABEL[unit] };
}

export function formatAccel(accelMs2: number, unit: AccelUnit): { value: string; unit: string } {
  return { value: formatNumber(accelIn(unit, accelMs2), unit === 'g' ? 2 : 1), unit: ACCEL_UNIT_LABEL[unit] };
}

export function joinValue(v: { value: string; unit: string }): string {
  return `${v.value} ${v.unit}`;
}

export function formatSessionDate(epochMs: number): string {
  const d = new Date(epochMs);
  const day = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return `${day.charAt(0).toUpperCase()}${day.slice(1)} · ${time}`;
}

export const QUALITY_LABEL = {
  good: 'Bonne',
  fair: 'Correcte',
  poor: 'Faible',
  invalid: 'Inexploitable',
} as const;
