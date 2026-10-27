import { useEffect, useState } from 'react';

/**
 * Reads a value at a fixed rate (default 8 Hz). Used to display sensor data
 * without re-rendering on every sensor event. The first value arrives after one tick.
 */
export function usePolled<T>(read: (() => T) | null, hz = 8): T | null {
  const [value, setValue] = useState<T | null>(null);

  useEffect(() => {
    if (!read) return;
    const id = setInterval(() => setValue(read()), 1000 / hz);
    return () => clearInterval(id);
  }, [read, hz]);

  return read ? value : null;
}
