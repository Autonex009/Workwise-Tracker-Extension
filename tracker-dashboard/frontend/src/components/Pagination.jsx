// Shared pagination footer: rows-per-page selector + "Showing X–Y of Z" +
// Previous / numbered (with ellipsis) / Next. Nav buttons show only when there's
// more than one page; the selector + count always show. Mirrors the PM portal's
// Table.jsx pagination styling.
const PAGE_SIZES = [10, 25, 50, 100]

export default function Pagination({ currentPage, totalPages, startIndex, pageSize, total, onPage, onPageSize, className = '' }) {
  const pageButtons = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
    .reduce((acc, p, idx, arr) => {
      if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...')
      acc.push(p)
      return acc
    }, [])

  return (
    <div className={`flex items-center justify-between gap-4 px-5 py-3 ${className}`}>
      <div className="flex items-center gap-3 text-sm text-slate-500">
        <label className="flex items-center gap-2">
          Rows per page
          <select
            value={pageSize}
            onChange={(e) => onPageSize(Number(e.target.value))}
            className="rounded-lg border border-slate-200 text-sm px-2 py-1 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
          >
            {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <span className="hidden sm:inline">
          Showing {total === 0 ? 0 : startIndex + 1}–{Math.min(startIndex + pageSize, total)} of {total}
        </span>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          {pageButtons.map((p, idx) =>
            p === '...' ? (
              <span key={`e-${idx}`} className="px-2 text-slate-400 text-sm">…</span>
            ) : (
              <button
                key={p}
                onClick={() => onPage(p)}
                className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                  currentPage === p
                    ? 'bg-indigo-600 border-indigo-600 text-white font-medium'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {p}
              </button>
            )
          )}
          <button
            onClick={() => onPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
