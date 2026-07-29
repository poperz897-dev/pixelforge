import { useState, useCallback } from 'react';

// A `useState` that mirrors itself into localStorage. Wrapped in try/catch
// throughout because Safari private-mode (and quota-exceeded cases) can
// throw on access -- in which case this just quietly behaves like plain
// in-memory state for that session instead of crashing the app.
export function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? JSON.parse(raw) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const update = useCallback(
    (next) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? next(prev) : next;
        try {
          localStorage.setItem(key, JSON.stringify(resolved));
        } catch {
          // Storage unavailable -- state still updates in memory, it just
          // won't survive a reload.
        }
        return resolved;
      });
    },
    [key]
  );

  return [value, update];
}
