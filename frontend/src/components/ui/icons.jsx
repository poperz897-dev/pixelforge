// Two families live in this file:
//
// 1. Three multi-color "character" icons (ghost, rocket, sparkle) adapted
//    from shuqikhor/pixel-icons (MIT license --
//    https://github.com/shuqikhor/pixel-icons). Original shapes/geometry are
//    unchanged; fills are remapped onto PixelForge's own token palette.
//    Full upstream license text kept at THIRD_PARTY_LICENSES.md.
//
// 2. Everything below "Original utility icons" is hand-authored for this
//    project -- not derived from any third-party set. They exist to retire
//    the emoji (✏️🧽🪣💧↶↷⬇❤♡🌐🔒) that were standing in as icons
//    elsewhere in the app: emoji render inconsistently across platforms and
//    don't belong to this pixel-grid visual language. Each is built from a
//    small ASCII bitmap via the <Bitmap> helper below -- '.' is transparent,
//    any other character is filled -- so the shape is legible directly from
//    the source instead of hand-computed rect coordinates.

function IconBase({ className = '', size = 20, children }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 9 9"
      width={size}
      height={size}
      shapeRendering="crispEdges"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

// Renders a small ASCII bitmap as 1x1-unit <rect>s on the 9x9 IconBase grid.
// Defaults every filled cell to `currentColor` so utility icons inherit
// whatever text color their parent button already has (including its hover/
// active states) instead of being locked to a hardcoded fill.
function Bitmap({ rows, fill = 'currentColor' }) {
  return rows.flatMap((row, y) =>
    [...row].map((ch, x) => (ch === '.' ? null : <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={fill} />))
  );
}

// PixelForge's one recurring "character" -- used in empty states and the
// welcome tutorial. Original: shuqikhor/pixel-icons "ghost-blue".
export function GhostIcon({ className = '', size = 20 }) {
  return (
    <IconBase className={className} size={size}>
      <path fill="#c4b5fd" d="M2,0V1H1V8H2V7H3V8H4V7H5V8H6V7H7V8H8V1H7V0z M2,4V2H4V4z M5,2H7V4H5z" />
      <path fill="#f4f4f4" d="M2,2V3H3V4H4V2z" />
      <path fill="#f4f4f4" d="M5,2V3H6V4H7V2z" />
      <rect fill="#1e1b4b" x="2" y="3" width="1" height="1" />
      <rect fill="#1e1b4b" x="5" y="3" width="1" height="1" />
    </IconBase>
  );
}

// "Let's create something" accent -- tutorial header, empty-state CTAs.
// Original: shuqikhor/pixel-icons "rocket".
export function RocketIcon({ className = '', size = 20 }) {
  return (
    <IconBase className={className} size={size}>
      <path fill="#f4f4f4" d="M6,2H3V6H6z M4,3H5V4H4z" />
      <rect fill="#73eff7" x="4" y="3" width="1" height="1" />
      <path fill="#c4b5fd" d="M3,2H6V1H5V0H4V1H3z" />
      <rect fill="#c4b5fd" x="2" y="4" width="1" height="3" />
      <rect fill="#c4b5fd" x="6" y="4" width="1" height="3" />
      <rect fill="#ffcd75" x="4" y="6" width="1" height="1" />
      <rect fill="#ffcd75" x="4" y="8" width="1" height="1" />
      <rect fill="#f4b41b" x="4" y="7" width="1" height="1" />
    </IconBase>
  );
}

// One-off heading/accent flourish. Original: shuqikhor/pixel-icons "sparkles".
export function SparkleIcon({ className = '', size = 20 }) {
  return (
    <IconBase className={className} size={size}>
      <polygon fill="#ffcd75" points="5,2 4,2 4,1 3,1 3,2 2,2 2,3 3,3 3,4 4,4 4,3 5,3" />
      <polygon fill="#ffcd75" points="7,4 7,3 6,3 6,4 5,4 5,5 6,5 6,6 7,6 7,5 8,5 8,4" />
      <polygon fill="#ffcd75" points="3,5 2,5 2,6 1,6 1,7 2,7 2,8 3,8 3,7 4,7 4,6 3,6" />
    </IconBase>
  );
}

// ---------------------------------------------------------------------- //
// Original utility icons -- see file header. All monochrome (currentColor)
// so they pick up whatever color the surrounding button/text already uses.
// ---------------------------------------------------------------------- //

export function PlusIcon({ className = '', size = 20 }) {
  return (
    <IconBase className={className} size={size}>
      <Bitmap
        rows={['.........', '....X....', '....X....', '....X....', '..XXXXX..', '....X....', '....X....', '....X....', '.........']}
      />
    </IconBase>
  );
}

export function LockIcon({ className = '', size = 20 }) {
  return (
    <IconBase className={className} size={size}>
      <Bitmap
        rows={['.........', '...XXX...', '...X.X...', '...X.X...', '..XXXXX..', '..XXXXX..', '..XXXXX..', '..XXXXX..', '..XXXXX..']}
      />
      <rect x="4" y="6" width="1" height="1" fill="#14162a" />
    </IconBase>
  );
}

export function GlobeIcon({ className = '', size = 20 }) {
  return (
    <IconBase className={className} size={size}>
      <Bitmap
        rows={['.........', '..XXXXX..', '.XX.X.XX.', '.X..X..X.', '.XXXXXXX.', '.X..X..X.', '.X..X..X.', '..XXXXX..', '.........']}
      />
    </IconBase>
  );
}

// filled=true for "liked"/active state; filled=false renders the hollow variant.
export function HeartIcon({ className = '', size = 20, filled = false }) {
  const rows = filled
    ? ['.........', '.XXX.XXX.', '.XXXXXXX.', '.XXXXXXX.', '..XXXXX..', '...XXX...', '....X....', '.........', '.........']
    : ['.........', '.XXX.XXX.', '.X..X..X.', '.X.....X.', '..X...X..', '...X.X...', '....X....', '.........', '.........'];
  return (
    <IconBase className={className} size={size}>
      <Bitmap rows={rows} />
    </IconBase>
  );
}

export function PencilIcon({ className = '', size = 20 }) {
  return (
    <IconBase className={className} size={size}>
      <Bitmap
        rows={['........X', '.......X.', '......X..', '.....X...', '....X....', '...X.....', '..X......', '.XX......', 'XX.......']}
      />
    </IconBase>
  );
}

export function EraserIcon({ className = '', size = 20 }) {
  return (
    <IconBase className={className} size={size}>
      <Bitmap
        rows={['.........', '.........', '..XXXX...', '.XXXXXXX.', '.XXXXXXX.', '.XXXXXXX.', '.XXXXXXX.', '..XXXXX..', '.........']}
      />
    </IconBase>
  );
}

export function FillIcon({ className = '', size = 20 }) {
  return (
    <IconBase className={className} size={size}>
      <Bitmap
        rows={['.........', '....XX...', '...XXXX..', '..XXXXXX.', '.XXXXXXXX', '.XXXXXXXX', '..XXXXXX.', '.......X.', '.......X.']}
      />
    </IconBase>
  );
}

export function EyedropIcon({ className = '', size = 20 }) {
  return (
    <IconBase className={className} size={size}>
      <Bitmap
        rows={['..XXX....', '..XXX....', '..XXX....', '...XX....', '....XX...', '.....XX..', '......XX.', '.......X.', '.........']}
      />
    </IconBase>
  );
}

export function UndoIcon({ className = '', size = 20 }) {
  return (
    <IconBase className={className} size={size}>
      <Bitmap
        rows={['.........', '....X....', '...XX....', '..XXXXXX.', '.XXXXXXX.', '..XXXXXX.', '...XX....', '....X....', '.........']}
      />
    </IconBase>
  );
}

export function RedoIcon({ className = '', size = 20 }) {
  return (
    <IconBase className={className} size={size}>
      <Bitmap
        rows={['.........', '....X....', '....XX...', '.XXXXXX..', '.XXXXXXX.', '.XXXXXX..', '....XX...', '....X....', '.........']}
      />
    </IconBase>
  );
}

export function DownloadIcon({ className = '', size = 20 }) {
  return (
    <IconBase className={className} size={size}>
      <Bitmap
        rows={['....X....', '....X....', '....X....', '....X....', '..XXXXX..', '...XXX...', '....X....', '.........', '.XXXXXXX.']}
      />
    </IconBase>
  );
}

export function TrashIcon({ className = '', size = 20 }) {
  return (
    <IconBase className={className} size={size}>
      <Bitmap
        rows={['...XXX...', '.XXXXXXX.', '..XXXXX..', '..X.X.X..', '..X.X.X..', '..X.X.X..', '..X.X.X..', '..XXXXX..', '.........']}
      />
    </IconBase>
  );
}

export function ChatIcon({ className = '', size = 20 }) {
  return (
    <IconBase className={className} size={size}>
      <Bitmap
        rows={['.........', '.XXXXXXX.', 'X.......X', 'X.......X', 'X.X.X.X.X', 'X.......X', '.XXXXXXX.', '...XX....', '.........']}
      />
    </IconBase>
  );
}

export function HomeIcon({ className = '', size = 20 }) {
  return (
    <IconBase className={className} size={size}>
      <Bitmap
        rows={['....X....', '...XXX...', '..XXXXX..', '.XXXXXXX.', '.XXXXXXX.', '.XXX.XXX.', '.XXX.XXX.', '.XXX.XXX.', '.........']}
      />
    </IconBase>
  );
}

export function UserIcon({ className = '', size = 20 }) {
  return (
    <IconBase className={className} size={size}>
      <Bitmap
        rows={['.........', '...XXX...', '..XXXXX..', '..XXXXX..', '...XXX...', '.XXXXXXX.', 'XXXXXXXXX', 'XXXXXXXXX', 'XXXXXXXXX']}
      />
    </IconBase>
  );
}

export function CloseIcon({ className = '', size = 20 }) {
  return (
    <IconBase className={className} size={size}>
      <Bitmap
        rows={['X.......X', '.X.....X.', '..X...X..', '...X.X...', '....X....', '...X.X...', '..X...X..', '.X.....X.', 'X.......X']}
      />
    </IconBase>
  );
}

// Bigger, decorative diamond-tile wireframe -- used for the "create an
// isometric tile" redirect card. Not on the 9x9 utility grid: it needs to
// read as an illustration (dashed outline + facet lines), not a small glyph.
export function IsometricTileGlyph({ className = '', size = 96 }) {
  return (
    <svg
      viewBox="0 0 100 84"
      width={size}
      height={size}
      aria-hidden="true"
      className={className}
    >
      <polygon
        points="50,6 94,42 50,78 6,42"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeDasharray="7 6"
        strokeLinejoin="round"
      />
      <line x1="50" y1="6" x2="50" y2="78" stroke="currentColor" strokeWidth="2" strokeDasharray="4 5" opacity="0.5" />
      <line x1="6" y1="42" x2="94" y2="42" stroke="currentColor" strokeWidth="2" strokeDasharray="4 5" opacity="0.5" />
    </svg>
  );
}
