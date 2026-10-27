/** Median of a list of numbers, `null` when empty. Does not mutate the input. */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Events per second over the last `windowMs` (lower bound excluded), computed from arrival times (ms, ascending).
 * Returns `null` until at least two events fall in the window.
 */
export function eventRate(arrivalTimes: readonly number[], now: number, windowMs: number): number | null {
  const from = now - windowMs;
  let count = 0;
  for (let i = arrivalTimes.length - 1; i >= 0 && arrivalTimes[i] > from; i--) count++;
  return count < 2 ? null : count / (windowMs / 1000);
}

/** Successive differences of an ascending series: [t1-t0, t2-t1, …]. */
export function deltas(values: readonly number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < values.length; i++) out.push(values[i] - values[i - 1]);
  return out;
}

/** Fixed-capacity FIFO buffer for numbers. Oldest values are dropped. */
export class RingBuffer {
  private readonly data: number[] = [];

  constructor(private readonly capacity: number) {}

  push(value: number): void {
    this.data.push(value);
    if (this.data.length > this.capacity) this.data.shift();
  }

  values(): readonly number[] {
    return this.data;
  }

  clear(): void {
    this.data.length = 0;
  }
}
