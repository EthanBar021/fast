import { isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useSyncExternalStore } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

import { useSettings } from '@/storage/settingsStore';

import { resolveGlassMode, type GlassMode } from './resolveGlassMode';

export type { GlassMode };

function detectNativeGlass(): boolean {
  if (Platform.OS !== 'ios') return false;
  try {
    // isGlassEffectAPIAvailable guards against iOS 26 betas missing the API (they can crash).
    return isGlassEffectAPIAvailable() && isLiquidGlassAvailable();
  } catch {
    return false;
  }
}

/** Whether the real Liquid Glass (UIGlassEffect) can be rendered on this device. */
export const nativeGlassAvailable = detectNativeGlass();

// "Reduce Transparency" accessibility setting, shared by every surface (one listener).
let reduceTransparency = false;
const listeners = new Set<() => void>();
let started = false;

function startListening() {
  if (started) return;
  started = true;
  const set = (value: boolean) => {
    if (value === reduceTransparency) return;
    reduceTransparency = value;
    listeners.forEach((listener) => listener());
  };
  AccessibilityInfo.isReduceTransparencyEnabled().then(set, () => {});
  AccessibilityInfo.addEventListener('reduceTransparencyChanged', set);
}

function subscribe(listener: () => void): () => void {
  startListening();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useReduceTransparency(): boolean {
  return useSyncExternalStore(subscribe, () => reduceTransparency);
}

export function useGlassMode(): GlassMode {
  const { glass } = useSettings();
  const reduce = useReduceTransparency();
  return resolveGlassMode(glass, reduce, nativeGlassAvailable);
}
