import Storage from 'expo-sqlite/kv-store';

/**
 * App log kept on the phone (last entries only), viewable and exportable from the
 * Développement screen so testers can report bugs. Persisted locally so it survives
 * closing the app between a test drive and the export. Never sent anywhere automatically.
 */
export type LogLevel = 'info' | 'warn' | 'error';

export interface LogEntry {
  at: number;
  level: LogLevel;
  tag: string;
  message: string;
  data?: unknown;
}

const MAX_ENTRIES = 1000;
const STORAGE_KEY = 'fast.log.v1';
const SAVE_DEBOUNCE_MS = 2000;

let entries: LogEntry[] | null = null;
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function load(): LogEntry[] {
  try {
    const raw = Storage.getItemSync(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as LogEntry[]).slice(-MAX_ENTRIES) : [];
  } catch {
    return [];
  }
}

function list(): LogEntry[] {
  if (entries === null) entries = load();
  return entries;
}

function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    flushLog();
  }, SAVE_DEBOUNCE_MS);
}

/** Writes the log to disk now (also called when the app goes to the background). */
export function flushLog() {
  if (entries === null) return;
  try {
    Storage.setItemSync(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Logging must never break the app.
  }
}

export function log(level: LogLevel, tag: string, message: string, data?: unknown) {
  const all = list();
  all.push({ at: Date.now(), level, tag, message, data });
  if (all.length > MAX_ENTRIES) all.splice(0, all.length - MAX_ENTRIES);
  const line = `[${tag}] ${message}`;
  if (level === 'error') console.warn(line, data ?? '');
  else if (__DEV__) console.log(line, data ?? '');
  scheduleSave();
  listeners.forEach((l) => l());
}

export function getLogEntries(): readonly LogEntry[] {
  return list();
}

/** Entries between two instants (epoch ms), e.g. those of one recording. */
export function getLogEntriesBetween(from: number, to: number): LogEntry[] {
  return list().filter((e) => e.at >= from && e.at <= to);
}

export function clearLog() {
  entries = [];
  flushLog();
  listeners.forEach((l) => l());
}

export function subscribeLog(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function formatLogEntry(e: LogEntry): string {
  const time = new Date(e.at).toLocaleTimeString('fr-FR');
  const data = e.data === undefined ? '' : ` ${JSON.stringify(e.data)}`;
  return `${time} ${e.level.toUpperCase()} [${e.tag}] ${e.message}${data}`;
}
