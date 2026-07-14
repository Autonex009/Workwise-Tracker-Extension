import { Search, X } from 'lucide-react'

const STATUSES = [
  ['all', 'All'],
  ['active', 'Active'],
  ['idle', 'Idle'],
  ['offline', 'Offline'],
]

export default function MemberFilters({ search, onSearch, status, onStatus, className = '' }) {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center gap-3 ${className}`}>
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search name or email…"
          className="w-full rounded-lg border border-slate-200 pl-9 pr-8 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
        />
        {search && (
          <button
            onClick={() => onSearch('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            title="Clear"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5 self-start">
        {STATUSES.map(([key, label]) => (
          <button
            key={key}
            onClick={() => onStatus(key)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
              status === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
