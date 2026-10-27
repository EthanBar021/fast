import { parseSummary } from '@/models/sessionValidation';
import type { Session } from '@/models/session';

import { periodSummary } from './periodSummary';

const DAY = 86_400_000;
const NOW = 100 * DAY;

function session(id: string, daysAgo: number, overrides: Omit<Partial<Session>, 'summary'> & { summary?: Record<string, unknown> } = {}): Session {
  return {
    id,
    startedAt: NOW - daysAgo * DAY,
    source: 'device',
    ...overrides,
    summary: parseSummary({
      quality: 'good',
      distanceM: 1000,
      movingTimeMs: 60_000,
      maxSpeed: 30,
      peakAccel: 3,
      peakBrake: 5,
      peakLatLeft: 2,
      peakLatRight: 4,
      ...(overrides.summary ?? {}),
    }),
  };
}

describe('periodSummary', () => {
  it('sums real sessions of the last 30 days and keeps the records', () => {
    const s = periodSummary(
      [session('a', 1), session('b', 10, { summary: { maxSpeed: 50, peakLatRight: 6 } }), session('old', 45)],
      NOW,
    );
    expect(s.sessions).toBe(2);
    expect(s.distanceM).toBe(2000);
    expect(s.maxSpeed).toBe(50);
    expect(s.peakLat).toBe(6);
  });

  it('ignores demo and invalid sessions', () => {
    const s = periodSummary([session('demo', 1, { source: 'demo' }), session('bad', 1, { summary: { quality: 'invalid' } })], NOW);
    expect(s.sessions).toBe(0);
    expect(s.maxSpeed).toBe(0);
  });
});
