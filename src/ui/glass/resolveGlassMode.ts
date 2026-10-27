import type { GlassPreference } from '@/models/settings';

/** How a glass surface is actually rendered. */
export type GlassMode = 'native' | 'simulated' | 'opaque';

export function resolveGlassMode(
  preference: GlassPreference,
  reduceTransparencyEnabled: boolean,
  nativeAvailable: boolean,
): GlassMode {
  if (reduceTransparencyEnabled || preference === 'opaque') return 'opaque';
  if (preference === 'simulated') return 'simulated';
  return nativeAvailable ? 'native' : 'simulated';
}
