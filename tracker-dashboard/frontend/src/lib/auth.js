// Minimal auth helpers mirroring the PM portal: JWT in localStorage, role read
// from the token payload.
function parseJwt(token) {
  try {
    return JSON.parse(atob(token.split('.')[1]))
  } catch {
    return null
  }
}

export function getAuth() {
  const token = localStorage.getItem('token')
  if (!token) return { authed: false }
  const payload = parseJwt(token)
  if (!payload || (payload.exp && payload.exp * 1000 < Date.now())) {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    return { authed: false }
  }
  return { authed: true, email: payload.email, role: payload.role, name: payload.name }
}

export function setSession(loginResp) {
  localStorage.setItem('token', loginResp.token)
  localStorage.setItem('user', JSON.stringify({ email: loginResp.email, name: loginResp.name, role: loginResp.role }))
}

export function logout() {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  location.href = '/login'
}

// formatting helpers
export const fmtDur = (ms) => {
  if (!ms) return '0m'
  const m = Math.round(ms / 60000)
  const h = Math.floor(m / 60)
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`
}
export const pct = (r) => (r == null ? '—' : `${Math.round(r * 100)}%`)
