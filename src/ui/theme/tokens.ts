/**
 * Monochrome palette. Color is reserved for meaning:
 * `live` marks an active recording, `danger` destructive actions.
 */
export const colors = {
  background: '#000000',
  surface: '#111113',
  surfaceHigh: '#1C1C1F',
  separator: 'rgba(255, 255, 255, 0.08)',
  textPrimary: '#F5F5F7',
  textSecondary: 'rgba(235, 235, 245, 0.56)',
  textTertiary: 'rgba(235, 235, 245, 0.30)',
  inverse: '#000000',
  live: '#FF453A',
  danger: '#FF453A',
} as const;

export const radii = {
  sm: 10,
  md: 16,
  lg: 22,
  pill: 999,
} as const;

/** Screen side margin, aligned with iOS inset grouped lists. */
export const GUTTER = 20;

/** Row background matching grouped list surfaces (used under swipe actions). */
export const surfaceBackground = { backgroundColor: colors.surface } as const;
