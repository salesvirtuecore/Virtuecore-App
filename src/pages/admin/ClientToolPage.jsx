import { useParams, NavLink } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

const TABS = [
  { to: '', label: 'Overview' },
  { to: '/ad-performance', label: 'Ad Performance' },
  { to: '/leads', label: 'Leads' },
  { to: '/scorecard', label: 'Growth Scorecard' },
  { to: '/pulse', label: 'Weekly Pulse' },
  { to: '/roi', label: 'ROI Calculator' },
]

export default function ClientToolPage({ Tool }) {
  const { id } = useParams()

  return (
    <div className="w-full">
      <div className="flex items-center gap-1 px-4 md:px-6 pt-4 border-b border-white/[0.06] overflow-x-auto">
        <NavLink
          to="/admin/clients"
          className="flex items-center gap-1 text-text-secondary hover:text-text-primary text-sm px-2 py-2 mr-1 flex-shrink-0"
        >
          <ArrowLeft size={14} />
        </NavLink>
        {TABS.map(({ to, label }) => (
          <NavLink
            key={label}
            to={`/admin/clients/${id}${to}`}
            end={to === ''}
            className={({ isActive }) =>
              `flex-shrink-0 text-sm px-3 py-2 border-b-2 transition-colors ${
                isActive
                  ? 'border-vc-primary text-text-primary font-medium'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`
            }
          >
            {label}
          </NavLink>
        ))}
      </div>
      <Tool clientId={id} />
    </div>
  )
}
