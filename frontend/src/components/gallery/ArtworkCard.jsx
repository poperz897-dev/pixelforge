import { Link } from 'react-router-dom';
import PixelGridPreview from '../ui/PixelGridPreview.jsx';

function Thumbnail({ artwork }) {
  const { thumbnail, grid_shape, iso_ratio_w, iso_ratio_h } = artwork;

  if (!thumbnail) {
    return (
      <div className="w-full h-full bg-slate-900 flex items-center justify-center">
        <span className="text-2xl opacity-20">🎨</span>
      </div>
    );
  }

  return (
    <PixelGridPreview
      pixels={thumbnail.pixels}
      width={thumbnail.width}
      height={thumbnail.height}
      gridShape={grid_shape}
      isoRatioW={iso_ratio_w}
      isoRatioH={iso_ratio_h}
      cellPx={1}
      className="w-full h-full bg-slate-900"
    />
  );
}

export default function ArtworkCard({ artwork }) {
  const isIso = artwork.grid_shape === 'isometric';

  return (
    <Link
      to={`/artwork/${artwork.id}`}
      className="pixel-frame glow-hover group block bg-panel backdrop-blur-sm overflow-hidden transition-transform hover:-translate-y-0.5"
    >
      <div className="aspect-square overflow-hidden relative">
        <Thumbnail artwork={artwork} />
        {isIso && (
          <div className="absolute top-2 left-2 text-[10px] bg-starviolet/80 text-slate-950 font-medium px-1.5 py-0.5 rounded backdrop-blur-sm">
            ◆ ISO
          </div>
        )}
      </div>
      <div className="p-2.5">
        <p className="text-sm text-slate-100 truncate group-hover:text-starcyan transition-colors">{artwork.title}</p>
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-slate-400">{artwork.category}</span>
          <span className="text-xs text-slate-400">❤ {artwork.like_count}</span>
        </div>
      </div>
    </Link>
  );
}
