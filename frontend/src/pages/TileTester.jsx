import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client.js';
import { ISO_RATIO_PRESETS } from '../utils/isoGrid.js';
import { useTileTester } from '../hooks/useTileTester.js';
import { setDummyRenderMode } from '../utils/heroSprite.js';
import TileLibrary from '../components/tester/TileLibrary.jsx';
import TestGrid from '../components/tester/TestGrid.jsx';
import WelcomeTutorial from '../components/editor/WelcomeTutorial.jsx';
import { useLocalStorage } from '../hooks/useLocalStorage.js';

const ARROW_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

const TUTORIAL_TIPS = [
  'Drag a tile from the library onto the grid, or select one and click/drag to paint.',
  'Right-click erases. Scroll to zoom, middle-drag to pan around.',
  'Arrow keys walk the hero — hold a key to keep moving, Escape deselects.',
  'Tile a different shape than your grid? Use "Match Grid to This Tile".',
];

export default function TileTester() {
  const [draftTiles, setDraftTiles] = useState([]);
  const [savedTiles, setSavedTiles] = useState([]);
  const [loading, setLoading] = useState(false);

  const t = useTileTester();

  // 'sprite' (default) shows the real, found-online sprite dummies; the
  // hand-coded procedural dummy stays available as a toggle for comparison.
  // Kept as plain local state — heroSprite.js's canvas render loop reads
  // the mode directly, so this only needs to drive the toggle button itself.
  const [dummyStyle, setDummyStyleState] = useState('sprite');
  const changeDummyStyle = (mode) => {
    setDummyStyleState(mode);
    setDummyRenderMode(mode);
  };

  const [seenTutorial, setSeenTutorial] = useLocalStorage('pixelforge:seen-tutorial-tester', false);
  const [tutorialOpen, setTutorialOpen] = useState(!seenTutorial);
  const closeTutorial = () => {
    setTutorialOpen(false);
    setSeenTutorial(true);
  };

  useEffect(() => {
    const raw = sessionStorage.getItem('tileTesterDraft');
    if (raw) {
      try {
        const d = JSON.parse(raw);
        setDraftTiles([d]);
        t.configureFromTile(d);
      } catch {
        /* ignore malformed draft */
      }
      sessionStorage.removeItem('tileTesterDraft');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLoading(true);
    api
      .listArtworks({ mine: 'true', limit: 24 })
      .then(async (list) => {
        const full = await Promise.all(list.items.map((it) => api.getArtwork(it.id).catch(() => null)));
        setSavedTiles(full.filter(Boolean));
      })
      .catch(() => setSavedTiles([]))
      .finally(() => setLoading(false));
  }, []);

  // Arrow keys drive continuous movement via setDirectionHeld (the hook's
  // animation loop advances one step whenever a key is held and the
  // previous step has finished) — this replaces relying on the browser's
  // own key-repeat, which is what caused the old stutter/teleport feel.
  // Non-movement shortcuts (clear/reset/patrol) still fire once per press.
  useEffect(() => {
    const isFormField = (el) => ['INPUT', 'SELECT', 'TEXTAREA'].includes(el?.tagName);

    const onKeyDown = (e) => {
      if (isFormField(e.target)) return;
      if (ARROW_KEYS.includes(e.key)) {
        e.preventDefault();
        t.setDirectionHeld(e.key, true);
        return;
      }
      if (e.key === 'c' || e.key === 'C') t.clearGrid();
      if (e.key === 'r' || e.key === 'R') t.resetDummy();
      if (e.key === 'p' || e.key === 'P') t.setPatrolMode((p) => !p);
      if (e.key === 'Escape') t.setSelectedTile(null);
    };
    const onKeyUp = (e) => {
      if (ARROW_KEYS.includes(e.key)) t.setDirectionHeld(e.key, false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [t]);

  const handleDragStart = useCallback((e, tile) => {
    e.dataTransfer.setData('application/json', JSON.stringify(tile));
    e.dataTransfer.effectAllowed = 'copy';
  }, []);

  const handleRatioChange = (key) => {
    const pr = ISO_RATIO_PRESETS.find((p) => p.key === key);
    if (pr?.w) {
      t.setGridShape('isometric');
      t.setIsoRatioW(pr.w);
      t.setIsoRatioH(pr.h);
      const r = pr.w / pr.h;
      t.setCellHeight(Math.round(t.cellWidth / r));
    }
  };

  const tileCount = t.tiles.flat().filter(Boolean).length;
  const heroType = t.gridShape === 'isometric' ? 'iso' : 'square';

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-starviolet to-indigo-600 rounded-xl flex items-center justify-center text-2xl shadow-glow ring-1 ring-white/10">
            🧪
          </div>
          <div>
            <h1 className="font-pixel text-base sm:text-lg text-slate-100">Tile Tester</h1>
            <p className="text-xs text-slate-400 mt-1">Real isometric tilemap engine · seamless connections · live preview</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-2 text-[11px] font-mono text-slate-400 bg-panel px-4 py-2 rounded-full border border-panel-border flex-wrap">
            <span>Arrows move</span>
            <span className="text-slate-600">·</span>
            <span>Click/drag paints</span>
            <span className="text-slate-600">·</span>
            <span>Right-click erases</span>
            <span className="text-slate-600">·</span>
            <span>Scroll zooms</span>
            <span className="text-slate-600">·</span>
            <span>Middle-drag pans</span>
          </div>
          <button
            onClick={() => setTutorialOpen(true)}
            title="Quick start guide"
            aria-label="Open quick start guide"
            className="glow-hover w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-mono text-slate-400 border border-slate-600 hover:text-starcyan hover:border-starcyan transition-colors"
          >
            ?
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_260px] gap-5 h-[calc(100vh-10rem)]">
        <TileLibrary
          draftTiles={draftTiles}
          savedTiles={savedTiles}
          onDragStart={handleDragStart}
          loading={loading}
          onSelectTile={(tile) => t.selectTile(tile)}
          selectedTileId={t.selectedTile?.id}
        />

        <div className="flex flex-col gap-4 min-h-0">
          <div className="pixel-frame bg-panel backdrop-blur-sm p-3 flex flex-wrap items-center gap-3">
            <div className="flex gap-1.5">
              <button
                onClick={() => t.setGridShape('square')}
                className={`glow-hover text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  t.gridShape === 'square' ? 'bg-indigo-600 text-white' : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                }`}
              >
                ◻ Square
              </button>
              <button
                onClick={() => t.setGridShape('isometric')}
                className={`glow-hover text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  t.gridShape === 'isometric' ? 'bg-indigo-600 text-white' : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                }`}
              >
                ◆ Isometric
              </button>
            </div>

            {t.gridShape === 'isometric' && (
              <select
                value={ISO_RATIO_PRESETS.find((p) => p.w != null && Math.abs(p.w / p.h - t.isoRatioW / t.isoRatioH) < 0.01)?.key || '2:1'}
                onChange={(e) => handleRatioChange(e.target.value)}
                className="bg-slate-800 text-slate-200 text-xs rounded-lg px-2 py-1.5 border border-slate-600 focus:border-starcyan outline-none"
              >
                {ISO_RATIO_PRESETS.filter((p) => p.key !== 'custom').map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
            )}

            <div className="h-5 w-px bg-slate-700 mx-1" />

            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Grid</span>
              <input
                type="number"
                min="4"
                max="64"
                value={t.dim}
                onChange={(e) => t.resizeGrid(Number(e.target.value))}
                className="w-14 bg-slate-800 text-slate-200 text-xs rounded-lg px-1.5 py-1 border border-slate-600 text-center"
              />
              <span className="text-slate-500 text-xs">× {t.dim}</span>
            </div>

            <div className="h-5 w-px bg-slate-700 mx-1" />

            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Zoom</span>
              <input
                type="range"
                min="0.25"
                max="4"
                step="0.05"
                value={t.zoom}
                onChange={(e) => t.setZoom(Number(e.target.value))}
                className="w-20 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-[10px] text-slate-400 font-mono w-9">{t.zoom.toFixed(2)}×</span>
              <button
                onClick={t.resetView}
                title="Reset pan & zoom"
                className="glow-hover text-[11px] px-2 py-1 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                ⤢ Fit
              </button>
            </div>

            <div className="flex items-center gap-1.5 ml-auto">
              <button
                onClick={() => t.setPaintMode('paint')}
                className={`glow-hover text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  t.paintMode === 'paint' ? 'bg-indigo-600 text-white' : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                }`}
              >
                🖌 Paint
              </button>
              <button
                onClick={() => t.setPaintMode('erase')}
                className={`glow-hover text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  t.paintMode === 'erase' ? 'bg-red-600 text-white' : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                }`}
              >
                🧹 Erase
              </button>
            </div>
          </div>

          {t.paintMode === 'paint' && !t.selectedTile && (
            <div className="pixel-frame-sm bg-panel border border-panel-border px-3 py-2 text-[11px] text-amber-300/90 -mt-1">
              Select a tile from the library to start painting, or drag one directly onto the grid.
            </div>
          )}

          <div className="flex-1 flex min-h-0">
            <TestGrid
              gridShape={t.gridShape}
              cellWidth={t.cellWidth}
              cellHeight={t.cellHeight}
              isoRatioW={t.isoRatioW}
              isoRatioH={t.isoRatioH}
              tiles={t.tiles}
              dummyScreenPos={t.dummyScreenPos}
              dummyDirection={t.dummyDirection}
              dummyWalkCycle={t.walkCycle}
              dummyIsMoving={t.isMoving}
              onPlaceTile={t.placeTile}
              onPaintCell={t.paintAtCell}
              onEraseCell={t.eraseAtCell}
              paintMode={t.paintMode}
              selectedTile={t.selectedTile}
              zoom={t.zoom}
              pan={t.pan}
              setZoom={t.setZoom}
              setPan={t.setPan}
              dim={t.dim}
            />
          </div>
        </div>

        <div className="space-y-4 overflow-auto pr-1">
          <div className="pixel-frame bg-panel backdrop-blur-sm p-4">
            <h3 className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-3">Session</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Grid</span>
                <span className="text-slate-200 font-mono">
                  {t.dim}×{t.dim}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Cell</span>
                <span className="text-slate-200 font-mono">
                  {t.cellWidth}×{t.cellHeight}
                </span>
              </div>
              {t.gridShape === 'isometric' && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Ratio</span>
                  <span className="text-starcyan font-mono">
                    {t.isoRatioW.toFixed(2)}:{t.isoRatioH.toFixed(2)}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-400">Tiles placed</span>
                <span className="text-starcyan font-mono">{tileCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Hero pos</span>
                <span className="text-slate-200 font-mono">
                  {t.dummyPos.col}, {t.dummyPos.row}
                </span>
              </div>
            </div>
          </div>

          <div className="pixel-frame bg-panel backdrop-blur-sm p-4">
            <h3 className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-3">Active Hero</h3>
            <div className="flex items-center gap-3 mb-3">
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${
                  heroType === 'square' ? 'bg-green-900/30 text-green-400' : 'bg-blue-900/30 text-blue-400'
                }`}
              >
                {heroType === 'square' ? '●' : '◆'}
              </div>
              <div>
                <p className="text-xs text-slate-100 font-medium capitalize">{heroType === 'iso' ? 'Isometric Hero' : 'Square Hero'}</p>
                <p className="text-[10px] text-slate-500">
                  {t.isMoving ? 'Walking…' : 'Idle'} · Facing {t.dummyDirection}
                </p>
              </div>
            </div>
            <div className="flex gap-1.5 mb-2">
              <button
                onClick={() => changeDummyStyle('sprite')}
                title="Real sprite-sheet dummy (LPC for square, Flare for isometric)"
                className={`glow-hover flex-1 text-[11px] px-2 py-1.5 rounded-lg transition-colors font-medium ${
                  dummyStyle === 'sprite' ? 'bg-indigo-600 text-white' : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                }`}
              >
                🧍 Sprite
              </button>
              <button
                onClick={() => changeDummyStyle('procedural')}
                title="Hand-coded procedural dummy"
                className={`glow-hover flex-1 text-[11px] px-2 py-1.5 rounded-lg transition-colors font-medium ${
                  dummyStyle === 'procedural' ? 'bg-indigo-600 text-white' : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                }`}
              >
                ▲ Procedural
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => t.setPatrolMode((p) => !p)}
                className={`glow-hover flex-1 text-[11px] px-2 py-1.5 rounded-lg transition-colors font-medium ${
                  t.patrolMode
                    ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-600/30'
                    : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700 border border-transparent'
                }`}
              >
                {t.patrolMode ? '⏸ Stop Patrol' : '▶ Patrol'}
              </button>
            </div>
          </div>

          <div className="pixel-frame bg-panel backdrop-blur-sm p-3 space-y-2">
            {t.selectedTile && (
              <>
                <button
                  onClick={() => t.setSelectedTile(null)}
                  className="glow-hover w-full text-xs px-3 py-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-slate-200 transition-colors"
                >
                  ✕ Deselect Tile ({t.selectedTile.title})
                </button>
                {(t.selectedTile.grid_shape !== t.gridShape || t.selectedTile.width !== t.cellWidth) && (
                  <button
                    onClick={() => t.matchGridToTile(t.selectedTile)}
                    className="glow-hover w-full text-xs px-3 py-2 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-200 border border-indigo-600/30 transition-colors"
                  >
                    ⤓ Match Grid to This Tile
                  </button>
                )}
              </>
            )}
            <button
              onClick={t.resetDummy}
              className="glow-hover w-full text-xs px-3 py-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-slate-200 transition-colors"
            >
              ↺ Reset Hero
            </button>
            <button
              onClick={() => {
                if (tileCount > 0 && !confirm('Clear all tiles?')) return;
                t.clearGrid();
              }}
              className="w-full text-xs px-3 py-2 rounded-lg bg-red-900/30 hover:bg-red-900/50 text-red-200 border border-red-900/20 transition-colors"
            >
              🗑 Clear Grid
            </button>
          </div>

          <div className="pixel-frame bg-panel backdrop-blur-sm p-4 space-y-3">
            <h3 className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Cell Config</h3>
            <div>
              <label className="text-[10px] text-slate-500 block mb-1 font-medium">Width (px)</label>
              <input
                type="number"
                min="8"
                max="128"
                step="8"
                value={t.cellWidth}
                onChange={(e) => {
                  const w = Number(e.target.value);
                  t.setCellWidth(w);
                  if (t.gridShape === 'isometric') {
                    const r = t.isoRatioW / t.isoRatioH;
                    t.setCellHeight(Math.round(w / r));
                  }
                }}
                className="w-full bg-slate-800 text-slate-200 text-xs rounded-lg px-2 py-1.5 border border-slate-600"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 block mb-1 font-medium">Height (px)</label>
              <input
                type="number"
                min="8"
                max="128"
                step="8"
                value={t.cellHeight}
                onChange={(e) => t.setCellHeight(Number(e.target.value))}
                className="w-full bg-slate-800 text-slate-200 text-xs rounded-lg px-2 py-1.5 border border-slate-600"
              />
            </div>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              Tip: these apply to the whole grid — pick a tile in the library, then use "Match Grid to This Tile" if you want the grid
              reshaped to fit it.
            </p>
          </div>
        </div>
      </div>

      <WelcomeTutorial open={tutorialOpen} onClose={closeTutorial} title="Testing your tiles" tips={TUTORIAL_TIPS} ctaLabel="Got it, let's test" />
    </div>
  );
}
