import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'

// Layouts
import AdminLayout from './components/layouts/AdminLayout'
import ClientLayout from './components/layouts/ClientLayout'
import VALayout from './components/layouts/VALayout'

// Auth
import Login from './pages/auth/Login'
import ForgotPassword from './pages/auth/ForgotPassword'
import AcceptInvite from './pages/auth/AcceptInvite'
import Signup from './pages/auth/Signup'

// Admin
import AdminDashboard from './pages/admin/Dashboard'
import Clients from './pages/admin/Clients'
import ClientView from './pages/admin/ClientView'
import Pipeline from './pages/admin/Pipeline'
import VAManagement from './pages/admin/VAManagement'
import Revenue from './pages/admin/Revenue'
import Webhooks from './pages/admin/Webhooks'

// Client
import ClientDashboard from './pages/client/Dashboard'
import Deliverables from './pages/client/Deliverables'
import ContentCalendar from './pages/client/ContentCalendar'
import Messages from './pages/client/Messages'
import Invoices from './pages/client/Invoices'
import Billing from './pages/client/Billing'
import Meetings from './pages/client/Meetings'

// VA
import TaskBoard from './pages/va/TaskBoard'
import TimeTracker from './pages/va/TimeTracker'
import Academy from './pages/va/Academy'
import SOPs from './pages/va/SOPs'
import Standup from './pages/va/Standup'

// Guard component — redirects based on auth state and role
function RoleGate({ allowedRole, children }) {
  const { profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-vc-border border-t-gold rounded-full animate-spin" />
      </div>
    )
  }

  if (!profile) return <Navigate to="/login" replace />
  if (profile.role !== allowedRole) {
    // Redirect to their correct portal
    const routes = { admin: '/admin', client: '/client', va: '/va' }
    return <Navigate to={routes[profile.role] ?? '/login'} replace />
  }

  return children
}

// Public route — redirects authenticated users to their portal
function PublicRoute({ children }) {
  const { profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-vc-border border-t-gold rounded-full animate-spin" />
      </div>
    )
  }

  if (profile) {
    const routes = { admin: '/admin', client: '/client', va: '/va' }
    return <Navigate to={routes[profile.role] ?? '/login'} replace />
  }

  return children
}

function AppRoutes() {
  return (
    <Routes>
      {/* Root redirect */}
      <Route path="/" element={<RootRedirect />} />

      {/* Public */}
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
      <Route path="/accept-invite" element={<AcceptInvite />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/preview/client-dashboard" element={<ClientDashboard />} />

      {/* Admin */}
      <Route path="/admin" element={<RoleGate allowedRole="admin"><AdminLayout /></RoleGate>}>
        <Route index element={<AdminDashboard />} />
        <Route path="clients" element={<Clients />} />
        <Route path="clients/:id" element={<ClientView />} />
        <Route path="pipeline" element={<Pipeline />} />
        <Route path="vas" element={<VAManagement />} />
        <Route path="revenue" element={<Revenue />} />
        <Route path="webhooks" element={<Webhooks />} />
      </Route>

      {/* Client */}
      <Route path="/client" element={<RoleGate allowedRole="client"><ClientLayout /></RoleGate>}>
        <Route index element={<ClientDashboard />} />
        <Route path="deliverables" element={<Deliverables />} />
        <Route path="calendar" element={<ContentCalendar />} />
        <Route path="messages" element={<Messages />} />
        <Route path="invoices" element={<Invoices />} />
        <Route path="billing" element={<Billing />} />
        <Route path="meetings" element={<Meetings />} />
      </Route>

      {/* VA */}
      <Route path="/va" element={<RoleGate allowedRole="va"><VALayout /></RoleGate>}>
        <Route index element={<TaskBoard />} />
        <Route path="time" element={<TimeTracker />} />
        <Route path="academy" element={<Academy />} />
        <Route path="sops" element={<SOPs />} />
        <Route path="standup" element={<Standup />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function RootRedirect() {
  const { profile, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-vc-border border-t-gold rounded-full animate-spin" />
    </div>
  )
  if (!profile) return <Navigate to="/login" replace />
  const routes = { admin: '/admin', client: '/client', va: '/va' }
  return <Navigate to={routes[profile.role] ?? '/login'} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
