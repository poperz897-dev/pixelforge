import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import Canvas from '../components/editor/Canvas.jsx';
import ColorPalette from '../components/editor/ColorPalette.jsx';
import LayersPanel from '../components/editor/LayersPanel.jsx';
import Toolbar from '../components/editor/Toolbar.jsx';
import WelcomeTutorial from '../components/editor/WelcomeTutorial.jsx';
import PixelLoader from '../components/ui/PixelLoader.jsx';
import { useDocumentModel } from '../hooks/useDocumentModel.js';
import { toServerPayload, documentHasContent } from '../utils/documentModel.js';
import { useRecentColors } from '../hooks/useRecentColors.js';
import { useLocalStorage } from '../hooks/useLocalStorage.js';
import { api } from '../api/client.js';
import { computeCanvasSize, drawPixelGrid } from '../utils/renderGrid.js';
import { ISO_RATIO_PRESETS, ISO_GRID_SIZES, findIsoRatioPreset, isValidIsoCombo, validateCustomRatio } from '../utils/isoGrid.js';

const CATEGORIES = {
  game_asset: ['tile', 'character', 'mob', 'item', 'ui'],
  misc: ['icon', 'avatar', 'banner', 'other'],
};

const GRID_SIZES = [8, 16, 24, 32, 48, 64];

const TUTORIAL_TIPS = [
  'Pick a tool on the left — pencil, eraser, fill bucket, or eyedropper.',
  'Square or isometric — choose a shape and ratio before you start drawing.',
  'Grab a color from the wheel, a swatch, or your recently used colors.',
  'Title it and hit Save — or send it straight to the Tile Tester first.',
];

export default function Editor() {
  const { id } = useParams();
  const [artwork, setArtwork] = useState(null);
  const [loading, setLoading] = useState(!!id);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setLoadError('');
    api
      .getArtwork(id)
      .then((art) => {
        if (!art.is_owner) throw new Error('You can only edit your own artwork.');
        setArtwork(art);
      })
      .catch((e) => setLoadError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (id && loading) {
    return (
      <div className="flex justify-center py-24">
        <PixelLoader label="Loading your artwork…" />
      </div>
    );
  }
  if (id && loadError) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-red-400">{loadError}</p>
        <Link to="/gallery" className="text-indigo-400 text-sm mt-2 inline-block hover:text-indigo-300 transition-colors">
          ← Back to gallery
        </Link>
      </div>
    );
  }

  return <EditorInner key={id ?? 'new'} artworkId={id ?? null} initial={artwork} />;
}

function EditorInner({ artworkId, initial }) {
  const navigate = useNavigate();
  const isEditing = !!artworkId;

  // "Create an isometric tile" on the homepage links here with this hint
  // so it actually lands you somewhere ready to draw instead of the plain
  // square default -- only applies to a brand-new piece, never overrides
  // an existing artwork's real saved shape.
  const [searchParams] = useSearchParams();
  const preselectIso = !isEditing && searchParams.get('shape') === 'isometric';

  const [gridSize, setGridSize] = useState(initial?.width ?? 16);
  const [gridShape, setGridShape] = useState(initial?.grid_shape ?? (preselectIso ? 'isometric' : 'square'));
  const [isoRatioW, setIsoRatioW] = useState(initial?.iso_ratio_w ?? 2);
  const [isoRatioH, setIsoRatioH] = useState(initial?.iso_ratio_h ?? 1);
  const [isoRatioKey, setIsoRatioKey] = useState(() => findIsoRatioPreset(initial?.iso_ratio_w ?? 2, initial?.iso_ratio_h ?? 1));

  const {
    compositeGrid: grid,
    setPixel,
    floodFill,
    replaceColor,
    beginStroke,
    endStroke,
    undo,
    redo,
    clear,
    resize,
    canUndo,
    canRedo,
    document: docModel,
    activeLayerId,
    activeFrameId,
    activeLayer,
    setActiveLayerId,
    addLayer,
    addGroup,
    duplicateLayer,
    removeLayer,
    renameLayer,
    toggleLayerVisible,
    toggleLayerLocked,
    setLayerOpacity,
    setLayerBlendMode,
    reorderLayer,
  } = useDocumentModel(gridSize, gridSize, initial?.document ?? null);

  const [tool, setTool] = useState('pencil');
  const [showGridLines, setShowGridLines] = useState(true);
  const [brushSize, setBrushSize] = useState(1);
  const [brushShape, setBrushShape] = useState('square');
  const [pixelPerfect, setPixelPerfect] = useState(false);
  const [shapeFilled, setShapeFilled] = useState(false);
  const [symmetry, setSymmetry] = useState({ horizontal: false, vertical: false });
  const toggleSymmetryAxis = (axis) => setSymmetry((prev) => ({ ...prev, [axis]: !prev[axis] }));
  const [activeColor, setActiveColor] = useState('#1a1c2c');
  const [customColors, setCustomColors] = useState([]);
  const { recent: recentColors, record: recordRecentColor } = useRecentColors();

  const [title, setTitle] = useState(initial?.title ?? '');
  const [projectType, setProjectType] = useState(initial?.project_type ?? 'game_asset');
  const [category, setCategory] = useState(initial?.category ?? 'tile');
  const [visibility, setVisibility] = useState(initial?.visibility ?? 'private');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [savedPalettes, setSavedPalettes] = useState([]);
  const [paletteName, setPaletteName] = useState('');
  const [savingPalette, setSavingPalette] = useState(false);
  const [ratioError, setRatioError] = useState('');

  const [seenTutorial, setSeenTutorial] = useLocalStorage('pixelforge:seen-tutorial-editor', false);
  const [tutorialOpen, setTutorialOpen] = useState(!seenTutorial);
  const closeTutorial = () => {
    setTutorialOpen(false);
    setSeenTutorial(true);
  };

  const categoryOptions = useMemo(() => CATEGORIES[projectType], [projectType]);
  const validIsoSizes = useMemo(() => ISO_GRID_SIZES.filter((s) => isValidIsoCombo(s, isoRatioW, isoRatioH)), [isoRatioW, isoRatioH]);

  useEffect(() => {
    api
      .listPalettes()
      .then(setSavedPalettes)
      .catch(() => {});
  }, []);

  // The color wheel calls this continuously while dragging (many times a
  // second) -- recording every intermediate value would flood "Recent"
  // with near-duplicate colors from a single gesture. Discrete picks
  // (palette swatch, eyedropper, custom-color save) record immediately;
  // wheel drags settle into history ~400ms after the color stops moving.
  const recentRecordTimer = useRef(null);
  const selectColor = useCallback(
    (color, { debounceRecent = false } = {}) => {
      if (!color) return;
      setActiveColor(color);
      clearTimeout(recentRecordTimer.current);
      if (debounceRecent) {
        recentRecordTimer.current = setTimeout(() => recordRecentColor(color), 400);
      } else {
        recordRecentColor(color);
      }
    },
    [recordRecentColor]
  );
  useEffect(() => () => clearTimeout(recentRecordTimer.current), []);

  const addCustomColor = (color) => {
    setCustomColors((prev) => (prev.includes(color) ? prev : [...prev, color]));
    selectColor(color);
  };

  const loadPalette = (palette) => {
    setCustomColors(palette.colors);
    if (palette.colors.length) selectColor(palette.colors[0]);
  };

  const saveCurrentPalette = async () => {
    if (!paletteName.trim() || customColors.length === 0) return;
    setSavingPalette(true);
    try {
      const { id } = await api.savePalette({ name: paletteName.trim(), colors: customColors });
      setSavedPalettes((prev) => [{ id, name: paletteName.trim(), colors: customColors }, ...prev]);
      setPaletteName('');
    } catch (e) {
      setError(e.message === 'Not authenticated' ? 'Log in to save palettes.' : e.message);
    } finally {
      setSavingPalette(false);
    }
  };

  const handleGridSizeChange = (size) => {
    if (documentHasContent(docModel) && !confirm('Changing grid size clears your current drawing. Continue?')) return;
    setGridSize(size);
    resize(size, size);
  };

  const handleGridShapeChange = (shape) => {
    if (shape === gridShape) return;
    if (documentHasContent(docModel) && !confirm('Changing grid shape clears your current drawing. Continue?')) return;
    const sizes = shape === 'isometric' ? ISO_GRID_SIZES : GRID_SIZES;
    const nextSize = sizes.includes(gridSize) ? gridSize : 32;
    setGridShape(shape);
    setGridSize(nextSize);
    resize(nextSize, nextSize);
  };

  const handleIsoRatioPresetChange = (key) => {
    setIsoRatioKey(key);
    setRatioError('');
    const preset = ISO_RATIO_PRESETS.find((p) => p.key === key);
    if (preset && preset.w != null) {
      setIsoRatioW(preset.w);
      setIsoRatioH(preset.h);
    }
  };

  const handleCustomRatioChange = (axis, value) => {
    const n = Math.max(0.1, Math.min(20, Number(value) || 0.1));
    if (axis === 'w') setIsoRatioW(n);
    else setIsoRatioH(n);
    setTimeout(() => {
      const err = validateCustomRatio(axis === 'w' ? n : isoRatioW, axis === 'h' ? n : isoRatioH);
      setRatioError(err || '');
    }, 0);
  };

  const exportPNG = () => {
    const scale = 10;
    const { canvasWidth, canvasHeight } = computeCanvasSize({ width: gridSize, height: gridSize, cellPx: scale });
    const off = document.createElement('canvas');
    off.width = canvasWidth;
    off.height = canvasHeight;
    const ctx = off.getContext('2d');
    drawPixelGrid(ctx, { grid, width: gridSize, height: gridSize, gridShape, isoRatioW, isoRatioH, cellPx: scale, showCheckerboard: false, showGridLines: false });
    const link = document.createElement('a');
    link.download = `${title || 'pixel-art'}.png`;
    link.href = off.toDataURL('image/png');
    link.click();
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError('Give your artwork a title first.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (isEditing) {
        await api.updateArtwork(artworkId, { title: title.trim(), category, document: toServerPayload(docModel), visibility });
        navigate(`/artwork/${artworkId}`);
      } else {
        const { id } = await api.createArtwork({
          title: title.trim(),
          project_type: projectType,
          category,
          width: gridSize,
          height: gridSize,
          document: toServerPayload(docModel),
          visibility,
          grid_shape: gridShape,
          ...(gridShape === 'isometric' ? { iso_ratio_w: isoRatioW, iso_ratio_h: isoRatioH } : {}),
        });
        navigate(`/artwork/${id}`);
      }
    } catch (e) {
      setError(e.message === 'Not authenticated' ? 'Log in to save your art.' : e.message);
    } finally {
      setSaving(false);
    }
  };

  const sizeInvalid = gridShape === 'isometric' && !isValidIsoCombo(gridSize, isoRatioW, isoRatioH);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-[220px_1fr_260px] gap-6">
      <div className="pixel-frame bg-panel backdrop-blur-sm p-4 h-fit">
        <Toolbar
          tool={tool}
          onToolChange={setTool}
          onUndo={undo}
          onRedo={redo}
          canUndo={canUndo}
          canRedo={canRedo}
          onClear={clear}
          onExport={exportPNG}
          showGrid={showGridLines}
          onToggleGrid={() => setShowGridLines((g) => !g)}
          onHelp={() => setTutorialOpen(true)}
          brushSize={brushSize}
          onBrushSizeChange={setBrushSize}
          brushShape={brushShape}
          onBrushShapeChange={setBrushShape}
          pixelPerfect={pixelPerfect}
          onTogglePixelPerfect={() => setPixelPerfect((p) => !p)}
          shapeFilled={shapeFilled}
          onToggleShapeFilled={() => setShapeFilled((f) => !f)}
          symmetry={symmetry}
          onToggleSymmetry={toggleSymmetryAxis}
        />
      </div>

      <div className="flex flex-col items-center gap-4">
        {isEditing ? (
          <div className="text-sm text-slate-300 pixel-frame-sm bg-panel border border-panel-border px-3 py-1.5 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            {gridSize}×{gridSize} · {gridShape === 'isometric' ? `Isometric ${isoRatioW}:${isoRatioH}` : 'Square'} (locked)
          </div>
        ) : (
          <div className="w-full max-w-xs space-y-3 pixel-frame bg-panel backdrop-blur-sm p-4">
            <div className="flex gap-1.5">
              <button
                onClick={() => handleGridShapeChange('square')}
                className={`glow-hover flex-1 text-sm px-2 py-1.5 rounded-lg transition-colors ${
                  gridShape === 'square' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                ◻ Square
              </button>
              <button
                onClick={() => handleGridShapeChange('isometric')}
                className={`glow-hover flex-1 text-sm px-2 py-1.5 rounded-lg transition-colors ${
                  gridShape === 'isometric' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                ◆ Isometric
              </button>
            </div>

            {gridShape === 'isometric' && (
              <div className="flex flex-wrap gap-1.5">
                {ISO_RATIO_PRESETS.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => handleIsoRatioPresetChange(p.key)}
                    title={p.label}
                    className={`glow-hover text-xs px-2 py-1 rounded-lg transition-colors ${
                      isoRatioKey === p.key ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {p.key === 'custom' ? 'Custom' : p.key}
                  </button>
                ))}
              </div>
            )}

            {gridShape === 'isometric' && isoRatioKey === 'custom' && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="0.1"
                    max="20"
                    step="0.1"
                    value={isoRatioW}
                    onChange={(e) => handleCustomRatioChange('w', e.target.value)}
                    className={`w-16 bg-slate-700 text-slate-200 text-sm rounded-lg px-2 py-1 ${ratioError ? 'border border-red-500' : ''}`}
                  />
                  <span className="text-slate-400">:</span>
                  <input
                    type="number"
                    min="0.1"
                    max="20"
                    step="0.1"
                    value={isoRatioH}
                    onChange={(e) => handleCustomRatioChange('h', e.target.value)}
                    className={`w-16 bg-slate-700 text-slate-200 text-sm rounded-lg px-2 py-1 ${ratioError ? 'border border-red-500' : ''}`}
                  />
                  <span className="text-xs text-slate-400">w:h</span>
                </div>
                {ratioError && <p className="text-xs text-red-400">{ratioError}</p>}
              </div>
            )}

            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-400 whitespace-nowrap">Grid size</label>
              <select
                value={gridSize}
                onChange={(e) => handleGridSizeChange(Number(e.target.value))}
                className="flex-1 bg-slate-700 text-slate-200 text-sm rounded-lg px-2 py-1 border border-slate-600"
              >
                {(gridShape === 'isometric' ? validIsoSizes : GRID_SIZES).map((s) => (
                  <option key={s} value={s}>
                    {s}×{s}
                  </option>
                ))}
              </select>
            </div>

            {sizeInvalid && <p className="text-xs text-amber-400">⚠ This size is too small for the selected ratio.</p>}
          </div>
        )}

        <div className="overflow-auto max-w-full p-2 rounded-xl bg-panel border border-panel-border">
          <Canvas
            grid={grid}
            width={gridSize}
            height={gridSize}
            gridShape={gridShape}
            isoRatioW={isoRatioW}
            isoRatioH={isoRatioH}
            tool={tool}
            activeColor={activeColor}
            onPixel={setPixel}
            onFillStart={beginStroke}
            onFillEnd={endStroke}
            onFloodFill={floodFill}
            onColorReplace={replaceColor}
            onEyedrop={(color) => color && selectColor(color)}
            showGridLines={showGridLines}
            brushSize={brushSize}
            brushShape={brushShape}
            pixelPerfect={pixelPerfect}
            shapeFilled={shapeFilled}
            symmetry={symmetry}
          />
        </div>
      </div>

      <div className="space-y-6">
        <div className="pixel-frame bg-panel backdrop-blur-sm p-4">
          <ColorPalette
            activeColor={activeColor}
            onSelect={(color) => selectColor(color, { debounceRecent: true })}
            customColors={customColors}
            onAddCustom={addCustomColor}
            recentColors={recentColors}
          />
        </div>

        <LayersPanel
          doc={docModel}
          activeLayerId={activeLayerId}
          activeFrameId={activeFrameId}
          activeLayer={activeLayer}
          width={gridSize}
          height={gridSize}
          gridShape={gridShape}
          isoRatioW={isoRatioW}
          isoRatioH={isoRatioH}
          onSelectLayer={setActiveLayerId}
          onAddLayer={addLayer}
          onAddGroup={addGroup}
          onDuplicateLayer={duplicateLayer}
          onRemoveLayer={removeLayer}
          onRenameLayer={renameLayer}
          onToggleVisible={toggleLayerVisible}
          onToggleLocked={toggleLayerLocked}
          onSetOpacity={setLayerOpacity}
          onSetBlendMode={setLayerBlendMode}
          onReorderLayer={reorderLayer}
        />

        <div className="pixel-frame bg-panel backdrop-blur-sm p-4 space-y-3">
          <h3 className="text-xs uppercase tracking-wide text-slate-400 font-semibold">Saved palettes</h3>
          {savedPalettes.length > 0 ? (
            <div className="space-y-1.5 max-h-32 overflow-auto">
              {savedPalettes.map((p) => (
                <button
                  key={p.id}
                  onClick={() => loadPalette(p)}
                  className="w-full flex items-center gap-2 text-left text-sm text-slate-200 hover:bg-slate-700 rounded-lg px-2 py-1.5 transition-colors"
                >
                  <span className="flex -space-x-1">
                    {p.colors.slice(0, 4).map((c, i) => (
                      <span key={i} className="w-3.5 h-3.5 rounded-full border border-slate-800" style={{ backgroundColor: c }} />
                    ))}
                  </span>
                  <span className="truncate">{p.name}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">No saved palettes yet.</p>
          )}
          <div className="flex gap-2 pt-1">
            <input
              type="text"
              placeholder="Palette name"
              value={paletteName}
              onChange={(e) => setPaletteName(e.target.value)}
              className="flex-1 bg-slate-700 text-slate-100 text-sm rounded-lg px-2 py-1.5 placeholder:text-slate-500 border border-slate-600"
            />
            <button
              onClick={saveCurrentPalette}
              disabled={savingPalette || !paletteName.trim() || customColors.length === 0}
              className="glow-hover text-xs px-2 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 disabled:opacity-50 whitespace-nowrap transition-colors"
            >
              {savingPalette ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        <div className="pixel-frame bg-panel backdrop-blur-sm p-4 space-y-3">
          <h3 className="text-xs uppercase tracking-wide text-slate-400 font-semibold">{isEditing ? 'Update artwork' : 'Save artwork'}</h3>
          <input
            type="text"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-slate-700 text-slate-100 text-sm rounded-lg px-2 py-1.5 placeholder:text-slate-500 border border-slate-600"
          />
          <div>
            <label className="text-xs text-slate-400">Project type</label>
            {isEditing ? (
              <p className="text-sm text-slate-300 mt-1">{projectType === 'game_asset' ? 'Game asset' : 'Miscellaneous'} (locked)</p>
            ) : (
              <select
                value={projectType}
                onChange={(e) => {
                  setProjectType(e.target.value);
                  setCategory(CATEGORIES[e.target.value][0]);
                }}
                className="w-full bg-slate-700 text-slate-100 text-sm rounded-lg px-2 py-1.5 mt-1 border border-slate-600"
              >
                <option value="game_asset">Game asset</option>
                <option value="misc">Miscellaneous</option>
              </select>
            )}
          </div>
          <div>
            <label className="text-xs text-slate-400">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-slate-700 text-slate-100 text-sm rounded-lg px-2 py-1.5 mt-1 border border-slate-600"
            >
              {categoryOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400">Visibility</label>
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => setVisibility('private')}
                className={`glow-hover flex-1 text-sm px-2 py-1.5 rounded-lg transition-colors ${
                  visibility === 'private' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                🔒 Private
              </button>
              <button
                onClick={() => setVisibility('public')}
                className={`glow-hover flex-1 text-sm px-2 py-1.5 rounded-lg transition-colors ${
                  visibility === 'public' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                🌐 Public
              </button>
            </div>
          </div>

          <button
            onClick={() => {
              const draft = {
                id: `draft-${Date.now()}`,
                title: title || 'Untitled',
                width: gridSize,
                height: gridSize,
                pixel_data: grid,
                grid_shape: gridShape,
                iso_ratio_w: gridShape === 'isometric' ? isoRatioW : null,
                iso_ratio_h: gridShape === 'isometric' ? isoRatioH : null,
              };
              sessionStorage.setItem('tileTesterDraft', JSON.stringify(draft));
              navigate('/tester');
            }}
            className="glow-hover w-full text-sm px-4 py-3 rounded-xl bg-gradient-to-r from-starviolet/90 to-indigo-600 hover:from-starviolet hover:to-indigo-500 text-white font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <span>🧪</span> Send to Tile Tester
          </button>

          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            onClick={handleSave}
            disabled={saving}
            className="glow-hover w-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg px-2 py-2 disabled:opacity-50 transition-colors font-medium"
          >
            {saving ? 'Saving…' : isEditing ? 'Update artwork' : 'Save artwork'}
          </button>
        </div>
      </div>

      <WelcomeTutorial open={tutorialOpen} onClose={closeTutorial} tips={TUTORIAL_TIPS} ctaLabel="Got it, let's create" />
    </div>
  );
}
