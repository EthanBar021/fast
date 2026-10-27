import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { File, Paths } from 'expo-file-system';
import { Platform, Share } from 'react-native';

import type { Session } from '@/models/session';
import { sessions } from '@/storage/sessions';
import { getSettings } from '@/storage/settingsStore';

import { getLogEntries, getLogEntriesBetween, log } from './log';

/**
 * Test exports: one JSON file with everything needed to analyse a drive offline —
 * raw accelerometer samples, raw GPS fixes (positions included), calibration,
 * computed summary and the app log. Written locally, then handed to the iOS share
 * sheet; nothing is sent without the user picking a destination.
 */
const FORMAT = 'fast-export';
const FORMAT_VERSION = 1;

const round = (v: number, digits: number) => {
  const k = 10 ** digits;
  return Math.round(v * k) / k;
};
const roundAll = (values: ArrayLike<number>, digits: number) => Array.from(values, (v) => round(v, digits));

function environment() {
  return {
    app: Constants.expoConfig?.version ?? null,
    sdk: Constants.expoConfig?.sdkVersion ?? null,
    device: Device.modelName ?? null,
    modelId: Device.modelId ?? null,
    os: `${Device.osName ?? Platform.OS} ${Device.osVersion ?? Platform.Version}`,
    settings: getSettings(),
    exportedAt: new Date().toISOString(),
  };
}

async function sessionPayload(session: Session) {
  const repo = sessions();
  const [gps, raw, series] = await Promise.all([repo.getGps(session.id), repo.getRaw(session.id), repo.getSeries(session.id)]);
  const startedAt = session.startedAt;
  const endedAt = startedAt + session.summary.durationMs;
  return {
    id: session.id,
    source: session.source,
    startedAt: new Date(startedAt).toISOString(),
    summary: session.summary,
    meta: raw?.meta ?? null,
    gps: (gps ?? []).map((f) => ({
      t: Math.round(f.t),
      lat: round(f.latitude, 7),
      lon: round(f.longitude, 7),
      speed: f.speed === null ? null : round(f.speed, 3),
      acc: f.accuracy === null ? null : round(f.accuracy, 1),
    })),
    // Accelerometer in the calibration basis (h1 ≈ forward, h2 ≈ left, up), m/s².
    motion: raw
      ? {
          t: roundAll(raw.motion.t, 1),
          h1: roundAll(raw.motion.h1, 4),
          h2: roundAll(raw.motion.h2, 4),
          up: roundAll(raw.motion.up, 4),
        }
      : null,
    // Computed 10 Hz series, to compare with a re-processing.
    series: series
      ? {
          t: roundAll(series.t, 0),
          speed: roundAll(series.speed, 3),
          long: roundAll(series.long, 3),
          lat: roundAll(series.lat, 3),
        }
      : null,
    log: getLogEntriesBetween(startedAt - 5 * 60_000, endedAt + 5 * 60_000),
  };
}

function stamp(date = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}`;
}

async function writeAndShare(name: string, payload: unknown): Promise<void> {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  await file.write(JSON.stringify(payload));
  log('info', 'export', `Fichier prêt : ${name}`, { bytes: file.size });
  await Share.share({ url: file.uri, title: name });
}

/** Exports one session (raw data + summary + log around it). */
export async function exportSession(id: string): Promise<void> {
  const session = await sessions().get(id);
  if (!session) throw new Error('Session introuvable');
  const payload = { format: FORMAT, version: FORMAT_VERSION, environment: environment(), sessions: [await sessionPayload(session)] };
  await writeAndShare(`fast-session-${stamp(new Date(session.startedAt))}.json`, payload);
}

/** Exports all real sessions (demo excluded) and the whole app log. */
export async function exportAll(): Promise<number> {
  const list = (await sessions().list()).filter((s) => s.source === 'device');
  const payloads = [];
  for (const s of list) payloads.push(await sessionPayload(s));
  const payload = {
    format: FORMAT,
    version: FORMAT_VERSION,
    environment: environment(),
    sessions: payloads.map((p) => ({ ...p, log: undefined })),
    log: getLogEntries(),
  };
  await writeAndShare(`fast-export-${stamp()}.json`, payload);
  return list.length;
}

/** Exports the app log alone. */
export async function exportLog(): Promise<void> {
  await writeAndShare(`fast-journal-${stamp()}.json`, {
    format: FORMAT,
    version: FORMAT_VERSION,
    environment: environment(),
    sessions: [],
    log: getLogEntries(),
  });
}
