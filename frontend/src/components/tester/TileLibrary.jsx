import { useState } from 'react';
import PixelGridPreview from '../ui/PixelGridPreview.jsx';
import PixelLoader from '../ui/PixelLoader.jsx';
import { GhostIcon } from '../ui/icons.jsx';

export default function TileLibrary({ draftTiles, savedTiles, onDragStart, loading, onSelectTile, selectedTileId }) {
  const [tab, setTab] = useState('draft');
  const tiles = tab === 'draft' ? draftTiles : savedTiles;

  return (
    <div className="pixel-frame bg-panel backdrop-blur-sm p-4 h-full flex flex-col">
      <h2 className="font-display text-sm font-medium text-slate-100 mb-1 flex items-center gap-2">📦 Tile Library</h2>
      <p className="text-[10px] text-slate-400 mb-3">Click a tile to arm it for painting, or drag it onto the grid.</p>
      <div className="flex gap-1.5 mb-3">
        {['draft', 'saved'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`glow-hover flex-1 text-xs px-2 py-1.5 rounded-lg transition-colors font-medium ${
              tab === t ? 'bg-indigo-600 text-white' : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {t === 'draft' ? 'Drafts' : 'Saved'}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto space-y-2 min-h-0 pr-1">
        {loading && (
          <div className="py-4">
            <PixelLoader size="sm" label="Loading artwork…" />
          </div>
        )}
        {!loading && tiles.length === 0 && (
          <div className="text-center py-8 flex flex-col items-center gap-2">
            <GhostIcon size={32} className="opacity-50" />
            <p className="text-xs text-slate-500 leading-relaxed">
              {tab === 'draft' ? 'No drafts. Send tiles from the editor.' : 'No saved artwork yet.'}
            </p>
          </div>
        )}
        {tiles.map((tile) => {
          const isSelected = tile.id === selectedTileId;
          return (
            <div
              key={tile.id}
              draggable
              onDragStart={(e) => onDragStart(e, tile)}
              onClick={() => onSelectTile?.(tile)}
              className={`glow-hover bg-panel border border-panel-border hover:bg-slate-700/50 rounded-lg p-2.5 cursor-grab active:cursor-grabbing transition-colors group ${
                isSelected ? 'ring-1 ring-starcyan bg-starcyan/10' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`shrink-0 rounded-lg overflow-hidden bg-void ring-1 transition-colors ${
                    isSelected ? 'ring-starcyan' : 'ring-slate-700 group-hover:ring-starcyan/60'
                  }`}
                >
                  <PixelGridPreview
                    pixels={tile.pixel_data.flat()}
                    width={tile.width}
                    height={tile.height}
                    gridShape={tile.grid_shape}
                    isoRatioW={tile.iso_ratio_w}
                    isoRatioH={tile.iso_ratio_h}
                    cellPx={2}
                    className="w-12 h-12"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-100 font-medium truncate flex items-center gap-1.5">
                    {tile.title}
                    {isSelected && <span className="text-starcyan text-[10px] font-normal shrink-0">🖌 armed</span>}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {tile.width}×{tile.height}
                    {tile.grid_shape === 'isometric' && (
                      <span className="text-starcyan ml-1">
                        {tile.iso_ratio_w}:{tile.iso_ratio_h}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
