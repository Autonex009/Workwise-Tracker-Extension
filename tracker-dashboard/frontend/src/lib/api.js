import axios from 'axios'

// In dev, VITE_API_BASE_URL is unset and Vite's proxy forwards /api -> the
// local FastAPI (see vite.config.js). In prod, set VITE_API_BASE_URL to the
// deployed backend origin (e.g. https://tracker-dashboard-api-production.up.railway.app)
// and requests go straight there.
const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
const baseURL = API_BASE ? `${API_BASE}/api` : '/api'

const api = axios.create({ baseURL, headers: { 'Content-Type': 'application/json' } })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      if (!location.pathname.startsWith('/login')) location.href = '/login'
    }
    return Promise.reject(error)
  },
)

export const authApi = {
  login: (email, password) => api.post('/auth/login', { email, password }).then((r) => r.data),
}

export const trackerApi = {
  team: (day) => api.get('/tracker/team', { params: { day } }).then((r) => r.data),
  insights: (email, { day, days = 7 } = {}) =>
    api.get(`/tracker/insights/${encodeURIComponent(email)}`, { params: { day, days } }).then((r) => r.data),
  rawEvents: (email, { day, since, limit = 200 } = {}) =>
    api.get(`/tracker/raw-events/${encodeURIComponent(email)}`, { params: { day, since, limit } }).then((r) => r.data),
  status: () => api.get('/tracker/status').then((r) => r.data),
  workSites: (email) => api.get(`/tracker/work-sites/${encodeURIComponent(email)}`).then((r) => r.data),
  saveWorkSites: (email, sites) =>
    api.put(`/tracker/work-sites/${encodeURIComponent(email)}`, { sites }).then((r) => r.data),
}

export default api
