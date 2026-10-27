import * as Location from 'expo-location';
import { DeviceMotion } from 'expo-sensors';
import { AppState } from 'react-native';

import { eventRate, RingBuffer } from '@/core/stats';
import { log } from '@/dev/log';
import type { GpsFix, RawRecording } from '@/models/session';

import { angleDeg, dot, gravityOf, sub, type CalibrationResult } from './calibration';

export interface LiveSnapshot {
  elapsedMs: number;
  /** Latest valid GPS speed, m/s, or null if none / too old. */
  speed: number | null;
  /** Smoothed accelerations in the assumed vehicle axes (mounting), m/s². */
  long: number;
  lat: number;
  peakAccel: number;
  peakBrake: number;
  peakLat: number;
  gpsAccuracy: number | null;
  gpsAgeMs: number | null;
  gpsFixes: number;
  motionRateHz: number | null;
  tiltDriftDeg: number;
}

const LIVE_TAU_S = 0.3;
const GPS_STALE_MS = 3000;

/**
 * Records DeviceMotion + GPS for a measurement. All data is kept in plain arrays
 * outside React; the UI reads `live()` at its own pace (~10 Hz).
 *
 * Times: motion samples use their arrival time (performance.now) because the time
 * base of Expo's native timestamps is undocumented; GPS fixes use their own
 * timestamp (epoch ms) relative to the session start.
 */
export function startRecorder(calibration: CalibrationResult, motionIntervalMs: number, source: 'device' = 'device') {
  const { up, forward, left } = calibration.basis;
  const t0 = performance.now();
  const startedAt = Date.now();
  const motion = { t: [] as number[], h1: [] as number[], h2: [] as number[], up: [] as number[] };
  const gps: GpsFix[] = [];
  const arrivals = new RingBuffer(300);
  const interruptions: { from: number; to: number }[] = [];
  let backgroundSince: number | null = null;
  let emaLong = 0;
  let emaLat = 0;
  let lastT = 0;
  let peakAccel = 0;
  let peakBrake = 0;
  let peakLat = 0;
  let tiltEma = 0;
  let maxTilt = 0;
  let lastFixArrival: number | null = null;
  let lastSpeed: number | null = null;
  let lastAccuracy: number | null = null;
  let stopped = false;

  DeviceMotion.setUpdateInterval(motionIntervalMs);
  const motionSub = DeviceMotion.addListener((m) => {
    if (stopped || !m.accelerationIncludingGravity) return;
    const now = performance.now();
    const t = now - t0;
    arrivals.push(now);
    const user = m.acceleration ?? sub(m.accelerationIncludingGravity, calibration.gravity);
    const h1 = dot(user, forward);
    const h2 = dot(user, left);
    motion.t.push(t);
    motion.h1.push(h1);
    motion.h2.push(h2);
    motion.up.push(dot(user, up));

    const dt = Math.min(0.2, Math.max(0, (t - lastT) / 1000));
    lastT = t;
    const k = 1 - Math.exp(-dt / LIVE_TAU_S);
    emaLong += k * (h1 - emaLong);
    emaLat += k * (h2 - emaLat);
    peakAccel = Math.max(peakAccel, emaLong);
    peakBrake = Math.max(peakBrake, -emaLong);
    peakLat = Math.max(peakLat, Math.abs(emaLat));

    // Phone moved in its mount? Compare the current gravity direction with calibration.
    const tilt = angleDeg(gravityOf({ incl: m.accelerationIncludingGravity, user: m.acceleration ?? null }), calibration.gravity);
    tiltEma += 0.02 * (tilt - tiltEma);
    maxTilt = Math.max(maxTilt, tiltEma);
  });

  let locationSub: Location.LocationSubscription | null = null;
  Location.watchPositionAsync({ accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 0 }, (fix) => {
    if (stopped) return;
    const speed = fix.coords.speed;
    gps.push({
      t: fix.timestamp - startedAt,
      latitude: fix.coords.latitude,
      longitude: fix.coords.longitude,
      speed: speed !== null && speed >= 0 ? speed : null,
      accuracy: fix.coords.accuracy,
    });
    lastFixArrival = performance.now();
    lastSpeed = speed !== null && speed >= 0 ? speed : lastSpeed;
    lastAccuracy = fix.coords.accuracy;
  }).then(
    (s) => {
      if (stopped) s.remove();
      else locationSub = s;
    },
    (e: unknown) => log('error', 'recorder', 'GPS indisponible', String(e)),
  );

  const appStateSub = AppState.addEventListener('change', (state) => {
    const t = performance.now() - t0;
    if (state === 'background' && backgroundSince === null) {
      backgroundSince = t;
      log('warn', 'recorder', 'Application en arrière-plan pendant la mesure');
    } else if (state === 'active' && backgroundSince !== null) {
      interruptions.push({ from: backgroundSince, to: t });
      backgroundSince = null;
    }
  });

  log('info', 'recorder', 'Mesure démarrée', { motionIntervalMs, tiltDeg: Math.round(calibration.tiltDeg) });

  const api = {
    live(): LiveSnapshot {
      const now = performance.now();
      const gpsAgeMs = lastFixArrival === null ? null : now - lastFixArrival;
      return {
        elapsedMs: now - t0,
        speed: gpsAgeMs !== null && gpsAgeMs < GPS_STALE_MS ? lastSpeed : null,
        long: emaLong,
        lat: emaLat,
        peakAccel,
        peakBrake,
        peakLat,
        gpsAccuracy: lastAccuracy,
        gpsAgeMs,
        gpsFixes: gps.length,
        motionRateHz: eventRate(arrivals.values(), now, 1000),
        tiltDriftDeg: tiltEma,
      };
    },
    /** Stops all sensors and returns the raw recording. */
    stop(): RawRecording {
      stopped = true;
      clearInterval(heartbeat);
      motionSub.remove();
      locationSub?.remove();
      appStateSub.remove();
      const durationMs = performance.now() - t0;
      if (backgroundSince !== null) interruptions.push({ from: backgroundSince, to: durationMs });
      log('info', 'recorder', 'Mesure terminée', {
        durationS: Math.round(durationMs / 1000),
        motionSamples: motion.t.length,
        gpsFixes: gps.length,
        maxTiltDeg: Math.round(maxTilt),
      });
      const { gravity, basis, tiltDeg, noise, samples } = calibration;
      return {
        startedAt,
        durationMs,
        motion,
        gps,
        interruptions,
        maxTiltDriftDeg: maxTilt,
        source,
        calibration: { gravity, basis, tiltDeg, noise, samples },
        motionIntervalMs,
      };
    },
    /** Stops everything without keeping the data. */
    cancel() {
      stopped = true;
      clearInterval(heartbeat);
      motionSub.remove();
      locationSub?.remove();
      appStateSub.remove();
      log('info', 'recorder', 'Mesure annulée');
    },
  };

  // Every 10 s, a compact status line in the log: helps diagnose a test drive afterwards.
  const heartbeat = setInterval(() => {
    const l = api.live();
    log('info', 'recorder', 'Suivi', {
      t: Math.round(l.elapsedMs / 1000),
      v: l.speed === null ? null : Number(l.speed.toFixed(1)),
      acc: l.gpsAccuracy === null ? null : Math.round(l.gpsAccuracy),
      gpsAge: l.gpsAgeMs === null ? null : Math.round(l.gpsAgeMs),
      fixes: l.gpsFixes,
      hz: l.motionRateHz === null ? null : Math.round(l.motionRateHz),
      long: Number(l.long.toFixed(2)),
      lat: Number(l.lat.toFixed(2)),
      tilt: Number(l.tiltDriftDeg.toFixed(1)),
    });
  }, 10_000);

  return api;
}

export type Recorder = ReturnType<typeof startRecorder>;
