import { useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage.js';

const STORAGE_KEY = 'pixelforge:recent-colors';
const MAX_RECENT = 18;

// Tracks colors as they're actually *used* (picked from the wheel, a
// swatch, or the eyedropper) -- separate from the curated "My colors"
// palette, which the person builds up deliberately. Persisted locally so
// it works for guests too, same as the rest of the editor.
export function useRecentColors() {
  const [recent, setRecent] = useLocalStorage(STORAGE_KEY, []);

  const record = useCallback(
    (color) => {
      if (!color) return;
      const normalized = color.toLowerCase();
      setRecent((prev) => [normalized, ...prev.filter((c) => c !== normalized)].slice(0, MAX_RECENT));
    },
    [setRecent]
  );

  const clear = useCallback(() => setRecent([]), [setRecent]);

  return { recent, record, clear };
}
