import axios from 'axios'

const api = axios.create({ baseURL: '/api', headers: { 'Content-Type': 'application/json' } })

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
