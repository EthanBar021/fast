import { applyAlignment, fitAlignment, type AlignmentPair } from './alignment';

function pairsFor(angle: number, mirror: boolean): AlignmentPair[] {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const out: AlignmentPair[] = [];
  for (let i = 0; i < 40; i++) {
    const long = Math.sin(i * 0.7) * 3;
    const lat = Math.cos(i * 1.3) * 2;
    const h1 = c * long + s * lat;
    const h2 = (mirror ? -1 : 1) * (-s * long + c * lat);
    out.push({ h1, h2, long, lat });
  }
  return out;
}

describe('fitAlignment', () => {
  it.each([
    [0, false],
    [1.1, false],
    [-2.5, true],
    [Math.PI, true],
  ])('recovers angle %p (mirrored: %p)', (angle, mirror) => {
    const pairs = pairsFor(angle, mirror);
    const al = fitAlignment(pairs);
    expect(al.mirrored).toBe(mirror);
    expect(al.r2).toBeGreaterThan(0.999);
    const p = pairs[5];
    const v = applyAlignment(al, p.h1, p.h2);
    expect(v.long).toBeCloseTo(p.long, 6);
    expect(v.lat).toBeCloseTo(p.lat, 6);
  });

  it('returns identity with no data', () => {
    expect(fitAlignment([]).m).toEqual([1, 0, 0, 1]);
  });
});
