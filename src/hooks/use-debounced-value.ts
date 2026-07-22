import { useEffect, useState } from 'react';

/**
 * A copy of `value` that only catches up after it has stopped changing for `delayMs`. Bind a text
 * input to the raw value (typing stays instant) but drive expensive work — list filtering, queries —
 * off this debounced copy so it runs once the user pauses, not on every keystroke. Each change
 * reschedules the pending update, so only the last value in a burst lands.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}
