const SIZES = { sm: 6, md: 9, lg: 13 };

// A little chase of blinking pixel blocks -- deliberately stepped rather
// than fading, so it feels like it belongs on the same screen as the
// pixel-art canvas instead of a generic spinner.
export default function PixelLoader({ label = 'Loading…', size = 'md', showLabel = true, className = '' }) {
  const dims = SIZES[size] ?? SIZES.md;

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`} role="status" aria-live="polite">
      <div className="flex gap-1.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <span
            key={i}
            className="inline-block animate-pixel-blink"
            style={{ width: dims, height: dims, background: '#73eff7', animationDelay: `${i * 0.13}s` }}
          />
        ))}
      </div>
      <p className={`font-mono text-xs tracking-wide text-slate-400 ${showLabel ? '' : 'sr-only'}`}>{label}</p>
    </div>
  );
}
