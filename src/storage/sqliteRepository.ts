import * as SQLite from 'expo-sqlite';

import { parseSummary } from '@/models/sessionValidation';

import {
  blobToGps,
  blobToMotion,
  blobToSeries,
  gpsToBlob,
  motionToBlob,
  seriesToBlob,
  type SessionRepository,
} from './sessionRepository';

const DB_NAME = 'fast.db';
const SCHEMA_VERSION = 2;

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function open(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.execAsync('PRAGMA journal_mode = WAL;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const version = row?.user_version ?? 0;
  if (version < 1) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY NOT NULL,
        started_at INTEGER NOT NULL,
        source TEXT NOT NULL,
        summary TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS sessions_started_at ON sessions (started_at DESC);
      CREATE TABLE IF NOT EXISTS session_data (
        session_id TEXT PRIMARY KEY NOT NULL,
        series BLOB NOT NULL,
        gps BLOB NOT NULL
      );
    `);
  }
  if (version < 2) {
    // v2: raw accelerometer samples + recording metadata, for re-processing and test exports.
    await db.execAsync(`
      ALTER TABLE session_data ADD COLUMN motion BLOB;
      ALTER TABLE session_data ADD COLUMN meta TEXT;
    `);
  }
  if (version < SCHEMA_VERSION) await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION};`);
  return db;
}

function db() {
  if (!dbPromise) {
    dbPromise = open().catch((error) => {
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
}

type SessionRow = { id: string; started_at: number; source: string; summary: string };

function toSession(row: SessionRow) {
  return {
    id: row.id,
    startedAt: row.started_at,
    source: row.source === 'demo' ? ('demo' as const) : ('device' as const),
    summary: parseSummary(JSON.parse(row.summary)),
  };
}

/** Sessions stored in a local SQLite database (expo-sqlite). Nothing leaves the phone. */
export const sqliteRepository: SessionRepository = {
  async list() {
    const rows = await (await db()).getAllAsync<SessionRow>(
      'SELECT id, started_at, source, summary FROM sessions ORDER BY started_at DESC',
    );
    return rows.map(toSession);
  },
  async get(id) {
    const row = await (await db()).getFirstAsync<SessionRow>(
      'SELECT id, started_at, source, summary FROM sessions WHERE id = ?',
      id,
    );
    return row ? toSession(row) : null;
  },
  async getSeries(id) {
    const row = await (await db()).getFirstAsync<{ series: Uint8Array }>(
      'SELECT series FROM session_data WHERE session_id = ?',
      id,
    );
    return row ? blobToSeries(row.series) : null;
  },
  async getGps(id) {
    const row = await (await db()).getFirstAsync<{ gps: Uint8Array }>(
      'SELECT gps FROM session_data WHERE session_id = ?',
      id,
    );
    return row ? blobToGps(row.gps) : null;
  },
  async getRaw(id) {
    const row = await (await db()).getFirstAsync<{ motion: Uint8Array | null; meta: string | null }>(
      'SELECT motion, meta FROM session_data WHERE session_id = ?',
      id,
    );
    if (!row?.motion || !row.meta) return null;
    return { motion: blobToMotion(row.motion), meta: JSON.parse(row.meta) };
  },
  async save(session, series, gps, raw) {
    const database = await db();
    await database.withTransactionAsync(async () => {
      await database.runAsync(
        'INSERT OR REPLACE INTO sessions (id, started_at, source, summary) VALUES (?, ?, ?, ?)',
        session.id,
        session.startedAt,
        session.source,
        JSON.stringify(session.summary),
      );
      await database.runAsync(
        'INSERT OR REPLACE INTO session_data (session_id, series, gps, motion, meta) VALUES (?, ?, ?, ?, ?)',
        session.id,
        seriesToBlob(series),
        gpsToBlob(gps),
        raw ? motionToBlob(raw.motion) : null,
        raw ? JSON.stringify(raw.meta) : null,
      );
    });
  },
  async delete(id) {
    const database = await db();
    await database.withTransactionAsync(async () => {
      await database.runAsync('DELETE FROM session_data WHERE session_id = ?', id);
      await database.runAsync('DELETE FROM sessions WHERE id = ?', id);
    });
  },
  async deleteWhere(source) {
    const database = await db();
    const where = source === 'all' ? '' : ' WHERE source = ?';
    const params = source === 'all' ? [] : [source];
    let changes = 0;
    await database.withTransactionAsync(async () => {
      await database.runAsync(
        `DELETE FROM session_data WHERE session_id IN (SELECT id FROM sessions${where})`,
        ...params,
      );
      changes = (await database.runAsync(`DELETE FROM sessions${where}`, ...params)).changes;
    });
    return changes;
  },
  async stats() {
    const database = await db();
    const count = await database.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM sessions');
    const size = await database.getFirstAsync<{ b: number | null }>(
      'SELECT SUM(LENGTH(series) + LENGTH(gps) + IFNULL(LENGTH(motion), 0)) AS b FROM session_data',
    );
    return { count: count?.n ?? 0, bytes: size?.b ?? 0 };
  },
};
