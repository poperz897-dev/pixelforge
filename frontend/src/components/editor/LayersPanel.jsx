import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { celKey } from '../../utils/documentModel.js';
import { drawPixelGrid } from '../../utils/renderGrid.js';

const BLEND_MODES = ['normal', 'multiply', 'screen', 'overlay', 'add'];
const THUMB_PX = 26;

function childrenOf(layers, parentId) {
  // Descending by position: highest z-order (top of the paint stack) first,
  // matching how the list reads top-to-bottom -- same convention as
  // Photoshop/Aseprite, and the inverse of the ascending order
  // flattenDocument/reorderLayer use internally for draw order.
  return layers.filter((l) => (l.parent_id ?? null) === parentId).sort((a, b) => b.position - a.position);
}

// True if `candidateId` lives anywhere under `ancestorId` in the tree --
// used to stop a group from being dragged into its own descendant, which
// would otherwise create a cycle parent_id can't represent.
function isDescendantOf(layers, candidateId, ancestorId) {
  let cur = layers.find((l) => l.id === candidateId);
  while (cur && cur.parent_id != null) {
    if (cur.parent_id === ancestorId) return true;
    cur = layers.find((l) => l.id === cur.parent_id);
  }
  return false;
}

function LayerThumb({ grid, width, height, gridShape, isoRatioW, isoRatioH }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !grid) return;
    const ctx = canvas.getContext('2d');
    const cellPx = THUMB_PX / Math.max(width, height);
    drawPixelGrid(ctx, {
      grid,
      width,
      height,
      gridShape,
      isoRatioW,
      isoRatioH,
      cellPx,
      showCheckerboard: true,
      showGridLines: false,
      showOutline: gridShape === 'isometric',
    });
  }, [grid, width, height, gridShape, isoRatioW, isoRatioH]);
  return <canvas ref={canvasRef} width={THUMB_PX} height={THUMB_PX} className="rounded-sm border border-slate-600/70 shrink-0" />;
}

const LayersCtx = createContext(null);

function LayerRow({ layer, depth }) {
  const {
    doc, activeLayerId, activeFrameId, width, height, gridShape, isoRatioW, isoRatioH,
    collapsed, toggleCollapse, editingId, setEditingId, dragState, setDragState,
    onSelectLayer, onRenameLayer, onToggleVisible, onToggleLocked, onDrop,
  } = useContext(LayersCtx);

  const [draftName, setDraftName] = useState(layer.name);
  useEffect(() => setDraftName(layer.name), [layer.name]);

  const isActive = layer.id === activeLayerId;
  const isCollapsed = collapsed.has(layer.id);
  const children = layer.is_group ? childrenOf(doc.layers, layer.id) : [];
  const grid = !layer.is_group ? doc.cels.get(celKey(layer.id, activeFrameId)) : null;
  const isEditing = editingId === layer.id;
  const isDropTarget = dragState.overId === layer.id;
  const isDragging = dragState.draggingId === layer.id;

  const commitRename = () => {
    setEditingId(null);
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== layer.name) onRenameLayer(layer.id, trimmed);
    else setDraftName(layer.name);
  };

  const topBorder = isDropTarget && dragState.zone === 'above' ? 'border-t-starcyan' : 'border-t-transparent';
  const bottomBorder = isDropTarget && dragState.zone === 'below' ? 'border-b-starcyan' : 'border-b-transparent';
  const insideRing = isDropTarget && dragState.zone === 'inside' ? 'ring-1 ring-inset ring-starcyan' : '';

  return (
    <div>
      <div
        draggable={!isEditing}
        onDragStart={(e) => {
          e.stopPropagation();
          setDragState({ draggingId: layer.id, overId: null, zone: null });
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const rect = e.currentTarget.getBoundingClientRect();
          const frac = (e.clientY - rect.top) / rect.height;
          const zone = layer.is_group ? (frac < 0.25 ? 'above' : frac > 0.75 ? 'below' : 'inside') : frac < 0.5 ? 'above' : 'below';
          if (dragState.overId !== layer.id || dragState.zone !== zone) {
            setDragState((s) => ({ ...s, overId: layer.id, zone }));
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDrop(layer);
        }}
        onDragEnd={() => setDragState({ draggingId: null, overId: null, zone: null })}
        onClick={() => onSelectLayer(layer.id)}
        style={{ paddingLeft: 4 + depth * 14 }}
        className={`flex items-center gap-1.5 py-1 pr-1.5 rounded-md cursor-pointer select-none border-t-2 border-b-2 transition-colors ${topBorder} ${bottomBorder} ${insideRing} ${
          isActive ? 'bg-indigo-600/80 text-white' : 'hover:bg-slate-700/60 text-slate-200'
        } ${isDragging ? 'opacity-40' : ''}`}
      >
        <span className="text-slate-500 text-xs cursor-grab shrink-0" title="Drag to reorder">
          ⠿
        </span>

        {layer.is_group ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleCollapse(layer.id);
            }}
            className="w-4 h-4 shrink-0 flex items-center justify-center text-slate-400 hover:text-slate-200 text-[10px]"
          >
            {isCollapsed ? '▸' : '▾'}
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}

        {layer.is_group ? (
          <span className="text-sm shrink-0 w-[26px] h-[26px] flex items-center justify-center">📁</span>
        ) : (
          <LayerThumb grid={grid} width={width} height={height} gridShape={gridShape} isoRatioW={isoRatioW} isoRatioH={isoRatioH} />
        )}

        {isEditing ? (
          <input
            autoFocus
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
              if (e.key === 'Escape') {
                setDraftName(layer.name);
                setEditingId(null);
              }
            }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 min-w-0 bg-slate-800 text-slate-100 text-sm rounded px-1.5 py-0.5 border border-starcyan/60"
          />
        ) : (
          <span
            onDoubleClick={(e) => {
              e.stopPropagation();
              setEditingId(layer.id);
            }}
            className={`flex-1 min-w-0 truncate text-sm ${!layer.visible ? 'opacity-50 italic' : ''}`}
            title="Double-click to rename"
          >
            {layer.name}
          </span>
        )}

        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleVisible(layer.id);
          }}
          title={layer.visible ? 'Hide layer' : 'Show layer'}
          className={`w-6 h-6 shrink-0 rounded flex items-center justify-center text-sm hover:bg-slate-600/60 ${layer.visible ? '' : 'opacity-30'}`}
        >
          👁
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleLocked(layer.id);
          }}
          title={layer.locked ? 'Unlock layer' : 'Lock layer'}
          className="w-6 h-6 shrink-0 rounded flex items-center justify-center text-sm hover:bg-slate-600/60"
        >
          {layer.locked ? '🔒' : '🔓'}
        </button>
      </div>

      {layer.is_group && !isCollapsed && children.map((child) => <LayerRow key={child.id} layer={child} depth={depth + 1} />)}
    </div>
  );
}

// Layers x groups UI for the document model built in Section 2
// (useDocumentModel.js) -- this panel is purely a view + drag/rename
// interaction layer over operations that already exist and are already
// fully wired to undo/redo and compositing (opacity, blend mode, nesting,
// visibility). Reordering uses native HTML5 drag-and-drop rather than a
// library, since nothing else in this project pulls one in.
export default function LayersPanel({
  doc,
  activeLayerId,
  activeFrameId,
  activeLayer,
  width,
  height,
  gridShape,
  isoRatioW,
  isoRatioH,
  onSelectLayer,
  onAddLayer,
  onAddGroup,
  onDuplicateLayer,
  onRemoveLayer,
  onRenameLayer,
  onToggleVisible,
  onToggleLocked,
  onSetOpacity,
  onSetBlendMode,
  onReorderLayer,
}) {
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [editingId, setEditingId] = useState(null);
  const [dragState, setDragState] = useState({ draggingId: null, overId: null, zone: null });

  const toggleCollapse = (id) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const ascIndexAmongSiblings = (targetLayer, excludeId) => {
    const parentId = targetLayer.parent_id ?? null;
    const siblings = doc.layers.filter((l) => l.id !== excludeId && (l.parent_id ?? null) === parentId).sort((a, b) => a.position - b.position);
    return siblings.findIndex((l) => l.id === targetLayer.id);
  };

  const handleDrop = (targetLayer) => {
    const { draggingId, zone } = dragState;
    setDragState({ draggingId: null, overId: null, zone: null });
    if (!draggingId || draggingId === targetLayer.id) return;
    if (isDescendantOf(doc.layers, targetLayer.id, draggingId)) return; // would nest a group inside itself

    if (zone === 'inside' && targetLayer.is_group) {
      const childCount = doc.layers.filter((l) => l.id !== draggingId && (l.parent_id ?? null) === targetLayer.id).length;
      onReorderLayer(draggingId, targetLayer.id, childCount);
      return;
    }
    const idx = ascIndexAmongSiblings(targetLayer, draggingId);
    const newParentId = targetLayer.parent_id ?? null;
    onReorderLayer(draggingId, newParentId, zone === 'above' ? idx + 1 : idx);
  };

  const handleDropToRoot = () => {
    const { draggingId } = dragState;
    setDragState({ draggingId: null, overId: null, zone: null });
    if (!draggingId) return;
    const rootCount = doc.layers.filter((l) => l.id !== draggingId && (l.parent_id ?? null) === null).length;
    onReorderLayer(draggingId, null, rootCount);
  };

  const roots = useMemo(() => childrenOf(doc.layers, null), [doc.layers]);

  const ctxValue = {
    doc, activeLayerId, activeFrameId, width, height, gridShape, isoRatioW, isoRatioH,
    collapsed, toggleCollapse, editingId, setEditingId, dragState, setDragState,
    onSelectLayer, onRenameLayer, onToggleVisible, onToggleLocked, onDrop: handleDrop,
  };

  return (
    <div className="pixel-frame bg-panel backdrop-blur-sm p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Layers</h3>
        <div className="flex gap-1">
          <button
            onClick={() => onAddLayer()}
            title="Add layer"
            className="glow-hover text-xs w-6 h-6 rounded bg-slate-700/60 hover:bg-slate-700 text-slate-200 flex items-center justify-center"
          >
            ＋
          </button>
          <button
            onClick={() => onAddGroup()}
            title="Add group"
            className="glow-hover text-xs w-6 h-6 rounded bg-slate-700/60 hover:bg-slate-700 text-slate-200 flex items-center justify-center"
          >
            📁
          </button>
        </div>
      </div>

      <LayersCtx.Provider value={ctxValue}>
        <div className="max-h-56 overflow-y-auto -mx-1 px-1 space-y-0.5">
          {roots.map((layer) => (
            <LayerRow key={layer.id} layer={layer} depth={0} />
          ))}
        </div>
      </LayersCtx.Provider>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (dragState.draggingId && dragState.overId !== 'root') setDragState((s) => ({ ...s, overId: 'root', zone: null }));
        }}
        onDrop={(e) => {
          e.preventDefault();
          handleDropToRoot();
        }}
        title="Drop here to move to the top level"
        className={`h-2 rounded-full transition-colors ${dragState.draggingId ? (dragState.overId === 'root' ? 'bg-starcyan/60' : 'bg-slate-700/40') : ''}`}
      />

      {activeLayer && (
        <div className="pixel-frame-sm bg-panel border border-panel-border p-2.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-slate-400 truncate">
              {activeLayer.is_group ? 'Group' : 'Layer'}: <span className="text-slate-200">{activeLayer.name}</span>
            </span>
            <div className="flex gap-1 shrink-0">
              <button
                onClick={() => onDuplicateLayer(activeLayer.id)}
                title="Duplicate"
                className="glow-hover w-6 h-6 rounded bg-slate-700/60 hover:bg-slate-700 text-xs flex items-center justify-center"
              >
                ⧉
              </button>
              <button
                onClick={() => onRemoveLayer(activeLayer.id)}
                disabled={doc.layers.length <= 1}
                title="Delete"
                className="glow-hover w-6 h-6 rounded bg-red-900/30 hover:bg-red-900/50 text-red-200 disabled:opacity-30 text-xs flex items-center justify-center"
              >
                🗑
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 w-14 shrink-0">Opacity</label>
            <input
              type="range"
              min="0"
              max="100"
              value={Math.round(activeLayer.opacity * 100)}
              onChange={(e) => onSetOpacity(activeLayer.id, Number(e.target.value) / 100)}
              className="flex-1 accent-indigo-500"
            />
            <span className="text-[10px] font-mono text-slate-400 w-8 text-right">{Math.round(activeLayer.opacity * 100)}%</span>
          </div>

          {!activeLayer.is_group && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400 w-14 shrink-0">Blend</label>
              <select
                value={activeLayer.blend_mode}
                onChange={(e) => onSetBlendMode(activeLayer.id, e.target.value)}
                className="flex-1 bg-slate-700 text-slate-200 text-xs rounded px-2 py-1 border border-slate-600"
              >
                {BLEND_MODES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
