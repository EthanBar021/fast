import * as Haptics from 'expo-haptics';

import { getSettings } from '@/storage/settingsStore';

export type HapticKind =
  | 'selection'
  | 'light'
  | 'impact'
  | 'heavy'
  | 'rigid'
  | 'soft'
  | 'success'
  | 'warning';

const IMPACT: Partial<Record<HapticKind, Haptics.ImpactFeedbackStyle>> = {
  light: Haptics.ImpactFeedbackStyle.Light,
  impact: Haptics.ImpactFeedbackStyle.Medium,
  heavy: Haptics.ImpactFeedbackStyle.Heavy,
  rigid: Haptics.ImpactFeedbackStyle.Rigid,
  soft: Haptics.ImpactFeedbackStyle.Soft,
};

/** Fires a haptic only when enabled in settings. Never throws. */
export function haptic(kind: HapticKind = 'selection'): void {
  if (!getSettings().haptics) return;
  const style = IMPACT[kind];
  const run = style
    ? Haptics.impactAsync(style)
    : kind === 'success'
      ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      : kind === 'warning'
        ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
        : Haptics.selectionAsync();
  run.catch(() => {});
}

/** Schedules haptics at given offsets (ms). Returns a cancel function. */
export function hapticTimeline(steps: readonly { at: number; kind: HapticKind }[]): () => void {
  const timers = steps.map((s) => setTimeout(() => haptic(s.kind), s.at));
  return () => timers.forEach(clearTimeout);
}
