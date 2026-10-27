import { useEffect, useState } from 'react';

import { processRecording } from '@/core/processing';
import { log } from '@/dev/log';
import type { RawData, RawRecording, Session, SessionSeries } from '@/models/session';

import { newSessionId, type SessionRepository } from './sessionRepository';
import { sqliteRepository } from './sqliteRepository';

let repository: SessionRepository = sqliteRepository;

/** Test hook: swap the storage backend. */
export function setSessionRepository(next: SessionRepository) {
  repository = next;
}

export function sessions(): SessionRepository {
  return repository;
}

// Change notifications so lists refresh after a save or a delete.
let version = 0;
const listeners = new Set<() => void>();

export function notifySessionsChanged() {
  version++;
  listeners.forEach((listener) => listener());
}

function useSessionsVersion(): number {
  const [v, setV] = useState(version);
  useEffect(() => {
    const listener = () => setV(version);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return v;
}

/** Processes a recording and stores the session with its series and raw GPS. */
export async function saveRecording(rec: RawRecording): Promise<Session> {
  const started = Date.now();
  const { summary, series, alignment } = processRecording(rec);
  const session: Session = { id: newSessionId(), startedAt: rec.startedAt, source: rec.source, summary };
  const raw: RawData = {
    motion: rec.motion,
    meta: {
      startedAt: rec.startedAt,
      durationMs: rec.durationMs,
      interruptions: rec.interruptions,
      maxTiltDriftDeg: rec.maxTiltDriftDeg,
      calibration: rec.calibration ?? null,
      motionIntervalMs: rec.motionIntervalMs ?? null,
    },
  };
  await repository.save(session, series, rec.gps, raw);
  log('info', 'session', `Session ${session.id} enregistrée`, {
    processingMs: Date.now() - started,
    quality: summary.quality,
    alignment: summary.alignment,
    r2: Number(alignment.r2.toFixed(3)),
    pairs: alignment.pairs,
    mirrored: alignment.mirrored,
    angleDeg: Math.round((alignment.angleRad * 180) / Math.PI),
    gpsFixes: summary.gpsFixes,
    motionHz: summary.motionRateHz && Math.round(summary.motionRateHz),
  });
  notifySessionsChanged();
  return session;
}

export async function deleteSession(id: string) {
  await repository.delete(id);
  log('info', 'session', `Session ${id} supprimée`);
  notifySessionsChanged();
}

export async function deleteSessions(source: Session['source'] | 'all') {
  const count = await repository.deleteWhere(source);
  log('info', 'session', `${count} session(s) supprimée(s) (${source})`);
  notifySessionsChanged();
  return count;
}

type Loadable<T> = { data: T | null; loading: boolean; error: string | null };

/** Loads data for `key` and reloads it whenever sessions change. `loader` must be stable (module level). */
function useLoad<T>(key: string, loader: (key: string) => Promise<T>): Loadable<T> {
  const [state, setState] = useState<Loadable<T>>({ data: null, loading: true, error: null });
  const v = useSessionsVersion();
  useEffect(() => {
    let active = true;
    loader(key).then(
      (data) => active && setState({ data, loading: false, error: null }),
      (e: unknown) => {
        log('error', 'storage', 'Lecture impossible', String(e));
        if (active) setState({ data: null, loading: false, error: String(e) });
      },
    );
    return () => {
      active = false;
    };
  }, [key, loader, v]);
  return state;
}

const loadList = () => repository.list();

async function loadSession(id: string): Promise<{ session: Session; series: SessionSeries | null } | null> {
  if (!id) return null;
  const session = await repository.get(id);
  if (!session) return null;
  return { session, series: await repository.getSeries(id) };
}

export function useSessionList(): Loadable<Session[]> {
  return useLoad('list', loadList);
}

export function useSession(id: string | undefined): Loadable<{ session: Session; series: SessionSeries | null } | null> {
  return useLoad(id ?? '', loadSession);
}
