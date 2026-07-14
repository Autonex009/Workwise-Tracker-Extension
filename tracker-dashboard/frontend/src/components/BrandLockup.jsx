import { Gauge } from 'lucide-react'

// WorkWise brand lockup (icon frame + wordmark). tone: 'dark' | 'light'.
export default function BrandLockup({ subtitle = 'Productivity Dashboard', tone = 'dark', compact = false, collapsed = false }) {
  const frame = tone === 'dark' ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-white'
  const word = tone === 'dark' ? 'text-white' : 'text-slate-900'
  const sub = tone === 'dark' ? 'text-slate-400' : 'text-slate-500'
  return (
    <div className={`inline-flex items-center ${compact ? 'gap-3' : 'gap-4'}`}>
      <div className={`relative overflow-hidden rounded-[1.1rem] border shadow-lg ${frame} ${compact ? 'h-11 w-11' : 'h-14 w-14'} grid place-items-center flex-shrink-0`}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.45),_transparent_65%)]" />
        <Gauge className={`relative z-10 ${compact ? 'h-5 w-5' : 'h-7 w-7'} text-indigo-300`} />
      </div>
      {!collapsed && (
        <div className="min-w-0">
          <div className={`font-extrabold tracking-tight leading-none ${compact ? 'text-lg' : 'text-xl'} ${word}`}>
            WorkWise<span className="text-indigo-400"> Tracker</span>
          </div>
          <p className={`mt-1 text-xs truncate ${sub}`}>{subtitle}</p>
        </div>
      )}
    </div>
  )
}
