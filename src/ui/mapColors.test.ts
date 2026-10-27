import { kmhToMs } from '@/core/units';

import { colorRoute, polylineIndices, scaleColor, SPEED_SCALE_MAX_MS, SPEED_STOPS } from './mapColors';

describe('speed colors (fixed 0–250 km/h scale)', () => {
  const at = (kmh: number) => scaleColor(SPEED_STOPS, kmhToMs(kmh) / SPEED_SCALE_MAX_MS);

  it('is vivid red from 250 km/h and above', () => {
    expect(at(250)).toBe('#ff1a1a');
    expect(at(320)).toBe('#ff1a1a');
  });

  it('is orange around 170 km/h and cyan when stopped', () => {
    expect(at(170)).toBe('#ff8a1f');
    expect(at(0)).toBe('#4fc3f7');
  });

  it('handles invalid input', () => {
    expect(scaleColor(SPEED_STOPS, NaN)).toBe('#4fc3f7');
  });
});

describe('polylineIndices', () => {
  it('keeps first and last points within the limit', () => {
    const idx = polylineIndices(5000, 800);
    expect(idx).toHaveLength(800);
    expect(idx[0]).toBe(0);
    expect(idx[799]).toBe(4999);
  });
});

describe('colorRoute', () => {
  const series = {
    t: Float64Array.from([0, 100, 200]),
    speed: Float64Array.from([0, 10, 20]),
    long: Float64Array.from([0, 3, 0]),
    lat: Float64Array.from([0, 4, 0]),
    latitude: Float64Array.from([46, 46.0001, 46.0002]),
    longitude: Float64Array.from([3, 3, 3]),
  };

  it('splits the route into continuous colored segments', () => {
    const r = colorRoute(series, 'speed');
    expect(r.range).toEqual([0, SPEED_SCALE_MAX_MS]);
    expect(r.segments?.[0].coordinates[0]).toEqual(r.coordinates[0]);
    const last = r.segments![r.segments!.length - 1];
    expect(last.coordinates[last.coordinates.length - 1]).toEqual(r.coordinates[r.coordinates.length - 1]);
  });

  it('keeps segments connected end to start', () => {
    const n = 50;
    const long = Float64Array.from({ length: n }, (_, i) => i);
    const big = { t: long, speed: long, long, lat: long, latitude: long.map((v) => 46 + v * 1e-5), longitude: long.map(() => 3) };
    const segs = colorRoute(big, 'g').segments!;
    for (let i = 1; i < segs.length; i++) expect(segs[i].coordinates[0]).toEqual(segs[i - 1].coordinates[segs[i - 1].coordinates.length - 1]);
  });

  it('uses the combined G for the G filter', () => {
    expect(colorRoute(series, 'g').range).toEqual([0, 5]);
  });

  it('has no gradient for the plain route', () => {
    expect(colorRoute(series, 'route').segments).toBeNull();
  });
});
