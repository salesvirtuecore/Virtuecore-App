import { useState } from 'react'
import { Clock } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import { DEMO_TASKS } from '../../data/placeholder'

const STATUS_CYCLE = ['not_started', 'in_progress', 'complete']
const STATUS_LABEL = { not_started: 'Not Started', in_progress: 'In Progress', complete: 'Complete' }
const STATUS_BADGE = { not_started: 'default', in_progress: 'blue', complete: 'green' }
const PRIORITY_BADGE = { urgent: 'red', high: 'amber', medium: 'blue', low: 'default' }

export default function TaskBoard() {
  const [tasks, setTasks] = useState(DEMO_TASKS)
  const [expanded, setExpanded] = useState(null)

  function cycleStatus(id) {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t
        const idx = STATUS_CYCLE.indexOf(t.status)
        const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length]
        return { ...t, status: next }
      })
    )
  }

  const byStatus = {
    not_started: tasks.filter((t) => t.status === 'not_started'),
    in_progress: tasks.filter((t) => t.status === 'in_progress'),
    complete: tasks.filter((t) => t.status === 'complete'),
  }

  function TaskCard({ task }) {
    const isExpanded = expanded === task.id
    return (
      <div className="bg-white border border-vc-border">
        <div
          className="p-4 cursor-pointer hover:bg-vc-secondary transition-colors"
          onClick={() => setExpanded(isExpanded ? null : task.id)}
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <p className="text-sm font-medium text-vc-text flex-1">{task.title}</p>
            <Badge variant={PRIORITY_BADGE[task.priority]} size="xs">
              {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
            </Badge>
          </div>
          <p className="text-xs text-vc-muted mb-2">{task.client_name}</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-xs text-vc-muted">
              <Clock size={11} />
              <span>Due {task.deadline}</span>
            </div>
            {task.time_logged_minutes > 0 && (
              <span className="text-xs text-vc-muted">{Math.floor(task.time_logged_minutes / 60)}h {task.time_logged_minutes % 60}m logged</span>
            )}
          </div>
        </div>

        {isExpanded && (
          <div className="px-4 pb-4 border-t border-vc-border pt-3">
            <p className="text-xs text-vc-muted mb-3">{task.brief}</p>
            <button
              onClick={() => cycleStatus(task.id)}
              className="text-xs px-3 py-1.5 bg-vc-text text-white hover:bg-gray-800 transition-colors"
            >
              Mark as: {STATUS_LABEL[STATUS_CYCLE[(STATUS_CYCLE.indexOf(task.status) + 1) % STATUS_CYCLE.length]]}
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-vc-text">Task Board</h1>
          <p className="text-sm text-vc-muted mt-0.5">{tasks.filter(t => t.status !== 'complete').length} open tasks</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {Object.entries(byStatus).map(([status, statusTasks]) => (
          <div key={status}>
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-xs font-medium text-vc-text uppercase tracking-wide">{STATUS_LABEL[status]}</span>
              <span className="text-xs text-vc-muted bg-vc-secondary px-1.5 py-0.5">{statusTasks.length}</span>
            </div>
            <div className="space-y-2">
              {statusTasks.map((t) => <TaskCard key={t.id} task={t} />)}
              {statusTasks.length === 0 && (
                <div className="border border-dashed border-vc-border p-4 text-center text-xs text-vc-muted">
                  No tasks here
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
