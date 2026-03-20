import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Users, GitBranch, UserCheck, DollarSign, LogOut, Webhook, Globe } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import NotificationBell from '../ui/NotificationBell'
import HelpChatWidget from '../ui/HelpChatWidget'

const NAV = [
  { to: '/admin', label: 'Overview', short: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/clients', label: 'Clients', short: 'Clients', icon: Users },
  { to: '/admin/pipeline', label: 'Pipeline', short: 'Pipeline', icon: GitBranch },
  { to: '/admin/vas', label: 'VA Management', short: 'VAs', icon: UserCheck },
  { to: '/admin/revenue', label: 'Revenue', short: 'Revenue', icon: DollarSign },
  { to: '/admin/analytics', label: 'Web Analytics', short: 'Analytics', icon: Globe },
  { to: '/admin/webhooks', label: 'Integrations', short: 'Integrations', icon: Webhook },
]

export default function AdminLayout() {
  const { profile, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      {/* Sidebar - desktop only */}
      <aside className="hidden md:flex w-56 flex-shrink-0 bg-vc-sidebar flex-col">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gold flex items-center justify-center">
              <span className="text-white text-sm font-bold">V</span>
            </div>
            <span className="text-white font-semibold text-sm tracking-wide">VirtueCore</span>
          </div>
          <p className="text-white/40 text-xs mt-1">Command Centre</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors ${
                  isActive
                    ? 'bg-white/10 text-white font-medium'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="px-3 py-4 border-t border-white/10">
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="w-7 h-7 rounded-full bg-gold flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">
                {profile?.full_name?.[0] ?? 'A'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-medium truncate">{profile?.full_name ?? 'Admin'}</p>
              <p className="text-white/40 text-xs capitalize">{profile?.role ?? 'admin'}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 text-white/60 hover:text-white text-sm mt-1 rounded hover:bg-white/5 transition-colors"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-vc-border bg-vc-sidebar flex-shrink-0">
          {/* Logo - mobile only */}
          <div className="flex items-center gap-2 md:hidden">
            <div className="w-7 h-7 bg-gold flex items-center justify-center">
              <span className="text-white text-sm font-bold">V</span>
            </div>
            <span className="text-white font-semibold text-sm tracking-wide">VirtueCore</span>
          </div>
          <div className="hidden md:block" />
          <NotificationBell />
        </div>

        <div className="flex-1 overflow-y-auto pb-16 md:pb-0">
          <Outlet />
        </div>
      </main>

      {/* Bottom nav - mobile only */}
      <nav className="fixed bottom-0 left-0 right-0 md:hidden bg-vc-sidebar border-t border-white/10 flex z-50 safe-area-pb">
        {NAV.map(({ to, short, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
                isActive ? 'text-white' : 'text-white/50'
              }`
            }
          >
            <Icon size={20} />
            <span className="text-[9px] leading-tight text-center">{short}</span>
          </NavLink>
        ))}
      </nav>

      <HelpChatWidget />
    </div>
  )
}
