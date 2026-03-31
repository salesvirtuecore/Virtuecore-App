import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, GitBranch, UserCheck, DollarSign,
  LogOut, Webhook, Globe, Menu, X, ChevronLeft, ChevronRight,
  Zap, BookOpen
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import NotificationBell from '../ui/NotificationBell'
import HelpChatWidget from '../ui/HelpChatWidget'
import { subscribeToPush } from '../../lib/pushNotifications'

const NAV = [
  { to: '/admin',          label: 'Overview',      icon: LayoutDashboard, end: true },
  { to: '/admin/clients',  label: 'Clients',       icon: Users },
  { to: '/admin/pipeline', label: 'Pipeline',      icon: GitBranch },
  { to: '/admin/vas',      label: 'VA Management', icon: UserCheck },
  { to: '/admin/revenue',  label: 'Revenue',       icon: DollarSign },
  { to: '/admin/analytics',label: 'Web Analytics', icon: Globe },
  { to: '/admin/webhooks', label: 'Integrations',  icon: Webhook },
]

const EXTERNAL = [
  { href: 'https://academy.virtuecore.co.uk', label: 'Academy',          icon: BookOpen },
  { href: 'https://adint.virtuecore.co.uk',   label: 'Ad Intelligence',  icon: Zap },
]

function SidebarContent({ profile, onLogout, onNavClick, collapsed }) {
  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={`flex-shrink-0 border-b border-white/[0.06] ${collapsed ? 'px-0 py-5 items-center flex flex-col' : 'px-5 py-5'}`}>
        <div className={`flex items-center gap-2.5 ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-8 h-8 rounded-lg bg-vc-primary flex items-center justify-center flex-shrink-0">
            <span className="text-white text-sm font-bold font-heading">V</span>
          </div>
          {!collapsed && (
            <div>
              <span className="text-text-primary font-semibold text-sm tracking-wide font-heading">VirtueCore</span>
              <p className="text-text-tertiary text-xs mt-0.5">Command Centre</p>
            </div>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className={`flex-1 py-4 overflow-y-auto overflow-x-hidden space-y-0.5 ${collapsed ? 'px-2' : 'px-3'}`}>
        {!collapsed && <p className="vc-section-label px-3 mb-2">Navigation</p>}
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavClick}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              `vc-nav-item ${collapsed ? 'justify-center px-0 w-10 h-10 mx-auto' : ''} ${isActive ? 'active' : ''}`
            }
          >
            <Icon size={18} className="flex-shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}

        {!collapsed && (
          <>
            <hr className="vc-divider my-3 mx-3" />
            <p className="vc-section-label px-3 mb-2">External</p>
          </>
        )}
        {!collapsed && EXTERNAL.map(({ href, label, icon: Icon }) => (
          <a
            key={href}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onNavClick}
            className="vc-nav-item"
          >
            <Icon size={18} className="flex-shrink-0" />
            <span>{label}</span>
            <span className="ml-auto text-text-tertiary text-xs">↗</span>
          </a>
        ))}
      </nav>

      {/* User */}
      <div className={`flex-shrink-0 border-t border-white/[0.06] py-3 ${collapsed ? 'px-2' : 'px-3'}`}>
        {!collapsed && (
          <div className="flex items-center gap-2.5 px-3 py-2 mb-1">
            <div className="w-7 h-7 rounded-full bg-vc-primary flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">
                {profile?.full_name?.[0]?.toUpperCase() ?? 'A'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-text-primary text-xs font-medium truncate">{profile?.full_name ?? 'Admin'}</p>
              <p className="text-text-tertiary text-xs capitalize">{profile?.role ?? 'admin'}</p>
            </div>
          </div>
        )}
        <button
          onClick={onLogout}
          title={collapsed ? 'Sign out' : undefined}
          className={`flex items-center gap-2 w-full px-3 py-2 text-text-secondary hover:text-text-primary text-sm rounded hover:bg-bg-tertiary transition-colors ${collapsed ? 'justify-center px-0 w-10 h-10 mx-auto' : ''}`}
        >
          <LogOut size={16} />
          {!collapsed && 'Sign out'}
        </button>
      </div>
    </div>
  )
}

export default function AdminLayout() {
  const { profile, logout } = useAuth()
  const navigate = useNavigate()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    if (profile?.id) subscribeToPush(profile.id)
  }, [profile?.id])

  useEffect(() => {
    if (drawerOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [drawerOpen])

  async function handleLogout() {
    setDrawerOpen(false)
    await logout()
    navigate('/login')
  }

  const sidebarWidth = collapsed ? 'w-[64px]' : 'w-[260px]'

  return (
    <div className="flex h-screen overflow-hidden bg-bg-primary">
      {/* Sidebar — desktop */}
      <aside className={`hidden md:flex flex-shrink-0 ${sidebarWidth} bg-bg-secondary border-r border-white/[0.06] flex-col relative transition-all duration-200`}>
        <SidebarContent profile={profile} onLogout={handleLogout} onNavClick={() => {}} collapsed={collapsed} />
        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-bg-elevated border border-white/[0.08] flex items-center justify-center text-text-secondary hover:text-text-primary hover:border-vc-primary transition-colors z-10"
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      </aside>

      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
      )}

      {/* Mobile drawer */}
      <aside
        className={`fixed top-0 left-0 h-full w-[260px] bg-bg-secondary border-r border-white/[0.06] flex flex-col z-50 md:hidden transform transition-transform duration-300 ease-in-out ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <button
          onClick={() => setDrawerOpen(false)}
          className="absolute top-4 right-4 text-text-secondary hover:text-text-primary p-1 rounded transition-colors"
        >
          <X size={18} />
        </button>
        <SidebarContent profile={profile} onLogout={handleLogout} onNavClick={() => setDrawerOpen(false)} collapsed={false} />
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06] bg-bg-secondary flex-shrink-0 h-14">
          <button
            className="md:hidden text-text-secondary hover:text-text-primary p-1 -ml-1 transition-colors"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <div className="hidden md:flex items-center gap-2">
            <span className="text-text-secondary text-sm">
              Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'},{' '}
              <span className="text-text-primary font-medium">{profile?.full_name?.split(' ')[0] ?? 'Samuel'}</span>
            </span>
          </div>
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
