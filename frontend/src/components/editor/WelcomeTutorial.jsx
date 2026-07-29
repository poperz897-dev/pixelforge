import { RocketIcon, SparkleIcon } from '../ui/icons.jsx';

// Generic dismissible tip card -- shows once automatically (seen-state is
// owned by the caller, see useLocalStorage), reopenable via a "?" button.
// Editor and TileTester each pass their own title/tips/cta so the same
// component works for both without hardcoding either workflow.
export default function WelcomeTutorial({ open, onClose, title = 'New here? Quick start', tips = [], ctaLabel = "Got it, let's go" }) {
  if (!open) return null;

  return (
    <div className="fixed bottom-4 right-4 z-20 w-[min(20rem,calc(100vw-2rem))] animate-pop-in">
      <div className="pixel-frame bg-panel backdrop-blur-md p-4 shadow-glow">
        <div className="flex items-center gap-2">
          <RocketIcon size={22} />
          <h2 className="font-display font-medium text-slate-100 text-sm">{title}</h2>
          <SparkleIcon size={16} className="ml-auto" />
        </div>

        <ul className="mt-3 space-y-2">
          {tips.map((tip, i) => (
            <li key={i} className="flex gap-2 text-xs text-slate-300 leading-relaxed">
              <span className="font-mono text-starcyan shrink-0">{`0${i + 1}`}</span>
              {tip}
            </li>
          ))}
        </ul>

        <button
          onClick={onClose}
          className="glow-hover mt-4 w-full rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium py-2"
        >
          {ctaLabel}
        </button>
      </div>
    </div>
  );
}
