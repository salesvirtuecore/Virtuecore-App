import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'

// Layouts
import AdminLayout from './components/layouts/AdminLayout'
import ClientLayout from './components/layouts/ClientLayout'
import VALayout from './components/layouts/VALayout'

// Auth
const Login = lazy(() => import('./pages/auth/Login'))
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'))
const AcceptInvite = lazy(() => import('./pages/auth/AcceptInvite'))
const Signup = lazy(() => import('./pages/auth/Signup'))
const SignupVA = lazy(() => import('./pages/auth/SignupVA'))
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword'))

// Admin
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'))
const Clients = lazy(() => import('./pages/admin/Clients'))
const ClientView = lazy(() => import('./pages/admin/ClientView'))
const Pipeline = lazy(() => import('./pages/admin/Pipeline'))
const VAManagement = lazy(() => import('./pages/admin/VAManagement'))
const Revenue = lazy(() => import('./pages/admin/Revenue'))
const WebAnalytics = lazy(() => import('./pages/admin/WebAnalytics'))
const Webhooks = lazy(() => import('./pages/admin/Webhooks'))
const Documents = lazy(() => import('./pages/admin/Documents'))
const MetaMatching = lazy(() => import('./pages/admin/MetaMatching'))

// Client
const ClientDashboard = lazy(() => import('./pages/client/Dashboard'))
const Deliverables = lazy(() => import('./pages/client/Deliverables'))
const ContentCalendar = lazy(() => import('./pages/client/ContentCalendar'))
const Messages = lazy(() => import('./pages/client/Messages'))
const Invoices = lazy(() => import('./pages/client/Invoices'))
const Billing = lazy(() => import('./pages/client/Billing'))
const Meetings = lazy(() => import('./pages/client/Meetings'))
const ClientWebAnalytics = lazy(() => import('./pages/client/WebAnalytics'))
const Integrations = lazy(() => import('./pages/client/Integrations'))
const AdPerformance = lazy(() => import('./pages/client/AdPerformance'))
const GrowthScorecard = lazy(() => import('./pages/client/GrowthScorecard'))
const WeeklyPulse = lazy(() => import('./pages/client/WeeklyPulse'))
const ROICalculator = lazy(() => import('./pages/client/ROICalculator'))
const Onboarding = lazy(() => import('./pages/client/Onboarding'))
const Contracts = lazy(() => import('./pages/client/Contracts'))

// VA
const TaskBoard = lazy(() => import('./pages/va/TaskBoard'))
const TimeTracker = lazy(() => import('./pages/va/TimeTracker'))
const Academy = lazy(() => import('./pages/va/Academy'))
const SOPs = lazy(() => import('./pages/va/SOPs'))
const Standup = lazy(() => import('./pages/va/Standup'))
const VAInvoices = lazy(() => import('./pages/va/Invoices'))

function PageSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-white/[0.08] border-t-vc-primary rounded-full animate-spin" />
    </div>
  )
}

// Guard component — redirects based on auth state and role
function RoleGate({ allowedRole, children }) {
  const { profile, loading } = useAuth()

  if (loading) return <PageSpinner />

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

  if (loading) return <PageSpinner />

  if (profile) {
    const routes = { admin: '/admin', client: '/client', va: '/va' }
    return <Navigate to={routes[profile.role] ?? '/login'} replace />
  }

  return children
}

function AppRoutes() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <Routes>
        {/* Root redirect */}
        <Route path="/" element={<RootRedirect />} />

        {/* Public */}
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
        <Route path="/accept-invite" element={<AcceptInvite />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/signup/va" element={<SignupVA />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/preview/ad-feed" element={<AdPerformance />} />
        <Route path="/preview/scorecard" element={<GrowthScorecard />} />
        <Route path="/preview/weekly-pulse" element={<WeeklyPulse />} />
        <Route path="/preview/roi-calculator" element={<ROICalculator />} />
        <Route path="/preview/client-dashboard" element={<ClientDashboard />} />
        <Route path="/preview/client-deliverables" element={<Deliverables />} />
        <Route path="/preview/admin-dashboard" element={<AdminDashboard />} />
        <Route path="/preview/admin-clients" element={<Clients />} />
        <Route path="/preview/admin-revenue" element={<Revenue />} />

        {/* Admin */}
        <Route path="/admin" element={<RoleGate allowedRole="admin"><AdminLayout /></RoleGate>}>
          <Route index element={<AdminDashboard />} />
          <Route path="clients" element={<Clients />} />
          <Route path="clients/:id" element={<ClientView />} />
          <Route path="pipeline" element={<Pipeline />} />
          <Route path="vas" element={<VAManagement />} />
          <Route path="revenue" element={<Revenue />} />
          <Route path="analytics" element={<WebAnalytics />} />
          <Route path="webhooks" element={<Webhooks />} />
          <Route path="documents" element={<Documents />} />
          <Route path="meta-matching" element={<MetaMatching />} />
        </Route>

        {/* Client */}
        <Route path="/client" element={<RoleGate allowedRole="client"><ClientLayout /></RoleGate>}>
          <Route index element={<ClientDashboard />} />
          <Route path="onboarding" element={<Onboarding />} />
          <Route path="contracts" element={<Contracts />} />
          <Route path="deliverables" element={<Deliverables />} />
          <Route path="calendar" element={<ContentCalendar />} />
          <Route path="messages" element={<Messages />} />
          <Route path="invoices" element={<Invoices />} />
          <Route path="billing" element={<Billing />} />
          <Route path="meetings" element={<Meetings />} />
          <Route path="analytics" element={<ClientWebAnalytics />} />
          <Route path="integrations" element={<Integrations />} />
          <Route path="ad-performance" element={<AdPerformance />} />
          <Route path="scorecard" element={<GrowthScorecard />} />
          <Route path="pulse" element={<WeeklyPulse />} />
          <Route path="roi" element={<ROICalculator />} />
        </Route>

        {/* VA */}
        <Route path="/va" element={<RoleGate allowedRole="va"><VALayout /></RoleGate>}>
          <Route index element={<TaskBoard />} />
          <Route path="time" element={<TimeTracker />} />
          <Route path="academy" element={<Academy />} />
          <Route path="sops" element={<SOPs />} />
          <Route path="standup" element={<Standup />} />
          <Route path="invoices" element={<VAInvoices />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

function RootRedirect() {
  const { profile, loading } = useAuth()
  if (loading) return <PageSpinner />
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
