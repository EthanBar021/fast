import { deltas, eventRate, median, RingBuffer } from './stats';

describe('median', () => {
  it('handles empty, odd and even lists', () => {
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it('does not mutate the input', () => {
    const input = [3, 1, 2];
    median(input);
    expect(input).toEqual([3, 1, 2]);
  });
});

describe('eventRate', () => {
  it('counts events inside the window', () => {
    const times = Array.from({ length: 200 }, (_, i) => i * 10); // 100 Hz for 2 s
    expect(eventRate(times, 1990, 1000)).toBeCloseTo(100, 0);
  });

  it('returns null with fewer than two events', () => {
    expect(eventRate([], 1000, 1000)).toBeNull();
    expect(eventRate([500], 1000, 1000)).toBeNull();
  });

  it('ignores stale events (stream stopped)', () => {
    expect(eventRate([0, 10, 20], 5000, 1000)).toBeNull();
  });
});

describe('deltas', () => {
  it('returns successive differences', () => {
    expect(deltas([0, 10, 25])).toEqual([10, 15]);
    expect(deltas([5])).toEqual([]);
  });
});

describe('RingBuffer', () => {
  it('keeps only the most recent values', () => {
    const buffer = new RingBuffer(3);
    [1, 2, 3, 4].forEach((v) => buffer.push(v));
    expect(buffer.values()).toEqual([2, 3, 4]);
    buffer.clear();
    expect(buffer.values()).toEqual([]);
  });
});
