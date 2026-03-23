import { useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LayoutDashboard, FileText, Calendar, MessageSquare, Receipt, Video, CreditCard, BarChart2, Plug, LogOut, TrendingUp, Award, Zap, Calculator } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { isDemoMode } from '../../lib/supabase'
import { subscribeToPush } from '../../lib/pushNotifications'
import NotificationBell from '../ui/NotificationBell'
import HelpChatWidget from '../ui/HelpChatWidget'
import NPSWidget from '../ui/NPSWidget'

const NAV = [
  { to: '/client', label: 'Dashboard', short: 'Home', icon: LayoutDashboard, end: true },
  { to: '/client/deliverables', label: 'Deliverables', short: 'Files', icon: FileText },
  { to: '/client/calendar', label: 'Content Calendar', short: 'Calendar', icon: Calendar },
  { to: '/client/messages', label: 'Messages', short: 'Messages', icon: MessageSquare },
  { to: '/client/ad-performance', label: 'Ad Performance', short: 'Ads', icon: TrendingUp, sidebarOnly: true },
  { to: '/client/scorecard', label: 'Growth Scorecard', short: 'Growth', icon: Award, sidebarOnly: true },
  { to: '/client/pulse', label: 'Weekly Pulse', short: 'Pulse', icon: Zap, sidebarOnly: true },
  { to: '/client/roi', label: 'ROI Calculator', short: 'ROI', icon: Calculator, sidebarOnly: true },
  { to: '/client/invoices', label: 'Invoices', short: 'Invoices', icon: Receipt, sidebarOnly: true },
  { to: '/client/billing', label: 'Billing', short: 'Billing', icon: CreditCard, sidebarOnly: true },
  { to: '/client/meetings', label: 'Meetings', short: 'Meetings', icon: Video, sidebarOnly: true },
  { to: '/client/analytics', label: 'Web Analytics', short: 'Analytics', icon: BarChart2, sidebarOnly: true },
  { to: '/client/integrations', label: 'Connect', short: 'Connect', icon: Plug, sidebarOnly: true },
]

export default function ClientLayout() {
  const { profile, logout } = useAuth()
  const navigate = useNavigate()

  // Register push subscription as soon as the client is logged in
  useEffect(() => {
    if (!isDemoMode && profile?.id) {
      subscribeToPush(profile.id)
    }
  }, [profile?.id])

  // Trigger smart notifications check once per day
  useEffect(() => {
    if (isDemoMode || !profile?.id || !profile?.client_id) return
    const todayKey = `vc_smart_${new Date().toISOString().split('T')[0]}_${profile.id}`
    if (sessionStorage.getItem(todayKey)) return
    sessionStorage.setItem(todayKey, '1')
    fetch('/api/admin/smart-notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: profile.id, client_id: profile.client_id }),
    }).catch(() => {})
  }, [profile?.id, profile?.client_id])

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      {/* Sidebar - desktop only */}
      <aside className="hidden md:flex w-56 flex-shrink-0 bg-vc-sidebar flex-col">
        <div className="px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gold flex items-center justify-center">
              <span className="text-white text-sm font-bold">V</span>
            </div>
            <span className="text-white font-semibold text-sm tracking-wide">VirtueCore</span>
          </div>
          <p className="text-white/40 text-xs mt-1">Client Portal</p>
        </div>

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

        <div className="px-3 py-4 border-t border-white/10">
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="w-7 h-7 rounded-full bg-gold/80 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">
                {profile?.full_name?.[0] ?? 'C'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-medium truncate">{profile?.full_name ?? 'Client'}</p>
              <p className="text-white/40 text-xs">Client</p>
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

        <div className="flex-1 overflow-y-auto overflow-x-hidden pb-16 md:pb-0">
          <Outlet />
        </div>
      </main>

      {/* Bottom nav - mobile only */}
      <nav className="fixed bottom-0 left-0 right-0 md:hidden bg-vc-sidebar border-t border-white/10 flex z-50 safe-area-pb">
        {NAV.filter((item) => !item.sidebarOnly).map(({ to, short, icon: Icon, end }) => (
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
            <Icon size={18} />
            <span className="text-[8px] leading-tight text-center">{short}</span>
          </NavLink>
        ))}
      </nav>

      <HelpChatWidget />
      <NPSWidget />
    </div>
  )
}
