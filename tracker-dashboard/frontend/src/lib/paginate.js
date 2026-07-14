// Pure pagination slice helper. Clamps the page so raising pageSize never
// strands you on an empty page.
export function paginate(items, page, pageSize) {
  const total = items.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const currentPage = Math.min(Math.max(1, page), totalPages)
  const startIndex = (currentPage - 1) * pageSize
  return {
    items: items.slice(startIndex, startIndex + pageSize),
    total,
    totalPages,
    currentPage,
    startIndex,
  }
}
