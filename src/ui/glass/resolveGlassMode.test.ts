import { resolveGlassMode } from './resolveGlassMode';

describe('resolveGlassMode', () => {
  it('uses native glass in auto mode when available', () => {
    expect(resolveGlassMode('auto', false, true)).toBe('native');
  });

  it('falls back to simulated glass when native is unavailable', () => {
    expect(resolveGlassMode('auto', false, false)).toBe('simulated');
  });

  it('honours an explicit simulated preference', () => {
    expect(resolveGlassMode('simulated', false, true)).toBe('simulated');
  });

  it('is opaque when the user or the system asks for it', () => {
    expect(resolveGlassMode('opaque', false, true)).toBe('opaque');
    expect(resolveGlassMode('auto', true, true)).toBe('opaque');
    expect(resolveGlassMode('simulated', true, false)).toBe('opaque');
  });
});
