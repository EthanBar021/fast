import { accelIn, gToMs2, kmhToMs, ms2ToG, msToKmh, msToMph, speedIn, STANDARD_GRAVITY } from './units';

describe('units', () => {
  it('converts speed between m/s, km/h and mph', () => {
    expect(msToKmh(10)).toBeCloseTo(36);
    expect(kmhToMs(100)).toBeCloseTo(27.7778, 4);
    expect(kmhToMs(msToKmh(12.3))).toBeCloseTo(12.3);
    expect(msToMph(kmhToMs(160.9344))).toBeCloseTo(100);
  });

  it('converts acceleration between m/s² and g', () => {
    expect(ms2ToG(STANDARD_GRAVITY)).toBe(1);
    expect(gToMs2(0.5)).toBeCloseTo(4.903325);
    expect(ms2ToG(gToMs2(-0.8))).toBeCloseTo(-0.8);
  });

  it('converts to the selected display unit', () => {
    expect(speedIn('kmh', 10)).toBeCloseTo(36);
    expect(speedIn('mph', 10)).toBeCloseTo(22.3694, 4);
    expect(accelIn('g', STANDARD_GRAVITY)).toBe(1);
    expect(accelIn('ms2', 3.2)).toBe(3.2);
  });
});
