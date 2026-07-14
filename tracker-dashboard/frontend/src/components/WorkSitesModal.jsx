import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Plus, Trash2, SlidersHorizontal } from 'lucide-react'
import { trackerApi } from '../lib/api'
import { fmtDur } from '../lib/auth'

// Fallback colors when a site has no explicit color chosen.
const WORK_COLOR = '#10b981'
const OFF_COLOR = '#f59e0b'
const fallback = (isWork) => (isWork ? WORK_COLOR : OFF_COLOR)

// visited: [{ domain, active_ms }] — the hostnames this employee actually visited.
export default function WorkSitesModal({ email, name, visited = [], onClose }) {
  const qc = useQueryClient()
  const [rows, setRows] = useState(null) // null until config loads
  const [newDomain, setNewDomain] = useState('')

  const { data: cfg } = useQuery({
    queryKey: ['workSites', email],
    queryFn: () => trackerApi.workSites(email),
  })

  // Build the editable list = union of configured sites + visited hostnames.
  useEffect(() => {
    if (!cfg) return
    const byDomain = {}
    for (const c of cfg.sites) {
      byDomain[c.domain] = {
        domain: c.domain, is_work: c.is_work,
        color: c.color || fallback(c.is_work), custom: !!c.color,
        existed: true, touched: false, ms: 0,
      }
    }
    for (const v of visited) {
      if (!v.domain) continue
      if (byDomain[v.domain]) { byDomain[v.domain].ms = v.active_ms; continue }
      byDomain[v.domain] = {
        domain: v.domain, is_work: false, color: OFF_COLOR, custom: false,
        existed: false, touched: false, ms: v.active_ms,
      }
    }
    setRows(Object.values(byDomain).sort((a, b) => b.ms - a.ms || a.domain.localeCompare(b.domain)))
  }, [cfg]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = useMutation({
    mutationFn: (sites) => trackerApi.saveWorkSites(email, sites),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workSites', email] })
      qc.invalidateQueries({ queryKey: ['insights', email] })
      onClose()
    },
  })

  const patch = (domain, upd) =>
    setRows((rs) => rs.map((r) => (r.domain === domain ? { ...r, ...upd, touched: true } : r)))

  const toggleWork = (r) =>
    patch(r.domain, { is_work: !r.is_work, ...(r.custom ? {} : { color: fallback(!r.is_work) }) })

  const setColor = (r, color) => patch(r.domain, { color, custom: true })

  const remove = (r) => {
    if (r.existed) patch(r.domain, { _delete: true })
    setRows((rs) => rs.filter((x) => x.domain !== r.domain || (x.existed && !x._delete)))
  }

  const addDomain = () => {
    let d = newDomain.trim().toLowerCase()
    if (!d) return
    try { if (d.includes('://')) d = new URL(d).hostname } catch { /* keep as typed */ }
    if (d.startsWith('www.')) d = d.slice(4)
    if (rows.some((r) => r.domain === d)) { setNewDomain(''); return }
    setRows((rs) => [{ domain: d, is_work: true, color: WORK_COLOR, custom: false, existed: false, touched: true, ms: 0 }, ...rs])
    setNewDomain('')
  }

  const onSave = () => {
    const sites = (rows || [])
      .filter((r) => r.touched)
      .map((r) => (r._delete
        ? { domain: r.domain, delete: true }
        : { domain: r.domain, is_work: r.is_work, color: r.custom ? r.color : null }))
    save.mutate(sites)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* header */}
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
          <SlidersHorizontal className="w-4 h-4 text-indigo-500" />
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-800 text-sm">Configure work sites</h3>
            <p className="text-xs text-slate-400 truncate">{name || email}</p>
          </div>
          <button onClick={onClose} className="ml-auto text-slate-400 hover:text-slate-700"><X className="w-4 h-4" /></button>
        </div>

        {/* add site */}
        <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
          <input
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addDomain()}
            placeholder="Add a site (e.g. app.encord.com)"
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
          />
          <button onClick={addDomain} className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-800 px-2 py-2">
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>

        {/* list */}
        <div className="max-h-[50vh] overflow-auto px-2 py-2">
          {rows == null ? (
            <p className="text-slate-400 text-sm px-3 py-6 text-center">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-slate-400 text-sm px-3 py-6 text-center">No sites yet — add one above.</p>
          ) : (
            rows.map((r) => (
              <div key={r.domain} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50">
                <input
                  type="color" value={r.color} onChange={(e) => setColor(r, e.target.value)}
                  title="Pick a color for this site"
                  className="w-6 h-6 rounded cursor-pointer border border-slate-200 bg-white p-0 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-slate-700 truncate">{r.domain}</div>
                  {r.ms > 0 && <div className="text-[11px] text-slate-400">{fmtDur(r.ms)} on this day</div>}
                </div>
                <button
                  onClick={() => toggleWork(r)}
                  className={`text-xs font-medium px-2.5 py-1 rounded-full transition ${r.is_work ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                >
                  {r.is_work ? 'Work' : 'Off-work'}
                </button>
                <button onClick={() => remove(r)} className="text-slate-300 hover:text-red-500" title="Remove">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-100 bg-slate-50">
          {save.isError && <span className="text-xs text-red-500 mr-auto">Save failed. Try again.</span>}
          <button onClick={onClose} className="text-sm text-slate-500 hover:text-slate-800 px-3 py-2">Cancel</button>
          <button
            onClick={onSave} disabled={save.isPending}
            className="inline-flex items-center gap-1.5 bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-slate-800 disabled:opacity-50"
          >
            {save.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
