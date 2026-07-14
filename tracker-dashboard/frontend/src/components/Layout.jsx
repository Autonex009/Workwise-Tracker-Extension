import { NavLink } from 'react-router-dom'
import { Users, Radio, LogOut } from 'lucide-react'
import { getAuth, logout } from '../lib/auth'
import BrandLockup from './BrandLockup'

const navItems = [
  { to: '/', label: 'Team Overview', icon: Users, end: true },
  { to: '/live', label: 'Live Status', icon: Radio },
]

export default function Layout({ children }) {
  const { name, email, role } = getAuth()
  return (
    <div className="min-h-full flex bg-slate-100 font-sans text-slate-900">
      {/* Sidebar — dark navy gradient (mirrors portal AdminLayout) */}
      <aside className="w-72 shrink-0 flex flex-col text-white bg-[linear-gradient(180deg,#020617_0%,#07142d_50%,#0b1b44_100%)] shadow-2xl">
        <div className="relative overflow-hidden border-b border-white/10 px-6 py-6">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.18),_transparent_55%)]" />
          <div className="relative">
            <BrandLockup subtitle={role === 'pm' ? 'Team Control' : 'Admin Control Center'} tone="dark" />
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-2">Overview</p>
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-900/20'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`
              }
            >
              <Icon className="w-5 h-5" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="px-1 mb-3">
            <div className="text-sm text-white font-semibold truncate">{name || email}</div>
            <div className="text-[11px] text-blue-300/80 uppercase tracking-wider">{role}</div>
          </div>
          <button onClick={logout} className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors px-1">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-6 lg:p-8 animate-fade-in">{children}</div>
      </main>
    </div>
  )
}
