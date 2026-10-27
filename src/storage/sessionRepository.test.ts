import { processRecording } from '@/core/processing';
import { simulateRecording } from '@/core/simulate';
import { parseSummary } from '@/models/sessionValidation';

import { decodeColumns, encodeColumns } from './columnCodec';
import { blobToGps, createMemoryRepository, gpsToBlob, newSessionId } from './sessionRepository';

describe('columnCodec', () => {
  it('round-trips columns', () => {
    const blob = encodeColumns([
      [1, 2, 3],
      [0.5, -1.25, NaN],
    ]);
    const [a, b] = decodeColumns(blob);
    expect(Array.from(a)).toEqual([1, 2, 3]);
    expect(b[1]).toBe(-1.25);
    expect(Number.isNaN(b[2])).toBe(true);
  });

  it('reads blobs that are not 8-byte aligned', () => {
    const blob = encodeColumns([[42, 43]]);
    const shifted = new Uint8Array(blob.byteLength + 3);
    shifted.set(blob, 3);
    expect(Array.from(decodeColumns(shifted.subarray(3))[0])).toEqual([42, 43]);
  });

  it('rejects corrupted data', () => {
    expect(() => decodeColumns(new Uint8Array(5))).toThrow();
    expect(() => encodeColumns([[1, 2], [1]])).toThrow();
  });

  it('keeps missing GPS speed and accuracy as null', () => {
    const fixes = [{ t: 0, latitude: 46, longitude: 3, speed: null, accuracy: null }];
    expect(blobToGps(gpsToBlob(fixes))).toEqual(fixes);
  });
});

describe('session repository (save and read back)', () => {
  it('stores and reloads a processed session', async () => {
    const repo = createMemoryRepository();
    const { recording } = simulateRecording({ seed: 12 });
    const { summary, series } = processRecording(recording);
    const id = newSessionId();
    await repo.save({ id, startedAt: recording.startedAt, source: 'demo', summary }, series, recording.gps);

    const list = await repo.list();
    expect(list).toHaveLength(1);
    expect(list[0].summary.distanceM).toBeCloseTo(summary.distanceM, 6);

    const reloaded = await repo.getSeries(id);
    expect(reloaded?.speed.length).toBe(series.speed.length);
    expect(reloaded?.latitude[100]).toBeCloseTo(series.latitude[100], 9);
    expect(await repo.getGps(id)).toHaveLength(recording.gps.length);
  });

  it('lists newest first and deletes by id or by source', async () => {
    const repo = createMemoryRepository();
    const { recording } = simulateRecording({ seed: 13 });
    const { summary, series } = processRecording(recording);
    await repo.save({ id: 'a', startedAt: 1, source: 'device', summary }, series, []);
    await repo.save({ id: 'b', startedAt: 2, source: 'demo', summary }, series, []);
    expect((await repo.list()).map((s) => s.id)).toEqual(['b', 'a']);

    expect(await repo.deleteWhere('demo')).toBe(1);
    expect((await repo.list()).map((s) => s.id)).toEqual(['a']);
    await repo.delete('a');
    expect(await repo.get('a')).toBeNull();
    expect((await repo.stats()).count).toBe(0);
  });
});

describe('parseSummary', () => {
  it('never turns an unreadable summary into a valid result', () => {
    expect(parseSummary(null).quality).toBe('invalid');
    expect(parseSummary({ distanceM: 'x', quality: 'good' }).distanceM).toBe(0);
  });
});

describe('raw data (re-processing and test exports)', () => {
  it('stores and reloads the raw accelerometer samples and metadata', async () => {
    const repo = createMemoryRepository();
    const { recording } = simulateRecording({ seed: 14 });
    const { summary, series } = processRecording(recording);
    const meta = {
      startedAt: recording.startedAt,
      durationMs: recording.durationMs,
      interruptions: [],
      maxTiltDriftDeg: 0,
      calibration: null,
      motionIntervalMs: 17,
    };
    await repo.save({ id: 'r', startedAt: 1, source: 'device', summary }, series, recording.gps, { motion: recording.motion, meta });
    const raw = await repo.getRaw('r');
    expect(raw?.meta).toEqual(meta);
    expect(raw?.motion.t.length).toBe(recording.motion.t.length);
    expect(raw?.motion.h1[42]).toBeCloseTo(recording.motion.h1[42], 12);
    // Re-processing the stored raw data gives the same result.
    const again = processRecording({ ...recording, motion: raw!.motion });
    expect(again.summary.distanceM).toBeCloseTo(summary.distanceM, 6);
  });

  it('returns null for sessions saved without raw data', async () => {
    const repo = createMemoryRepository();
    const { recording } = simulateRecording({ seed: 15 });
    const { summary, series } = processRecording(recording);
    await repo.save({ id: 'old', startedAt: 1, source: 'device', summary }, series, []);
    expect(await repo.getRaw('old')).toBeNull();
  });
});
