import { fuseSpeed } from './speedFusion';

describe('fuseSpeed', () => {
  it('follows a constant acceleration between sparse GPS fixes despite an accelerometer bias', () => {
    const dt = 0.1;
    const n = 201; // 20 s
    const trueAccel = 2;
    const bias = 0.3;
    const accel = Array.from({ length: n }, () => trueAccel + bias);
    const measurements = Array.from({ length: 21 }, (_, s) => ({ index: s * 10, speed: trueAccel * s, sigma: 0.3 }));
    const v = fuseSpeed(dt, accel, measurements);
    // Between fixes, at t = 10.5 s
    expect(v[105]).toBeCloseTo(21, 0);
    expect(Math.abs(v[195] - 39)).toBeLessThan(0.6);
  });

  it('never returns a negative speed', () => {
    const accel = Array.from({ length: 50 }, () => -3);
    const v = fuseSpeed(0.1, accel, [{ index: 0, speed: 0, sigma: 0.3 }]);
    expect(Math.min(...v)).toBeGreaterThanOrEqual(0);
  });

  it('handles an empty input', () => {
    expect(fuseSpeed(0.1, [], []).length).toBe(0);
  });
});
