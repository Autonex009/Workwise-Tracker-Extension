import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X, ShieldAlert, Terminal } from 'lucide-react'
import { format } from 'date-fns'
import { trackerApi } from '../lib/api'

// Raw line: terminal-style colored token per event type.
const RAW_COLOR = {
  SESSION_STARTED: 'text-emerald-400', SESSION_STOPPED: 'text-red-400',
  SESSION_PAUSED: 'text-amber-400', SESSION_RESUMED: 'text-emerald-400',
  TASK_STARTED: 'text-sky-400', TASK_SKIPPED: 'text-amber-400', TASK_EXITED: 'text-rose-400',
  KEYBOARD_INPUT: 'text-violet-400', KEYBOARD_SHORTCUT: 'text-violet-400',
  IDLE_STATE_CHANGED: 'text-slate-400',
  TAB_ACTIVATED: 'text-cyan-400', TAB_UPDATED: 'text-cyan-400', TAB_CLOSED: 'text-slate-400',
  WINDOW_FOCUSED: 'text-blue-400', WINDOW_UNFOCUSED: 'text-slate-500',
  ENCORD_PAGE_VIEW: 'text-cyan-400', ENCORD_EMAIL_CAPTURED: 'text-emerald-400',
}

// Build human-readable narration from chronological events.
function narrate(events) {
  const lines = []
  let prevUrl = null
  let lastTs = null
  for (const e of events) {
    const ts = new Date(e.ts)
    if (lastTs) {
      const gapMin = (ts - lastTs) / 60000
      if (gapMin >= 5) lines.push({ ts, tone: 'idle', text: `No activity detected for ${Math.round(gapMin)} minutes` })
    }
    lastTs = ts
    const url = e.url || null
    let text = null
    let tone = 'info'
    switch (e.event_type) {
      case 'SESSION_STARTED': text = 'Session started — tracking begins'; tone = 'session'; break
      case 'SESSION_STOPPED': text = 'Session stopped'; tone = 'session'; break
      case 'SESSION_PAUSED': text = 'Session paused'; tone = 'idle'; break
      case 'SESSION_RESUMED': text = 'Session resumed'; tone = 'session'; break
      case 'TAB_ACTIVATED':
      case 'TAB_UPDATED':
      case 'ENCORD_PAGE_VIEW': {
        if (!url) { text = null; break }
        if (prevUrl && url !== prevUrl) text = `Tab switched from ${prevUrl} to ${url}`
        else text = `Opened ${url}`
        tone = 'nav'
        prevUrl = url
        break
      }
      case 'TAB_CLOSED': text = 'Closed a tab'; tone = 'nav'; break
      case 'WINDOW_FOCUSED': text = 'Browser window focused'; tone = 'window'; break
      case 'WINDOW_UNFOCUSED': text = 'Browser window unfocused'; tone = 'window'; break
      case 'IDLE_STATE_CHANGED': {
        const s = e.metadata?.state
        text = s === 'active' ? 'Activity resumed' : 'No activity detected (idle)'
        tone = 'idle'
        break
      }
      case 'TASK_STARTED': text = `Started task ${e.data_id ?? ''}`.trim(); tone = 'task'; break
      case 'TASK_SKIPPED': text = `Skipped task ${e.data_id ?? ''}`.trim(); tone = 'task'; break
      case 'TASK_EXITED': text = `Exited task ${e.data_id ?? ''}`.trim(); tone = 'task'; break
      case 'KEYBOARD_INPUT':
        text = e.metadata?.keys
          ? `Typed on ${url ?? 'page'}: “${e.metadata.keys}”`
          : `Typed on ${url ?? 'page'} (${e.metadata?.count ?? '?'} keys)`
        tone = 'type'
        break
      case 'KEYBOARD_SHORTCUT': text = `Shortcut ${e.metadata?.shortcut ?? ''}`.trim(); tone = 'type'; break
      case 'ENCORD_EMAIL_CAPTURED': text = `Identified as ${e.metadata?.email ?? 'user'}`; tone = 'session'; break
      default: text = e.event_type
    }
    if (text) lines.push({ ts, tone, text })
  }
  return lines
}

const TONE = {
  session: 'text-emerald-400', nav: 'text-cyan-400', window: 'text-blue-400',
  idle: 'text-amber-400', task: 'text-sky-400', type: 'text-violet-400', info: 'text-slate-300',
}

export default function RawLogsModal({ email, name, day, isToday = true, onClose }) {
  const [mode, setMode] = useState('processed')
  const scrollRef = useRef(null)
  const { data, isLoading } = useQuery({
    queryKey: ['raw', email, day],
    queryFn: () => trackerApi.rawEvents(email, { day, limit: 1000 }),
    refetchInterval: isToday ? 3000 : false, // live only for today
  })

  // chronological (oldest -> newest) for terminal flow
  const events = data ? [...data.events].reverse() : []
  const narrated = narrate(events)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [data, mode])

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
        {/* terminal window */}
        <div className="rounded-xl overflow-hidden shadow-2xl border border-slate-700/50 bg-slate-950">
          {/* title bar */}
          <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 border-b border-slate-800">
            <span className="w-3 h-3 rounded-full bg-red-500/80" />
            <span className="w-3 h-3 rounded-full bg-amber-500/80" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
            <div className="flex items-center gap-2 ml-3 text-slate-400 text-xs font-mono">
              <Terminal className="w-3.5 h-3.5" /> {name || email} — activity
            </div>
            <div className="ml-auto flex items-center gap-1 bg-slate-800 rounded-lg p-0.5">
              {['processed', 'raw'].map((m) => (
                <button key={m} onClick={() => setMode(m)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition ${mode === m ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
                  {m === 'processed' ? 'Show Processed' : 'Show Raw'}
                </button>
              ))}
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-white ml-1"><X className="w-4 h-4" /></button>
          </div>

          {/* audit notice */}
          <div className="px-4 py-1.5 bg-amber-950/40 border-b border-amber-900/30 flex items-center gap-2 text-[11px] text-amber-400/90 font-mono">
            <ShieldAlert className="w-3.5 h-3.5" /> raw log access is audit-logged
          </div>

          {/* terminal body */}
          <div ref={scrollRef} className="h-[55vh] overflow-auto p-4 font-mono text-xs leading-relaxed bg-slate-950">
            {isLoading ? (
              <div className="text-slate-500">connecting…</div>
            ) : events.length === 0 ? (
              <div className="text-slate-500">$ waiting for activity…</div>
            ) : mode === 'processed' ? (
              narrated.map((l, i) => (
                <div key={i} className="flex gap-3">
                  <span className="text-slate-600 shrink-0">{format(l.ts, 'HH:mm:ss')}</span>
                  <span className={TONE[l.tone] || TONE.info}>
                    <span className="text-slate-600">›</span> {l.text}
                  </span>
                </div>
              ))
            ) : (
              events.map((e, i) => (
                <div key={i} className="flex gap-3">
                  <span className="text-slate-600 shrink-0">{format(new Date(e.ts), 'HH:mm:ss')}</span>
                  <span className={`shrink-0 w-44 ${RAW_COLOR[e.event_type] || 'text-slate-300'}`}>{e.event_type}</span>
                  <span className="text-slate-500 truncate">
                    {e.url || e.domain || ''}
                    {e.metadata ? <span className="text-slate-600"> {JSON.stringify(e.metadata)}</span> : ''}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
