import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, Mail, Shield, Users, AlertCircle } from 'lucide-react'
import { authApi } from '../lib/api'
import { setSession, getAuth } from '../lib/auth'
import BrandLockup from '../components/BrandLockup'

const THEMES = {
  admin: {
    label: 'Admin',
    icon: Shield,
    shell: 'from-[#071229] via-[#0b1b44] to-[#102c73]',
    badge: 'border-blue-300/20 bg-blue-300/10 text-blue-100',
    text: 'text-blue-100',
    eyebrow: 'Admin Control',
    title: 'Operate the whole annotation workforce.',
    description: 'A single command surface for live status, productivity insights, and task throughput across every annotator.',
    highlights: [
      { title: 'Full Oversight', copy: 'Every employee, every session, in one place.' },
      { title: 'Live Status', copy: 'See who is active, idle, or offline right now.' },
    ],
    button: 'bg-gradient-to-r from-[#103ea8] via-[#1c4fd1] to-[#2b67ff] hover:brightness-110 shadow-[0_18px_40px_rgba(29,78,216,0.35)]',
    hint: 'admin@tracker.local · Admin@2026',
  },
  pm: {
    label: 'PM',
    icon: Users,
    shell: 'from-[#0b1a45] via-[#133b8b] to-[#1f58c7]',
    badge: 'border-cyan-200/20 bg-cyan-100/10 text-cyan-50',
    text: 'text-blue-50',
    eyebrow: 'Project Leadership',
    title: 'Lead your team with sharper visibility.',
    description: 'Track your team’s focus time, task flow, and live activity — scoped to just the people you manage.',
    highlights: [
      { title: 'Team Scope', copy: 'Only the annotators allocated to you.' },
      { title: 'Deep-Dives', copy: 'Per-employee trends, tasks, and raw activity.' },
    ],
    button: 'bg-[#123fa9] hover:bg-[#0f348a] shadow-[0_16px_38px_rgba(18,63,169,0.26)]',
    hint: 'pm@tracker.com · Pm@2026',
  },
}

export default function Login() {
  const nav = useNavigate()
  const [role, setRole] = useState('admin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  if (getAuth().authed) nav('/', { replace: true })
  const t = THEMES[role]

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const resp = await authApi.login(email, password)
      setSession(resp)
      nav('/', { replace: true })
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex font-sans">
      {/* Left — brand panel */}
      <div className={`hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br ${t.shell}`}>
        <div className="absolute inset-0 opacity-[0.1]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.18) 1px, transparent 1px)', backgroundSize: '36px 36px' }} />
        <div className="absolute inset-y-0 right-0 w-[48%] bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.12),_transparent_68%)]" />
        <div className="relative z-10 flex h-full w-full flex-col justify-between p-14 xl:p-20">
          <div className="space-y-10">
            <BrandLockup subtitle="Productivity Dashboard" tone="dark" />
            <div className={`inline-flex items-center rounded-full border px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.28em] ${t.badge}`}>
              {t.eyebrow}
            </div>
            <div className="max-w-xl space-y-5">
              <h1 className="text-4xl xl:text-5xl font-bold leading-[1.05] tracking-tight text-white">{t.title}</h1>
              <p className={`max-w-lg text-base leading-7 ${t.text}`}>{t.description}</p>
            </div>
          </div>
          <div className="grid max-w-xl grid-cols-2 gap-4">
            {t.highlights.map((h) => (
              <div key={h.title} className="rounded-2xl border border-white/15 bg-white/[0.08] p-4 backdrop-blur-sm">
                <div className="text-sm font-semibold text-white">{h.title}</div>
                <p className={`mt-1 text-sm ${t.text}`}>{h.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right — form */}
      <div className="relative flex flex-1 flex-col items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.12),_transparent_32%),linear-gradient(180deg,#eff6ff_0%,#f8fafc_100%)] p-6 sm:p-10">
        {/* role switch */}
        <div className="absolute right-0 top-0 flex gap-2 p-6">
          {Object.entries(THEMES).map(([key, r]) => {
            const Icon = r.icon
            const active = role === key
            return (
              <button key={key} type="button" onClick={() => { setRole(key); setError(null) }}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${active ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-500 hover:text-slate-800'}`}>
                <Icon className="h-3.5 w-3.5" /> {r.label}
              </button>
            )
          })}
        </div>

        <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white/95 p-8 shadow-[0_25px_80px_rgba(15,23,42,0.12)] backdrop-blur animate-scale-in">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">{t.label === 'Admin' ? 'Admin Console' : 'Project Manager Login'}</h2>
            <p className="mt-2 text-sm text-slate-500">Sign in to the productivity dashboard</p>
          </div>

          {error && (
            <div className="mb-5 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}

          <form onSubmit={submit} className="space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="input" placeholder={`${role}@company.com`} />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="input" placeholder="••••••••" />
              </div>
            </div>
            <button type="submit" disabled={loading}
              className={`flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 font-semibold text-white transition-all disabled:opacity-60 ${t.button}`}>
              {loading ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : `Sign in as ${t.label}`}
            </button>
          </form>

          <div className="mt-5 border-t border-slate-100 pt-4 text-center">
            <p className="text-xs text-slate-400">Demo {t.label.toLowerCase()}: <span className="font-mono text-slate-500">{t.hint}</span></p>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-slate-400">© {new Date().getFullYear()} WorkWise Tracker</p>
      </div>
    </div>
  )
}
