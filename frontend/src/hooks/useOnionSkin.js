// frontend/src/hooks/useOnionSkin.js
import { useMemo } from 'react';
import { flattenDocument } from '../utils/compositing';

/**
 * Hook to generate onion skin layers for a given frame.
 * @param {Object} params
 * @param {Array} params.layers - layer array from document
 * @param {Object} params.cels - cel lookup (layerId->frameId->grid)
 * @param {Array} params.frames - frame array
 * @param {string} params.currentFrameId - ID of the active frame
 * @param {number} params.width - canvas width
 * @param {number} params.height - canvas height
 * @param {number} params.onionCount - number of frames before/after to show
 * @param {number} params.onionOpacity - base opacity (will fade with distance)
 * @param {string} params.tintBefore - hex color to tint previous frames
 * @param {string} params.tintAfter - hex color to tint next frames
 * @returns {Object} { before: [], after: [] } where each item is { grid, opacity, tint }
 */
export function useOnionSkin({
  layers,
  cels,
  frames,
  currentFrameId,
  width,
  height,
  onionCount = 1,
  onionOpacity = 0.25,
  tintBefore = '#4a9eff', // blue tint for previous
  tintAfter = '#ff6b6b',  // red tint for next
}) {
  return useMemo(() => {
    if (!frames || frames.length === 0 || !currentFrameId) {
      return { before: [], after: [] };
    }

    const currentIdx = frames.findIndex(f => f.id === currentFrameId);
    if (currentIdx === -1) return { before: [], after: [] };

    const getFlattened = (frameId) => {
      return flattenDocument({ layers, cels, frameId, width, height });
    };

    const before = [];
    for (let i = 1; i <= onionCount; i++) {
      const idx = currentIdx - i;
      if (idx < 0) break;
      const grid = getFlattened(frames[idx].id);
      // Fade opacity: further frames are more transparent
      const opacity = onionOpacity * (1 - i / (onionCount + 1));
      before.push({ grid, opacity, tint: tintBefore });
    }

    const after = [];
    for (let i = 1; i <= onionCount; i++) {
      const idx = currentIdx + i;
      if (idx >= frames.length) break;
      const grid = getFlattened(frames[idx].id);
      const opacity = onionOpacity * (1 - i / (onionCount + 1));
      after.push({ grid, opacity, tint: tintAfter });
    }

    return { before, after };
  }, [layers, cels, frames, currentFrameId, width, height, onionCount, onionOpacity, tintBefore, tintAfter]);
}