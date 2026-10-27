import { cleanFixes, processRecording } from './processing';
import { simulateRecording } from './simulate';

const KMH = 3.6;

describe('processRecording — simulated drive', () => {
  it('recovers distance and max speed from 1 Hz GPS + accelerometer', () => {
    const { recording, truth } = simulateRecording({ seed: 7 });
    const { summary } = processRecording(recording);

    expect(summary.alignment).toBe('gps');
    expect(Math.abs(summary.distanceM - truth.distanceM) / truth.distanceM).toBeLessThan(0.03);
    expect(Math.abs(summary.maxSpeed - truth.maxSpeed) * KMH).toBeLessThan(3);
  });

  it('finds the vehicle axes whatever the phone yaw and axis sign convention', () => {
    for (const [mountYaw, mirrored] of [
      [0.5, false],
      [2.4, true],
      [-1.2, true],
    ] as const) {
      const { recording } = simulateRecording({ seed: 3, mountYaw, mirrored });
      const { summary } = processRecording(recording);
      expect(summary.alignment).toBe('gps');
      // Scenario: +3.5 m/s² launch, -6 m/s² braking, 2.5 m/s² left, ~3.3 m/s² right.
      expect(summary.peakAccel).toBeGreaterThan(2.8);
      expect(summary.peakAccel).toBeLessThan(4.3);
      expect(summary.peakBrake).toBeGreaterThan(5);
      expect(summary.peakBrake).toBeLessThan(7);
      expect(summary.peakLatLeft).toBeGreaterThan(1.8);
      expect(summary.peakLatRight).toBeGreaterThan(2.3);
    }
  });

  it('defines averages on absolute values so braking does not cancel acceleration', () => {
    const { recording } = simulateRecording({ seed: 11 });
    const { summary } = processRecording(recording);
    expect(summary.meanAbsLong).toBeGreaterThan(0.5);
    expect(summary.meanAbsLat).toBeGreaterThan(0.3);
  });

  it('produces a 10 Hz series with a position for every sample', () => {
    const { recording } = simulateRecording({ seed: 5 });
    const { series } = processRecording(recording);
    expect(series.t[1] - series.t[0]).toBe(100);
    expect(series.latitude.length).toBe(series.t.length);
    expect(series.latitude.every((v) => v > 46 && v < 47.5)).toBe(true);
  });

  it('labels demo data as simulated', () => {
    const { recording } = simulateRecording({ seed: 1 });
    expect(processRecording(recording).summary.warnings[0]).toMatch(/simulées/);
  });
});

describe('processRecording — degraded data', () => {
  it('handles invalid GPS speeds (-1) by deriving speed from positions', () => {
    const { recording, truth } = simulateRecording({ seed: 9, invalidGpsSpeed: true });
    const { summary } = processRecording(recording);
    expect(summary.quality).not.toBe('invalid');
    expect(Math.abs(summary.distanceM - truth.distanceM) / truth.distanceM).toBeLessThan(0.08);
  });

  it('flags a GPS gap', () => {
    const { recording } = simulateRecording({ seed: 2, gpsGap: { from: 20_000, to: 29_000 } });
    const { summary } = processRecording(recording);
    expect(summary.warnings.some((w) => w.startsWith('Coupure GPS'))).toBe(true);
  });

  it('falls back to GPS only without accelerometer data', () => {
    const { recording, truth } = simulateRecording({ seed: 4, noMotion: true });
    const { summary } = processRecording(recording);
    expect(summary.alignment).toBe('mounting');
    expect(summary.peakAccel).toBe(0);
    expect(summary.warnings.some((w) => w.includes('Capteurs de mouvement insuffisants'))).toBe(true);
    expect(Math.abs(summary.distanceM - truth.distanceM) / truth.distanceM).toBeLessThan(0.05);
  });

  it('is invalid without GPS', () => {
    const { recording } = simulateRecording({ seed: 6 });
    const { summary } = processRecording({ ...recording, gps: [] });
    expect(summary.quality).toBe('invalid');
    expect(summary.distanceM).toBe(0);
  });

  it('is invalid when too short', () => {
    const { recording } = simulateRecording({ seed: 6, scenario: [{ seconds: 3, accel: 1, yawRate: 0 }] });
    expect(processRecording(recording).summary.quality).toBe('invalid');
  });

  it('reports background interruptions and phone movement', () => {
    const { recording } = simulateRecording({ seed: 8 });
    const { summary } = processRecording({
      ...recording,
      interruptions: [{ from: 10_000, to: 14_000 }],
      maxTiltDriftDeg: 15,
    });
    expect(summary.warnings.some((w) => w.includes('arrière-plan'))).toBe(true);
    expect(summary.warnings.some((w) => w.includes('déplacé'))).toBe(true);
    expect(summary.quality).toBe('poor');
  });
});

describe('cleanFixes', () => {
  it('drops inaccurate, non-finite and duplicate fixes and sorts by time', () => {
    const base = { latitude: 46, longitude: 3, speed: 1, accuracy: 5 };
    const out = cleanFixes(
      [
        { ...base, t: 2000 },
        { ...base, t: 1000 },
        { ...base, t: 1000, speed: 2 },
        { ...base, t: 3000, accuracy: 120 },
        { ...base, t: 4000, latitude: NaN },
      ],
      10_000,
    );
    expect(out.map((f) => f.t)).toEqual([1000, 2000]);
    expect(out[0].speed).toBe(2);
  });
});

describe('processRecording — GPS errors at rest (regression: 1250 km/h)', () => {
  function stationaryRecording() {
    const { recording } = simulateRecording({ seed: 21, scenario: [{ seconds: 60, accel: 0, yawRate: 0 }], noMotion: true });
    const base = recording.gps[0];
    const gps = [] as typeof recording.gps;
    // Positions wandering ±8 m, no Doppler speed (iOS reports -1 when stopped).
    for (let i = 0; i < 60; i++) {
      gps.push({ ...base, t: i * 1000, latitude: base.latitude + Math.sin(i * 1.7) * 7e-5, speed: null, accuracy: 10 });
      // Burst: a second fix 50 ms later, 30 m away.
      if (i % 10 === 5) gps.push({ ...base, t: i * 1000 + 50, latitude: base.latitude + 2.7e-4, speed: null, accuracy: 10 });
    }
    return { ...recording, gps };
  }

  it('does not invent speed from position noise or close fix bursts', () => {
    const { summary } = processRecording(stationaryRecording());
    expect(summary.maxSpeed * KMH).toBeLessThan(15);
    expect(summary.distanceM).toBeLessThan(60);
  });

  it('ignores a teleporting fix and an absurd Doppler speed', () => {
    const { recording } = simulateRecording({ seed: 22 });
    const gps = recording.gps.map((f, i) =>
      i === 20 ? { ...f, latitude: f.latitude + 0.05 } : i === 30 ? { ...f, speed: 347 } : f,
    );
    const { summary } = processRecording({ ...recording, gps });
    expect(summary.maxSpeed * KMH).toBeLessThan(110);
    expect(summary.warnings.some((w) => w.includes('aberrante'))).toBe(true);
  });
});
