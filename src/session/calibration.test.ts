import { makeRng } from '@/core/simulate';

import { analyzeWindow, buildBasis, CalibrationCollector, cross, dot, norm, type MotionSample } from './calibration';

const G = 9.80665;

function still(t: number, rng = makeRng(1), tiltDeg = 15): MotionSample {
  const a = (tiltDeg * Math.PI) / 180;
  // Portrait, leaning back by `tiltDeg`: gravity mostly along y, part along z.
  const incl = { x: rng.gauss() * 0.03, y: G * Math.cos(a) + rng.gauss() * 0.03, z: G * Math.sin(a) + rng.gauss() * 0.03 };
  return { t, incl, user: { x: 0, y: 0, z: 0 } };
}

describe('CalibrationCollector', () => {
  it('succeeds after a still window', () => {
    const c = new CalibrationCollector(2000, 10000);
    const rng = makeRng(2);
    let status = c.push(still(0, rng));
    for (let t = 20; t <= 2100 && status.phase === 'collecting'; t += 20) status = c.push(still(t, rng));
    expect(status.phase).toBe('done');
    if (status.phase === 'done') expect(status.result.tiltDeg).toBeCloseTo(15, 0);
  });

  it('restarts on a jolt and fails if never still (false start of the calibration)', () => {
    const c = new CalibrationCollector(2000, 6000);
    const rng = makeRng(3);
    let status = c.push(still(0, rng));
    for (let t = 20; t <= 7000 && status.phase === 'collecting'; t += 20) {
      const s = still(t, rng);
      if (t % 1000 === 0) s.incl.x += 3; // someone touches the phone every second
      status = c.push(s);
    }
    expect(status).toEqual({ phase: 'failed', reason: 'unstable' });
  });

  it('rejects a phone that is not in portrait', () => {
    const c = new CalibrationCollector(1000, 5000);
    let status = c.push(still(0, makeRng(4), 80));
    for (let t = 20; t <= 1200 && status.phase === 'collecting'; t += 20) status = c.push(still(t, makeRng(t), 80));
    expect(status).toEqual({ phase: 'failed', reason: 'orientation' });
  });
});

describe('analyzeWindow', () => {
  it('rejects inconsistent gravity (sensor problem)', () => {
    const samples = Array.from({ length: 50 }, (_, i) => ({ t: i * 20, incl: { x: 0, y: 4, z: 0 }, user: null }));
    expect(analyzeWindow(samples)).toEqual({ ok: false, reason: 'sensor' });
  });
});

describe('buildBasis', () => {
  it('returns an orthonormal basis with forward horizontal', () => {
    const b = buildBasis({ x: 0.3, y: 9.2, z: 3.1 });
    expect(norm(b.up)).toBeCloseTo(1);
    expect(norm(b.forward)).toBeCloseTo(1);
    expect(dot(b.up, b.forward)).toBeCloseTo(0);
    expect(dot(b.left, cross(b.up, b.forward))).toBeCloseTo(1);
    // Back of the phone points forward: forward has a negative z component.
    expect(b.forward.z).toBeLessThan(0);
  });
});
