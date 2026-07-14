import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Radio } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { trackerApi } from '../lib/api'
import { paginate } from '../lib/paginate'
import { filterMembers } from '../lib/filters'
import StatusBadge from '../components/StatusBadge'
import Pagination from '../components/Pagination'
import MemberFilters from '../components/MemberFilters'

const ORDER = { active: 0, idle: 1, offline: 2 }

export default function StatusBoard() {
  const nav = useNavigate()
  const [pageSize, setPageSize] = useState(25)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const { data, isLoading, error } = useQuery({
    queryKey: ['status'],
    queryFn: () => trackerApi.status(),
    refetchInterval: 5000, // live polling
  })

  if (isLoading) return <div className="text-slate-500">Loading…</div>
  if (error) return <div className="text-red-600">Failed to load: {error.message}</div>

  const members = [...data.members].sort((a, b) => ORDER[a.status] - ORDER[b.status] || (a.name || '').localeCompare(b.name || ''))
  const counts = members.reduce((acc, m) => ((acc[m.status] = (acc[m.status] || 0) + 1), acc), {})
  const pg = paginate(filterMembers(members, { search, status }), page, pageSize)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Radio className="w-6 h-6 text-emerald-500" /> Live Status
          </h1>
          <p className="text-sm text-slate-500">
            Auto-refreshing every 5s · {counts.active || 0} active · {counts.idle || 0} idle · {counts.offline || 0} offline
          </p>
        </div>
      </div>

      <MemberFilters
        className="mb-4"
        search={search} onSearch={(v) => { setSearch(v); setPage(1) }}
        status={status} onStatus={(v) => { setStatus(v); setPage(1) }}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {pg.items.map((m) => (
          <div
            key={m.email}
            onClick={() => nav(`/employee/${encodeURIComponent(m.email)}`)}
            className="bg-white rounded-xl border border-slate-200/70 p-4 shadow-sm flex items-center justify-between cursor-pointer hover:border-indigo-300"
          >
            <div className="min-w-0">
              <div className="font-medium text-slate-900 truncate">{m.name || m.email}</div>
              <div className="text-xs text-slate-400">
                {m.lastEventAt ? `seen ${formatDistanceToNow(new Date(m.lastEventAt), { addSuffix: true })}` : 'no activity'}
              </div>
            </div>
            <StatusBadge status={m.status} />
          </div>
        ))}
      </div>

      <div className="mt-4 bg-white rounded-xl border border-slate-200/70 shadow-sm">
        <Pagination
          currentPage={pg.currentPage} totalPages={pg.totalPages} startIndex={pg.startIndex}
          pageSize={pageSize} total={pg.total}
          onPage={setPage} onPageSize={(n) => { setPageSize(n); setPage(1) }}
        />
      </div>
    </div>
  )
}
