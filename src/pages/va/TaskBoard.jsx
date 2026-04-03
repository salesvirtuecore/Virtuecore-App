import { useState, useEffect, useMemo } from 'react'
import { Clock } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { notifySlack } from '../../lib/slackNotify'

const STATUS_CYCLE = ['not_started', 'in_progress', 'complete']
const STATUS_LABEL = { not_started: 'Not Started', in_progress: 'In Progress', complete: 'Complete' }
const STATUS_BADGE = { not_started: 'default', in_progress: 'blue', complete: 'green' }
const PRIORITY_BADGE = { urgent: 'red', high: 'amber', medium: 'blue', low: 'default' }

function TaskCard({ task, expanded, onToggle, onCycleStatus }) {
  const isExpanded = expanded === task.id
  return (
    <div className="bg-bg-elevated border border-white/[0.08]">
      <div
        className="p-4 cursor-pointer hover:bg-bg-tertiary transition-colors"
        onClick={() => onToggle(task.id)}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <p className="text-sm font-medium text-text-primary flex-1">{task.title}</p>
          <Badge variant={PRIORITY_BADGE[task.priority]} size="xs">
            {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
          </Badge>
        </div>
        <p className="text-xs text-text-secondary mb-2">{task.client_name}</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-xs text-text-secondary">
            <Clock size={11} />
            <span>Due {task.deadline ?? 'No date'}</span>
          </div>
          {task.time_logged_minutes > 0 && (
            <span className="text-xs text-text-secondary">
              {Math.floor(task.time_logged_minutes / 60)}h {task.time_logged_minutes % 60}m logged
            </span>
          )}
        </div>
      </div>
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-white/[0.06] pt-3">
          {task.brief && <p className="text-xs text-text-secondary mb-3">{task.brief}</p>}
          <button
            onClick={() => onCycleStatus(task.id)}
            className="text-xs px-3 py-1.5 bg-vc-primary text-white hover:bg-vc-accent transition-colors"
          >
            Mark as: {STATUS_LABEL[STATUS_CYCLE[(STATUS_CYCLE.indexOf(task.status) + 1) % STATUS_CYCLE.length]]}
          </button>
        </div>
      )}
    </div>
  )
}

export default function TaskBoard() {
  const { profile } = useAuth()
  const [tasks, setTasks] = useState([])
  const [expanded, setExpanded] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase || !profile?.id) { setLoading(false); return }

    setLoading(true)
    supabase
      .from('tasks')
      .select('*, clients(company_name)')
      .eq('assigned_va_id', profile.id)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) {
          setTasks(data.map((t) => ({ ...t, client_name: t.clients?.company_name ?? '—' })))
        }
        setLoading(false)
      })
  }, [profile?.id])

  async function cycleStatus(id) {
    const task = tasks.find((t) => t.id === id)
    if (!task) return
    const idx = STATUS_CYCLE.indexOf(task.status)
    const nextStatus = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length]

    // Optimistic update
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: nextStatus } : t)))

    if (supabase) {
      const { error } = await supabase
        .from('tasks')
        .update({
          status: nextStatus,
          ...(nextStatus === 'complete'
            ? { completed_at: new Date().toISOString() }
            : { completed_at: null }),
        })
        .eq('id', id)

      if (error) {
        // Revert on failure
        setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: task.status } : t)))
      } else {
        notifySlack('task_updated', { title: task.title, client_name: task.client_name, status: nextStatus })
      }
    }
  }

  const byStatus = useMemo(() => ({
    not_started: tasks.filter((t) => t.status === 'not_started'),
    in_progress: tasks.filter((t) => t.status === 'in_progress'),
    complete: tasks.filter((t) => t.status === 'complete'),
  }), [tasks])

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-h2 font-heading text-text-primary mb-4">Task Board</h1>
        <p className="text-sm text-text-secondary">Loading tasks...</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-h2 font-heading text-text-primary">Task Board</h1>
        <p className="text-sm text-text-secondary mt-0.5">
          {tasks.filter((t) => t.status !== 'complete').length} open tasks
        </p>
      </div>

      {tasks.length === 0 ? (
        <div className="border border-dashed border-white/[0.06] p-8 text-center text-sm text-text-secondary">
          No tasks assigned to you yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {Object.entries(byStatus).map(([status, statusTasks]) => (
            <div key={status}>
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-xs font-medium text-text-primary uppercase tracking-wide">
                  {STATUS_LABEL[status]}
                </span>
                <span className="text-xs text-text-secondary bg-bg-tertiary px-1.5 py-0.5">
                  {statusTasks.length}
                </span>
              </div>
              <div className="space-y-2">
                {statusTasks.map((t) => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    expanded={expanded}
                    onToggle={(id) => setExpanded((prev) => (prev === id ? null : id))}
                    onCycleStatus={cycleStatus}
                  />
                ))}
                {statusTasks.length === 0 && (
                  <div className="border border-dashed border-white/[0.06] p-4 text-center text-xs text-text-secondary">
                    No tasks here
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
