import type { GpsFix, RawData, Session, SessionSeries } from '@/models/session';

import { decodeColumns, encodeColumns } from './columnCodec';

/** Persistence contract for sessions. SQLite in the app, in-memory in tests. */
export interface SessionRepository {
  list(): Promise<Session[]>;
  get(id: string): Promise<Session | null>;
  getSeries(id: string): Promise<SessionSeries | null>;
  getGps(id: string): Promise<GpsFix[] | null>;
  /** Raw accelerometer samples and recording metadata (null for older sessions). */
  getRaw(id: string): Promise<RawData | null>;
  save(session: Session, series: SessionSeries, gps: readonly GpsFix[], raw?: RawData): Promise<void>;
  delete(id: string): Promise<void>;
  deleteWhere(source: Session['source'] | 'all'): Promise<number>;
  stats(): Promise<{ count: number; bytes: number }>;
}

export function seriesToBlob(s: SessionSeries): Uint8Array {
  return encodeColumns([s.t, s.speed, s.long, s.lat, s.latitude, s.longitude]);
}

export function blobToSeries(bytes: Uint8Array): SessionSeries {
  const [t, speed, long, lat, latitude, longitude] = decodeColumns(bytes);
  return { t, speed, long, lat, latitude, longitude };
}

/** NaN encodes a missing speed/accuracy. */
export function gpsToBlob(gps: readonly GpsFix[]): Uint8Array {
  return encodeColumns([
    gps.map((f) => f.t),
    gps.map((f) => f.latitude),
    gps.map((f) => f.longitude),
    gps.map((f) => f.speed ?? NaN),
    gps.map((f) => f.accuracy ?? NaN),
  ]);
}

export function blobToGps(bytes: Uint8Array): GpsFix[] {
  const [t, latitude, longitude, speed, accuracy] = decodeColumns(bytes);
  return Array.from(t, (time, i) => ({
    t: time,
    latitude: latitude[i],
    longitude: longitude[i],
    speed: Number.isNaN(speed[i]) ? null : speed[i],
    accuracy: Number.isNaN(accuracy[i]) ? null : accuracy[i],
  }));
}

export function motionToBlob(m: RawData['motion']): Uint8Array {
  return encodeColumns([m.t, m.h1, m.h2, m.up]);
}

export function blobToMotion(bytes: Uint8Array): RawData['motion'] {
  const [t, h1, h2, up] = decodeColumns(bytes);
  return { t: Array.from(t), h1: Array.from(h1), h2: Array.from(h2), up: Array.from(up) };
}

export function newSessionId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Same behavior as the SQLite repository, blobs included, without native code. */
export function createMemoryRepository(): SessionRepository {
  const rows = new Map<string, { session: Session; series: Uint8Array; gps: Uint8Array; motion?: Uint8Array; meta?: string }>();
  return {
    async list() {
      return [...rows.values()].map((r) => r.session).sort((a, b) => b.startedAt - a.startedAt);
    },
    async get(id) {
      return rows.get(id)?.session ?? null;
    },
    async getSeries(id) {
      const r = rows.get(id);
      return r ? blobToSeries(r.series) : null;
    },
    async getGps(id) {
      const r = rows.get(id);
      return r ? blobToGps(r.gps) : null;
    },
    async getRaw(id) {
      const r = rows.get(id);
      return r?.motion && r.meta ? { motion: blobToMotion(r.motion), meta: JSON.parse(r.meta) } : null;
    },
    async save(session, series, gps, raw) {
      rows.set(session.id, {
        session: JSON.parse(JSON.stringify(session)),
        series: seriesToBlob(series),
        gps: gpsToBlob(gps),
        motion: raw ? motionToBlob(raw.motion) : undefined,
        meta: raw ? JSON.stringify(raw.meta) : undefined,
      });
    },
    async delete(id) {
      rows.delete(id);
    },
    async deleteWhere(source) {
      let count = 0;
      for (const [id, r] of rows) {
        if (source === 'all' || r.session.source === source) {
          rows.delete(id);
          count++;
        }
      }
      return count;
    },
    async stats() {
      let bytes = 0;
      for (const r of rows.values()) bytes += r.series.byteLength + r.gps.byteLength + (r.motion?.byteLength ?? 0);
      return { count: rows.size, bytes };
    },
  };
}
