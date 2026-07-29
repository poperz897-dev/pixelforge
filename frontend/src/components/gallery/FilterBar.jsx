const PROJECT_TYPES = [
  { value: '', label: 'All types' },
  { value: 'game_asset', label: 'Game assets' },
  { value: 'misc', label: 'Miscellaneous' },
];

const CATEGORIES = {
  game_asset: ['tile', 'character', 'mob', 'item', 'ui'],
  misc: ['icon', 'avatar', 'banner', 'other'],
};

const SORTS = [
  { value: 'newest', label: 'Newest' },
  { value: 'most_liked', label: 'Most liked' },
  { value: 'trending', label: 'Trending' },
];

export default function FilterBar({ filters, onChange }) {
  const categories = filters.project_type ? CATEGORIES[filters.project_type] : [];

  return (
    <div className="flex flex-wrap gap-3 items-center">
      <select
        value={filters.project_type}
        onChange={(e) => onChange({ ...filters, project_type: e.target.value, category: '' })}
        className="bg-slate-700 text-slate-200 text-sm rounded px-3 py-1.5 transition-colors hover:bg-slate-600"
      >
        {PROJECT_TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>

      {categories.length > 0 && (
        <select
          value={filters.category}
          onChange={(e) => onChange({ ...filters, category: e.target.value })}
          className="bg-slate-700 text-slate-200 text-sm rounded px-3 py-1.5 transition-colors hover:bg-slate-600"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      )}

      <div className="flex gap-1.5 ml-auto">
        {SORTS.map((s) => (
          <button
            key={s.value}
            onClick={() => onChange({ ...filters, sort: s.value })}
            className={`glow-hover text-sm px-3 py-1.5 rounded transition-colors ${
              filters.sort === s.value ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
