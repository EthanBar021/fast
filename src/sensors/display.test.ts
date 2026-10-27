import { proMotionFromModel } from './display';

describe('proMotionFromModel', () => {
  it('recognizes ProMotion iPhones', () => {
    expect(proMotionFromModel('iPhone16,1')).toBe(true); // 15 Pro
    expect(proMotionFromModel('iPhone18,3')).toBe(true); // 17
  });

  it('rejects known 60 Hz iPhones', () => {
    expect(proMotionFromModel('iPhone15,4')).toBe(false); // 15
    expect(proMotionFromModel('iPhone17,5')).toBe(false); // 16e
    expect(proMotionFromModel('iPhone18,5')).toBe(false); // 17e
  });

  it('returns null for unknown or newer models (measured instead)', () => {
    expect(proMotionFromModel('iPhone19,1')).toBeNull();
    expect(proMotionFromModel('arm64')).toBeNull();
    expect(proMotionFromModel(null)).toBeNull();
  });
});
