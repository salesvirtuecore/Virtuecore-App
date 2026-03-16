import Badge from '../../components/ui/Badge'
import { DEMO_VAS, DEMO_TASKS, DEMO_VA_TRAINING } from '../../data/placeholder'

export default function VAManagement() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-vc-text">VA Management</h1>
        <p className="text-sm text-vc-muted mt-0.5">{DEMO_VAS.length} virtual assistants</p>
      </div>

      {/* VA Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {DEMO_VAS.map((va) => (
          <div key={va.id} className="border border-vc-border p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 bg-vc-text flex items-center justify-center flex-shrink-0">
                <span className="text-gold font-semibold text-sm">{va.full_name[0]}</span>
              </div>
              <div>
                <p className="font-medium text-vc-text">{va.full_name}</p>
                <p className="text-xs text-vc-muted">{va.email}</p>
              </div>
              <Badge variant="green" size="xs" className="ml-auto">Active</Badge>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-vc-secondary p-3">
                <p className="text-xs text-vc-muted">Tasks This Week</p>
                <p className="text-lg font-semibold text-vc-text mt-0.5">
                  {va.tasks_completed_this_week}<span className="text-vc-muted text-sm font-normal">/{va.tasks_assigned}</span>
                </p>
              </div>
              <div className="bg-vc-secondary p-3">
                <p className="text-xs text-vc-muted">Hours Logged</p>
                <p className="text-lg font-semibold text-vc-text mt-0.5">{va.hours_this_week}h</p>
              </div>
              <div className="bg-vc-secondary p-3">
                <p className="text-xs text-vc-muted">Performance Score</p>
                <p className={`text-lg font-semibold mt-0.5 ${va.performance_score >= 90 ? 'text-green-600' : va.performance_score >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
                  {va.performance_score}
                </p>
              </div>
              <div className="bg-vc-secondary p-3">
                <p className="text-xs text-vc-muted">Training Complete</p>
                <p className="text-lg font-semibold text-vc-text mt-0.5">{va.training_completion}%</p>
              </div>
            </div>

            {/* Training progress */}
            {(() => {
              const training = DEMO_VA_TRAINING[va.id]
              return (
                <div className="space-y-2">
                  <div>
                    <div className="flex justify-between text-xs text-vc-muted mb-1">
                      <span>Training progress</span>
                      <span>{training ? `${training.modules_completed}/${training.modules_total} modules` : `${va.training_completion}%`}</span>
                    </div>
                    <div className="h-1.5 bg-vc-border">
                      <div className="h-full bg-gold transition-all" style={{ width: `${va.training_completion}%` }} />
                    </div>
                  </div>
                  {training && (
                    <div className="flex items-center justify-between text-xs text-vc-muted pt-1">
                      <span>Avg. quiz score</span>
                      <span className={`font-medium ${training.avg_score >= 80 ? 'text-green-600' : training.avg_score >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                        {training.avg_score}%
                      </span>
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        ))}
      </div>

      {/* All Tasks */}
      <div className="border border-vc-border">
        <div className="px-5 py-3 border-b border-vc-border">
          <h2 className="text-sm font-medium text-vc-text">Current Task Queue</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-vc-border bg-vc-secondary">
              <th className="text-left px-5 py-2.5 text-xs text-vc-muted font-medium">Task</th>
              <th className="text-left px-5 py-2.5 text-xs text-vc-muted font-medium">Client</th>
              <th className="text-left px-5 py-2.5 text-xs text-vc-muted font-medium">Assigned VA</th>
              <th className="text-left px-5 py-2.5 text-xs text-vc-muted font-medium">Priority</th>
              <th className="text-left px-5 py-2.5 text-xs text-vc-muted font-medium">Deadline</th>
              <th className="text-left px-5 py-2.5 text-xs text-vc-muted font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {DEMO_TASKS.map((t) => {
              const vaName = DEMO_VAS.find(v => v.id === t.assigned_va_id)?.full_name ?? '—'
              const priorityVariant = { urgent: 'red', high: 'amber', medium: 'blue', low: 'default' }
              const statusVariant = { complete: 'green', in_progress: 'blue', not_started: 'default' }
              const statusLabel = { complete: 'Complete', in_progress: 'In Progress', not_started: 'Not Started' }
              return (
                <tr key={t.id} className="border-b border-vc-border last:border-0 hover:bg-vc-secondary transition-colors">
                  <td className="px-5 py-3 font-medium text-vc-text">{t.title}</td>
                  <td className="px-5 py-3 text-vc-muted">{t.client_name}</td>
                  <td className="px-5 py-3 text-vc-muted">{vaName}</td>
                  <td className="px-5 py-3">
                    <Badge variant={priorityVariant[t.priority]}>{t.priority.charAt(0).toUpperCase() + t.priority.slice(1)}</Badge>
                  </td>
                  <td className="px-5 py-3 text-vc-muted">{t.deadline}</td>
                  <td className="px-5 py-3">
                    <Badge variant={statusVariant[t.status]}>{statusLabel[t.status]}</Badge>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
