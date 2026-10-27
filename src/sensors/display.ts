import * as Device from 'expo-device';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

/** iPhones with a 120 Hz ProMotion display (model identifiers). */
const PROMOTION_IPHONES = new Set([
  'iPhone14,2', // 13 Pro
  'iPhone14,3', // 13 Pro Max
  'iPhone15,2', // 14 Pro
  'iPhone15,3', // 14 Pro Max
  'iPhone16,1', // 15 Pro
  'iPhone16,2', // 15 Pro Max
  'iPhone17,1', // 16 Pro
  'iPhone17,2', // 16 Pro Max
  'iPhone18,1', // 17 Pro
  'iPhone18,2', // 17 Pro Max
  'iPhone18,3', // 17
  'iPhone18,4', // Air
]);

/** Newest identifier family covered by the table above. */
const LAST_KNOWN_FAMILY = 18;

/**
 * `true`/`false` when the model is known, `null` for models newer than the table
 * (then the frame rate is measured instead).
 */
export function proMotionFromModel(modelId: string | null | undefined): boolean | null {
  if (!modelId) return null;
  if (PROMOTION_IPHONES.has(modelId)) return true;
  const match = /^iPhone(\d+),\d+$/.exec(modelId);
  if (!match) return null;
  return Number(match[1]) <= LAST_KNOWN_FAMILY ? false : null;
}

/** Counts animation frames for `durationMs`. Only reaches ~120 when iOS lets the app run at 120 Hz. */
function measureFrameRate(durationMs = 800): Promise<number> {
  return new Promise((resolve) => {
    let frames = 0;
    const start = performance.now();
    const tick = () => {
      frames++;
      const elapsed = performance.now() - start;
      if (elapsed >= durationMs) resolve((frames / elapsed) * 1000);
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

let cached: boolean | null = null;
let pending: Promise<boolean> | null = null;

export function detectHighRefresh(): Promise<boolean> {
  if (cached !== null) return Promise.resolve(cached);
  if (!pending) {
    const known = Platform.OS === 'ios' ? proMotionFromModel(Device.modelId) : false;
    pending = (known !== null ? Promise.resolve(known) : measureFrameRate().then((fps) => fps > 90)).then((v) => {
      cached = v;
      return v;
    });
  }
  return pending;
}

/** Whether the device has a 120 Hz display; `null` while detecting. */
export function useHighRefresh(): boolean | null {
  const [value, setValue] = useState<boolean | null>(cached);
  useEffect(() => {
    let active = true;
    detectHighRefresh().then((v) => active && setValue(v));
    return () => {
      active = false;
    };
  }, []);
  return value;
}
