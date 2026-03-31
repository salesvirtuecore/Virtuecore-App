import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, FileText, Calendar, MessageSquare, Receipt,
  Video, CreditCard, BarChart2, Plug, LogOut, TrendingUp,
  Award, Zap, Calculator, Menu, X, HelpCircle
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

import { subscribeToPush } from '../../lib/pushNotifications'
import NotificationBell from '../ui/NotificationBell'
import HelpChatWidget from '../ui/HelpChatWidget'
import NPSWidget from '../ui/NPSWidget'
import InstallBanner from '../ui/InstallBanner'

const NAV = [
  { to: '/client',                label: 'Dashboard',       icon: LayoutDashboard, end: true },
  { to: '/client/ad-performance', label: 'Ads Performance', icon: TrendingUp },
  { to: '/client/deliverables',   label: 'Deliverables',    icon: FileText },
  { to: '/client/calendar',       label: 'Content Calendar',icon: Calendar },
  { to: '/client/scorecard',      label: 'Growth Scorecard',icon: Award },
  { to: '/client/pulse',          label: 'Weekly Pulse',    icon: Zap },
  { to: '/client/roi',            label: 'ROI Calculator',  icon: Calculator },
  { to: '/client/messages',       label: 'Messages',        icon: MessageSquare },
  { to: '/client/invoices',       label: 'Invoices',        icon: Receipt },
  { to: '/client/billing',        label: 'Billing',         icon: CreditCard },
  { to: '/client/meetings',       label: 'Meetings',        icon: Video },
  { to: '/client/analytics',      label: 'Web Analytics',   icon: BarChart2 },
  { to: '/client/integrations',   label: 'Connect Ads',     icon: Plug },
]

function SidebarContent({ profile, onLogout, onNavClick }) {
  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/[0.06] flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-vc-primary flex items-center justify-center flex-shrink-0">
            <span className="text-white text-sm font-bold font-heading">V</span>
          </div>
          <div>
            <span className="text-text-primary font-semibold text-sm tracking-wide font-heading">VirtueCore</span>
            <p className="text-text-tertiary text-xs mt-0.5">Client Portal</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavClick}
            className={({ isActive }) => `vc-nav-item ${isActive ? 'active' : ''}`}
          >
            <Icon size={18} className="flex-shrink-0" />
            <span>{label}</span>
          </NavLink>
        ))}
        <hr className="vc-divider my-2 mx-3" />
        <NavLink
          to="/client/support"
          onClick={onNavClick}
          className={({ isActive }) => `vc-nav-item ${isActive ? 'active' : ''}`}
        >
          <HelpCircle size={18} className="flex-shrink-0" />
          <span>Support</span>
        </NavLink>
      </nav>

      {/* User */}
      <div className="flex-shrink-0 border-t border-white/[0.06] px-3 py-3">
        <div className="flex items-center gap-2.5 px-3 py-2 mb-1">
          <div className="w-7 h-7 rounded-full bg-vc-primary flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">
              {profile?.full_name?.[0]?.toUpperCase() ?? 'C'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-text-primary text-xs font-medium truncate">{profile?.full_name ?? 'Client'}</p>
            <p className="text-text-tertiary text-xs">Client</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="flex items-center gap-2 w-full px-3 py-2 text-text-secondary hover:text-text-primary text-sm rounded hover:bg-bg-tertiary transition-colors"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </div>
  )
}

export default function ClientLayout() {
  const { profile, logout, isDemo } = useAuth()
  const navigate = useNavigate()
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    if (!isDemo && profile?.id) subscribeToPush(profile.id)
  }, [profile?.id])

  useEffect(() => {
    if (isDemo || !profile?.id || !profile?.client_id) return
    const todayKey = `vc_smart_${new Date().toISOString().split('T')[0]}_${profile.id}`
    if (sessionStorage.getItem(todayKey)) return
    sessionStorage.setItem(todayKey, '1')
    fetch('/api/admin/smart-notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: profile.id, client_id: profile.client_id }),
    }).catch(() => {})
  }, [profile?.id, profile?.client_id])

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

  return (
    <div className="flex h-screen overflow-hidden bg-bg-primary">
      {/* Sidebar — desktop */}
      <aside className="hidden md:flex w-[260px] flex-shrink-0 bg-bg-secondary border-r border-white/[0.06] flex-col">
        <SidebarContent profile={profile} onLogout={handleLogout} onNavClick={() => {}} />
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
        <SidebarContent profile={profile} onLogout={handleLogout} onNavClick={() => setDrawerOpen(false)} />
      </aside>

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
          <div className="hidden md:block" />
          <NotificationBell />
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <Outlet />
        </div>
      </main>

      <HelpChatWidget />
      <NPSWidget />
      <InstallBanner />
    </div>
  )
}
