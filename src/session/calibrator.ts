import { DeviceMotion } from 'expo-sensors';

import { log } from '@/dev/log';

import { CalibrationCollector, type CollectorStatus } from './calibration';

const CALIBRATION_INTERVAL_MS = 20;

/**
 * Runs a calibration on live DeviceMotion data. `onStatus` is called at most
 * ~10 times per second while collecting, then once with the final status.
 */
export function startCalibration(onStatus: (status: CollectorStatus) => void): () => void {
  const collector = new CalibrationCollector();
  const t0 = performance.now();
  let lastEmit = 0;
  let done = false;

  DeviceMotion.setUpdateInterval(CALIBRATION_INTERVAL_MS);
  const sub = DeviceMotion.addListener((m) => {
    if (done || !m.accelerationIncludingGravity) return;
    const t = performance.now() - t0;
    const status = collector.push({
      t,
      incl: m.accelerationIncludingGravity,
      user: m.acceleration ?? null,
    });
    if (status.phase !== 'collecting') {
      done = true;
      sub.remove();
      log(status.phase === 'done' ? 'info' : 'warn', 'calibration', status.phase === 'done' ? 'Calibration réussie' : 'Calibration échouée', status.phase === 'done'
        ? {
            tiltDeg: Number(status.result.tiltDeg.toFixed(1)),
            noise: Number(status.result.noise.toFixed(3)),
            samples: status.result.samples,
            gravity: status.result.gravity,
          }
        : { reason: status.reason });
      onStatus(status);
    } else if (t - lastEmit > 100) {
      lastEmit = t;
      onStatus(status);
    }
  });

  return () => {
    done = true;
    sub.remove();
  };
}
