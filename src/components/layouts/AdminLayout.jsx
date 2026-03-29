import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Users, GitBranch, UserCheck, DollarSign, LogOut, Webhook, Globe, Menu, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import NotificationBell from '../ui/NotificationBell'
import HelpChatWidget from '../ui/HelpChatWidget'
import { subscribeToPush } from '../../lib/pushNotifications'

const NAV = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/clients', label: 'Clients', icon: Users },
  { to: '/admin/pipeline', label: 'Pipeline', icon: GitBranch },
  { to: '/admin/vas', label: 'VA Management', icon: UserCheck },
  { to: '/admin/revenue', label: 'Revenue', icon: DollarSign },
  { to: '/admin/analytics', label: 'Web Analytics', icon: Globe },
  { to: '/admin/webhooks', label: 'Integrations', icon: Webhook },
]

function SidebarContent({ profile, onLogout, onNavClick }) {
  return (
    <>
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-gold flex items-center justify-center">
            <span className="text-white text-sm font-bold">V</span>
          </div>
          <span className="text-white font-semibold text-sm tracking-wide">VirtueCore</span>
        </div>
        <p className="text-white/40 text-xs mt-1">Command Centre</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavClick}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded text-sm transition-colors ${
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
      <div className="px-3 py-4 border-t border-white/10 flex-shrink-0">
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
          onClick={onLogout}
          className="flex items-center gap-2 w-full px-3 py-2 text-white/60 hover:text-white text-sm mt-1 rounded hover:bg-white/5 transition-colors"
        >
          <LogOut size={14} />
          Sign out
        </button>
      </div>
    </>
  )
}

export default function AdminLayout() {
  const { profile, logout } = useAuth()
  const navigate = useNavigate()
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    if (profile?.id) subscribeToPush(profile.id)
  }, [profile?.id])

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [drawerOpen])

  async function handleLogout() {
    setDrawerOpen(false)
    await logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      {/* Sidebar - desktop only */}
      <aside className="hidden md:flex w-56 flex-shrink-0 bg-vc-sidebar flex-col">
        <SidebarContent profile={profile} onLogout={handleLogout} onNavClick={() => {}} />
      </aside>

      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`fixed top-0 left-0 h-full w-72 max-w-[85vw] bg-vc-sidebar flex flex-col z-50 md:hidden transform transition-transform duration-300 ease-in-out ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Close button */}
        <button
          onClick={() => setDrawerOpen(false)}
          className="absolute top-4 right-4 text-white/60 hover:text-white p-1"
        >
          <X size={20} />
        </button>
        <SidebarContent
          profile={profile}
          onLogout={handleLogout}
          onNavClick={() => setDrawerOpen(false)}
        />
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-vc-border bg-vc-sidebar flex-shrink-0">
          {/* Hamburger - mobile only */}
          <button
            className="md:hidden text-white p-1 -ml-1"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>

          {/* Logo - desktop only spacer */}
          <div className="hidden md:block" />

          <NotificationBell />
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <Outlet />
        </div>
      </main>

      <HelpChatWidget />
    </div>
  )
}
