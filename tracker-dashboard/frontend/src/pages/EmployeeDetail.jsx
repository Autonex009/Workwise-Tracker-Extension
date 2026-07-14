import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ResponsiveContainer, ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { formatDistanceToNow } from 'date-fns'
import { ArrowLeft, FileText, Clock, Crosshair, ListChecks, Timer, ChevronLeft, ChevronRight, SlidersHorizontal, Briefcase } from 'lucide-react'
import { trackerApi } from '../lib/api'
import { fmtDur, pct } from '../lib/auth'
import StatusBadge from '../components/StatusBadge'
import RawLogsModal from '../components/RawLogsModal'
import WorkSitesModal from '../components/WorkSitesModal'

const h = (ms) => +(ms / 3600000).toFixed(2)
const todayStr = () => new Date().toISOString().slice(0, 10)
const minDay = () => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)

// Fallback colors when a site has no explicit color set (mirror WorkSitesModal).
const WORK_COLOR = '#10b981'
const OFF_COLOR = '#f59e0b'

// Exact hostname of a URL, lowercased, leading www. stripped — mirrors the
// backend's domain_of() so client classification matches server classification.
const hostOf = (url) => {
  if (!url) return null
  try {
    const host = new URL(url).hostname.toLowerCase()
    return host.startsWith('www.') ? host.slice(4) : host
  } catch { return null }
}

function Card({ title, right, children }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        {right}
      </div>
      {children}
    </div>
  )
}

function Kpi({ icon: Icon, tint, label, value, sub }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 p-5 shadow-sm">
      <div className="flex items-center gap-2 text-slate-500 text-sm">
        <Icon className={`w-4 h-4 ${tint}`} /> {label}
      </div>
      <div className="text-2xl font-bold text-slate-900 mt-2">{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  )
}

const IDLE_BG = '#cbd5e1'      // slate-300
const OFFLINE_BG = '#e2e8f0'   // slate-200
// classify(url) -> { is_work, color } | null (unconfigured). Colors each active
// segment by the site's chosen color; idle/paused stay grey.
function buildTimeline(events, classify) {
  if (events.length < 2) return null
  let open = false, idle = false, site = null
  const segs = []
  for (let i = 0; i < events.length; i++) {
    const e = events[i]
    if (e.event_type === 'SESSION_STARTED' || e.event_type === 'SESSION_RESUMED') open = true
    else if (e.event_type === 'SESSION_PAUSED' || e.event_type === 'SESSION_STOPPED') open = false
    if (e.event_type === 'IDLE_STATE_CHANGED') { const s = e.metadata?.state; idle = s === 'idle' || s === 'locked' }
    if (e.url || e.domain) site = classify(e.url || `http://${e.domain}`)
    if (i + 1 < events.length) {
      const dur = Math.max(0, new Date(events[i + 1].ts) - new Date(e.ts))
      let color = OFFLINE_BG, label = 'Paused / offline'
      if (open && idle) { color = IDLE_BG; label = 'Idle' }
      else if (open) {
        color = site?.color || (site?.is_work ? WORK_COLOR : OFF_COLOR)
        label = site?.is_work ? 'Work site' : 'Off-work site'
      }
      segs.push({ dur, color, label })
    }
  }
  return { segs, start: new Date(events[0].ts), end: new Date(events[events.length - 1].ts) }
}

export default function EmployeeDetail() {
  const { email } = useParams()
  const [showRaw, setShowRaw] = useState(false)
  const [showSites, setShowSites] = useState(false)
  const [day, setDay] = useState(todayStr())
  const isToday = day === todayStr()

  const { data, isLoading, error } = useQuery({
    queryKey: ['insights', email, day],
    queryFn: () => trackerApi.insights(email, { day, days: 7 }),
    refetchInterval: isToday ? 30000 : false,
  })
  const { data: rawData } = useQuery({
    queryKey: ['raw', email, day],
    queryFn: () => trackerApi.rawEvents(email, { day, limit: 1000 }),
    refetchInterval: isToday ? 15000 : false,
  })

  const shiftDay = (delta) => {
    const d = new Date(day + 'T00:00:00Z')
    d.setUTCDate(d.getUTCDate() + delta)
    const s = d.toISOString().slice(0, 10)
    if (s >= minDay() && s <= todayStr()) setDay(s)
  }

  if (isLoading) return <div className="text-slate-500">Loading…</div>
  if (error) return <div className="text-red-600">Failed to load: {error.message}</div>

  const ds = data.dayStats || {}
  const activeMs = ds.active_ms || 0

  // Per-employee work-site config → hostname lookup for timeline coloring.
  const workMap = {}
  for (const s of data.workSites || []) workMap[s.domain] = s
  const classify = (url) => workMap[hostOf(url)] || null

  const tabs = data.selected.domainTime // entries carry server-computed { domain, is_work, color }
  const workMs = data.selected.workSiteMs || 0
  const otherMs = data.selected.offWorkMs || 0
  const totalTabMs = data.selected.totalTabMs || 0
  const workFocus = totalTabMs ? workMs / totalTabMs : null
  const siteColor = (t) => t.color || (t.is_work ? WORK_COLOR : OFF_COLOR)

  const started = ds.tasks_started || 0
  const skipRate = started ? (ds.tasks_skipped || 0) / started : null
  const throughput = activeMs ? started / (activeMs / 3600000) : null

  const trend = data.daily.map((d) => ({ day: d.day.slice(5), active: h(d.active_ms), tasks: d.tasks_started || 0 }))
  const timeline = buildTimeline(rawData ? [...rawData.events].reverse() : [], classify)
  const dayLabel = new Date(day + 'T00:00:00Z').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })

  return (
    <div>
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-4">
        <ArrowLeft className="w-4 h-4" /> Team Overview
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{data.name || email}</h1>
            <StatusBadge status={data.status} />
          </div>
          <p className="text-sm text-slate-500">
            {data.designation || ''} · {email}
            {data.lastEventAt && <> · last seen {formatDistanceToNow(new Date(data.lastEventAt), { addSuffix: true })}</>}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Day selector */}
          <div className="flex items-center rounded-lg border border-slate-200 bg-white overflow-hidden">
            <button onClick={() => shiftDay(-1)} disabled={day <= minDay()}
              className="px-2 py-2 text-slate-500 hover:bg-slate-50 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
            <input type="date" value={day} max={todayStr()} min={minDay()}
              onChange={(e) => { if (e.target.value) setDay(e.target.value) }}
              className="px-2 py-1.5 text-sm text-slate-700 focus:outline-none" />
            <button onClick={() => shiftDay(1)} disabled={isToday}
              className="px-2 py-2 text-slate-500 hover:bg-slate-50 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
          </div>
          {!isToday && (
            <button onClick={() => setDay(todayStr())} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium px-2">Today</button>
          )}
          <button
            onClick={() => setShowSites(true)}
            className="inline-flex items-center gap-2 border border-slate-200 bg-white text-slate-700 text-sm font-medium px-3 py-2 rounded-lg hover:bg-slate-50"
          >
            <SlidersHorizontal className="w-4 h-4 text-indigo-500" /> Work sites
          </button>
          <button
            onClick={() => setShowRaw(true)}
            className="inline-flex items-center gap-2 bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-slate-800"
          >
            <FileText className="w-4 h-4" /> View raw logs
          </button>
        </div>
      </div>

      {!isToday && (
        <div className="mb-4 text-sm text-slate-500">Viewing <span className="font-medium text-slate-700">{dayLabel}</span> (historic)</div>
      )}

      {/* KPI row — hours · work sites · focus · output */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <Kpi icon={Clock} tint="text-blue-500" label="Worked" value={fmtDur(activeMs)}
          sub={`${fmtDur(ds.paused_ms || 0)} idle/paused`} />
        <Kpi icon={Briefcase} tint="text-emerald-500" label="Work-site time" value={fmtDur(workMs)}
          sub={`${fmtDur(otherMs)} off-work`} />
        <Kpi icon={Crosshair} tint="text-teal-500" label="Work focus" value={pct(workFocus)}
          sub={totalTabMs ? `of ${fmtDur(totalTabMs)} on tabs` : 'no tab activity'} />
        <Kpi icon={ListChecks} tint="text-violet-500" label="Tasks started" value={started}
          sub={skipRate != null ? `${pct(skipRate)} skip rate` : 'no tasks'} />
        <Kpi icon={Timer} tint="text-amber-500" label="Avg time / task" value={ds.avg_task_ms ? fmtDur(ds.avg_task_ms) : '—'}
          sub={throughput != null ? `${throughput.toFixed(1)} tasks/hr` : ''} />
      </div>

      {/* Activity timeline */}
      <Card title="Activity timeline"
        right={<div className="flex items-center gap-3 text-[11px] text-slate-500">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: WORK_COLOR }} />Work site</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: OFF_COLOR }} />Off-work</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: IDLE_BG }} />Idle</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: OFFLINE_BG }} />Paused</span>
        </div>}>
        {!timeline ? (
          <p className="text-slate-400 text-sm">No activity on this day.</p>
        ) : (
          <>
            <div className="flex h-8 w-full overflow-hidden rounded-lg bg-slate-100">
              {timeline.segs.map((s, i) => (
                <div key={i} title={`${s.label} · ${fmtDur(s.dur)}`} style={{ flexGrow: Math.max(s.dur, 1), background: s.color }} />
              ))}
            </div>
            <div className="flex justify-between text-[11px] text-slate-400 mt-1.5">
              <span>{timeline.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              <span>{timeline.end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
        {/* Where time went */}
        <Card title="Where time went (raw)">
          <div className="flex items-center gap-2 mb-3 text-xs">
            <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden flex">
              <div className="h-full" style={{ width: `${totalTabMs ? (workMs / totalTabMs) * 100 : 0}%`, background: WORK_COLOR }} />
              <div className="h-full" style={{ width: `${totalTabMs ? (otherMs / totalTabMs) * 100 : 0}%`, background: OFF_COLOR }} />
            </div>
          </div>
          <div className="flex justify-between text-xs mb-3">
            <span className="text-emerald-600 font-medium">Work sites {fmtDur(workMs)}</span>
            <span className="text-amber-600 font-medium">Off-work {fmtDur(otherMs)}</span>
          </div>
          <div className="space-y-2 max-h-48 overflow-auto pr-1">
            {tabs.length === 0 && <p className="text-slate-400 text-sm">No activity on this day.</p>}
            {tabs.map((t, i) => (
              <div key={i} className="flex items-center justify-between gap-3 text-xs">
                <span className="truncate flex items-center gap-1.5" title={t.url}>
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: siteColor(t) }} />
                  <span className="truncate text-slate-700">{t.url}</span>
                </span>
                <span className="shrink-0 text-slate-500 tabular-nums">{fmtDur(t.active_ms)}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* 7-day trend ending on the selected day */}
        <Card title="7 days ending on this day — hours & tasks">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="l" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar yAxisId="r" dataKey="tasks" name="Tasks" fill="#c7d2fe" radius={[4, 4, 0, 0]} />
                <Line yAxisId="l" type="monotone" dataKey="active" name="Active (h)" stroke="#6366f1" strokeWidth={3} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Recent tasks */}
      <div className="mt-6">
        <Card title="Tasks">
          <div className="max-h-56 overflow-auto -mx-1">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                {data.selected.tasks.length === 0 && <tr><td className="py-3 text-slate-400">No tasks on this day.</td></tr>}
                {data.selected.tasks.map((t, i) => (
                  <tr key={i}>
                    <td className="py-2 text-slate-700">{t.data_id}</td>
                    <td className="py-2"><span className={`text-xs px-2 py-0.5 rounded-full ${t.outcome === 'skipped' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{t.outcome}</span></td>
                    <td className="py-2 text-right text-slate-500">{t.duration_ms ? fmtDur(t.duration_ms) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {showRaw && <RawLogsModal email={email} name={data.name} day={day} isToday={isToday} onClose={() => setShowRaw(false)} />}
      {showSites && (
        <WorkSitesModal email={email} name={data.name} visited={tabs} onClose={() => setShowSites(false)} />
      )}
    </div>
  )
}
