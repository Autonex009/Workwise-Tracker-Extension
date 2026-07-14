const MAP = {
  active: { dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50', label: 'Active' },
  idle: { dot: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50', label: 'Idle' },
  offline: { dot: 'bg-slate-400', text: 'text-slate-500', bg: 'bg-slate-100', label: 'Offline' },
}

export default function StatusBadge({ status }) {
  const s = MAP[status] || MAP.offline
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot} ${status === 'active' ? 'animate-pulse' : ''}`} />
      {s.label}
    </span>
  )
}
