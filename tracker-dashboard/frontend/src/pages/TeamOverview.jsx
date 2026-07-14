import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Users, Activity, CheckSquare, SkipForward, Clock } from 'lucide-react'
import { trackerApi } from '../lib/api'
import { getAuth, fmtDur, pct } from '../lib/auth'
import { paginate } from '../lib/paginate'
import { filterMembers } from '../lib/filters'
import StatusBadge from '../components/StatusBadge'
import Pagination from '../components/Pagination'
import MemberFilters from '../components/MemberFilters'

function Kpi({ icon: Icon, label, value, tint }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-500">{label}</span>
        <Icon className={`w-5 h-5 ${tint}`} />
      </div>
      <div className="text-2xl font-bold text-slate-900 mt-2">{value}</div>
    </div>
  )
}

export default function TeamOverview() {
  const nav = useNavigate()
  const { role } = getAuth()
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const { data, isLoading, error } = useQuery({ queryKey: ['team'], queryFn: () => trackerApi.team() })

  if (isLoading) return <div className="text-slate-500">Loading team…</div>
  if (error) return <div className="text-red-600">Failed to load: {error.message}</div>

  const k = data.kpis
  const filtered = filterMembers(data.members, { search, status })
  const pg = paginate(filtered, page, pageSize)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Team Overview</h1>
        <p className="text-sm text-slate-500">
          {role === 'admin' ? 'All annotators' : 'Your team'} · {data.day}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <Kpi icon={Users} label="Members" value={k.members} tint="text-indigo-500" />
        <Kpi icon={Activity} label="Active now" value={k.active_now} tint="text-emerald-500" />
        <Kpi icon={Clock} label="Team active time" value={fmtDur(k.team_active_ms)} tint="text-blue-500" />
        <Kpi icon={CheckSquare} label="Tasks started" value={k.tasks_started} tint="text-violet-500" />
        <Kpi icon={SkipForward} label="Skip rate" value={pct(k.skip_rate)} tint="text-amber-500" />
      </div>

      <MemberFilters
        className="mb-4"
        search={search} onSearch={(v) => { setSearch(v); setPage(1) }}
        status={status} onStatus={(v) => { setStatus(v); setPage(1) }}
      />

      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-5 py-3 font-medium">Employee</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Active</th>
              <th className="px-5 py-3 font-medium">Focus</th>
              <th className="px-5 py-3 font-medium">Tasks</th>
              <th className="px-5 py-3 font-medium">Skipped</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pg.items.map((m) => (
              <tr
                key={m.email}
                onClick={() => nav(`/employee/${encodeURIComponent(m.email)}`)}
                className="hover:bg-indigo-50/40 cursor-pointer"
              >
                <td className="px-5 py-3">
                  <div className="font-medium text-slate-900">{m.name || m.email}</div>
                  <div className="text-xs text-slate-400">{m.designation || m.email}</div>
                </td>
                <td className="px-5 py-3"><StatusBadge status={m.status} /></td>
                <td className="px-5 py-3 text-slate-700">{fmtDur(m.active_ms)}</td>
                <td className="px-5 py-3 text-slate-700">{pct(m.focus_ratio)}</td>
                <td className="px-5 py-3 text-slate-700">{m.tasks_started}</td>
                <td className="px-5 py-3 text-slate-700">{m.tasks_skipped}</td>
              </tr>
            ))}
            {pg.items.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-400">No members.</td></tr>
            )}
          </tbody>
        </table>

        <Pagination
          className="border-t border-slate-100"
          currentPage={pg.currentPage} totalPages={pg.totalPages} startIndex={pg.startIndex}
          pageSize={pageSize} total={pg.total}
          onPage={setPage} onPageSize={(n) => { setPageSize(n); setPage(1) }}
        />
      </div>
    </div>
  )
}
