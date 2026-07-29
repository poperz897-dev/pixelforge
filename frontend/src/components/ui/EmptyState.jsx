import { GhostIcon } from './icons.jsx';

export default function EmptyState({ title, message, action, className = '' }) {
  return (
    <div className={`flex flex-col items-center text-center gap-3 py-16 px-6 ${className}`}>
      <GhostIcon size={56} className="animate-float opacity-90" />
      <h3 className="font-display text-base text-slate-200 mt-1">{title}</h3>
      {message && <p className="text-sm text-slate-400 max-w-xs">{message}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
