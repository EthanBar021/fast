import Storage from 'expo-sqlite/kv-store';
import { useSyncExternalStore } from 'react';

import { DEFAULT_SETTINGS, parseSettings, type Settings } from '@/models/settings';

const STORAGE_KEY = 'fast.settings.v1';

let current: Settings | null = null;
const listeners = new Set<() => void>();

function load(): Settings {
  try {
    const stored = Storage.getItemSync(STORAGE_KEY);
    return parseSettings(stored ? JSON.parse(stored) : null);
  } catch (error) {
    console.warn('[settings] lecture impossible, valeurs par défaut utilisées', error);
    return parseSettings(null);
  }
}

function save(next: Settings) {
  current = next;
  try {
    Storage.setItemSync(STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    console.warn('[settings] enregistrement impossible', error);
  }
  listeners.forEach((listener) => listener());
}

export function getSettings(): Settings {
  if (current === null) current = load();
  return current;
}

export function updateSettings(patch: Partial<Settings>): void {
  save({ ...getSettings(), ...patch });
}

export function resetSettings(): void {
  save({ ...DEFAULT_SETTINGS });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Settings persisted locally (SQLite key-value store), shared by every screen. */
export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, getSettings);
}
