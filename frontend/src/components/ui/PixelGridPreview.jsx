import { useRef, useEffect } from 'react';
import { computeCanvasSize, drawPixelGrid } from '../../utils/renderGrid.js';

export default function PixelGridPreview({ pixels, width, height, gridShape = 'square', isoRatioW, isoRatioH, cellPx = 10, checkerboard = false, className = '' }) {
  const canvasRef = useRef(null);
  const { canvasWidth, canvasHeight } = computeCanvasSize({ width, height, cellPx });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !pixels || !width || !height) return;
    const ctx = canvas.getContext('2d');
    const nested = Array.from({ length: height }, (_, y) => pixels.slice(y * width, (y + 1) * width));
    drawPixelGrid(ctx, { grid: nested, width, height, gridShape, isoRatioW, isoRatioH, cellPx, showCheckerboard: checkerboard, showGridLines: false });
  }, [pixels, width, height, gridShape, isoRatioW, isoRatioH, cellPx, checkerboard]);

  if (!pixels || !width || !height) return null;
  return <canvas ref={canvasRef} width={canvasWidth} height={canvasHeight} className={className} />;
}