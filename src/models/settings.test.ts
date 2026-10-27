import { DEFAULT_SETTINGS, parseSettings } from './settings';

describe('parseSettings', () => {
  it('returns defaults for missing or malformed data', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('oops')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings({})).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps valid values', () => {
    const custom = {
      speedUnit: 'mph',
      accelUnit: 'ms2',
      glass: 'opaque',
      haptics: false,
      keepAwake: false,
      showWelcome: false,
      motionRateHz: 120,
    };
    expect(parseSettings(custom)).toEqual(custom);
  });

  it('replaces invalid fields only', () => {
    expect(parseSettings({ speedUnit: 'knots', haptics: 'yes', glass: 'simulated' })).toEqual({
      ...DEFAULT_SETTINGS,
      glass: 'simulated',
    });
  });

  it('accepts settings saved by an older version (missing fields)', () => {
    expect(parseSettings({ speedUnit: 'mph', haptics: false, glass: 'auto' })).toEqual({
      ...DEFAULT_SETTINGS,
      speedUnit: 'mph',
      haptics: false,
    });
  });

  it('migrates the old 50/100 Hz values to the default', () => {
    expect(parseSettings({ motionRateHz: 100 }).motionRateHz).toBe(60);
  });

  it('returns a fresh object each time', () => {
    expect(parseSettings(null)).not.toBe(DEFAULT_SETTINGS);
  });
});
