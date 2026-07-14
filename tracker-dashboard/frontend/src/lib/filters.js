// Filter a member list by free-text search (name/email/designation) and status.
export function filterMembers(members, { search = '', status = 'all' }) {
  const q = search.trim().toLowerCase()
  return members.filter((m) => {
    if (status !== 'all' && m.status !== status) return false
    if (q && !`${m.name || ''} ${m.email || ''} ${m.designation || ''}`.toLowerCase().includes(q)) return false
    return true
  })
}
