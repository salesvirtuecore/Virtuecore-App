import { useState, useEffect } from 'react'
import { UserPlus, Pencil, ClipboardList } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import InviteModal from '../../components/ui/InviteModal'
import Modal from '../../components/ui/Modal'
import FormField from '../../components/ui/FormField'
import { DEMO_VAS, DEMO_TASKS, DEMO_VA_TRAINING, DEMO_CLIENTS } from '../../data/placeholder'
import { isDemoMode, supabase } from '../../lib/supabase'
import { useToast } from '../../context/ToastContext'
import { sendPushNotification } from '../../lib/pushNotifications'

const EMPTY_TASK_FORM = {
  title: '',
  brief: '',
  client_id: '',
  priority: 'medium',
  deadline: '',
}

const EMPTY_VA_FORM = {
  full_name: '',
}

export default function VAManagement() {
  const [showInvite, setShowInvite] = useState(false)
  const [vas, setVas] = useState(isDemoMode ? DEMO_VAS : [])
  const [tasks, setTasks] = useState(isDemoMode ? DEMO_TASKS : [])
  const [clients, setClients] = useState(isDemoMode ? DEMO_CLIENTS : [])
  const { showToast } = useToast()

  useEffect(() => {
    if (isDemoMode || !supabase) return
    Promise.all([
      supabase.from('profiles').select('id, full_name, email, created_at').eq('role', 'va').order('created_at'),
      supabase.from('tasks').select('*').order('deadline'),
      supabase.from('clients').select('id, company_name').order('company_name'),
    ]).then(([{ data: vaRows }, { data: taskRows }, { data: clientRows }]) => {
      if (vaRows) {
        const now = new Date()
        const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay())
        setVas(vaRows.map((va) => {
          const vaTasks = (taskRows || []).filter((t) => t.assigned_va_id === va.id)
          const weekTasks = vaTasks.filter((t) => t.deadline >= weekStart.toISOString().split('T')[0])
          const completedWeek = weekTasks.filter((t) => t.status === 'complete').length
          const hoursLogged = Math.round(vaTasks.reduce((s, t) => s + (t.time_logged_minutes || 0), 0) / 60 * 10) / 10
          return {
            ...va,
            tasks_assigned: weekTasks.length,
            tasks_completed_this_week: completedWeek,
            hours_this_week: hoursLogged,
            performance_score: weekTasks.length ? Math.round((completedWeek / weekTasks.length) * 100) : 0,
            training_completion: 0,
          }
        }))
      }
      if (taskRows) setTasks(taskRows)
      if (clientRows) setClients(clientRows)
    })
  }, [])

  // Assign Task modal
  const [assignTarget, setAssignTarget] = useState(null) // va being assigned to
  const [taskForm, setTaskForm] = useState(EMPTY_TASK_FORM)
  const [taskErrors, setTaskErrors] = useState({})
  const [savingTask, setSavingTask] = useState(false)

  // Edit VA modal
  const [editVA, setEditVA] = useState(null)
  const [vaForm, setVaForm] = useState(EMPTY_VA_FORM)
  const [vaErrors, setVaErrors] = useState({})
  const [savingVA, setSavingVA] = useState(false)

  // ── Assign Task ──────────────────────────────────────────────────────────────
  function openAssignTask(va) {
    setAssignTarget(va)
    setTaskForm(EMPTY_TASK_FORM)
    setTaskErrors({})
  }

  function validateTask() {
    const e = {}
    if (!taskForm.title.trim()) e.title = 'Title is required'
    if (!taskForm.deadline) e.deadline = 'Deadline is required'
    return e
  }

  async function handleSaveTask() {
    const e = validateTask()
    if (Object.keys(e).length) { setTaskErrors(e); return }
    setSavingTask(true)
    try {
      const client = clients.find((c) => c.id === taskForm.client_id)
      const payload = {
        title: taskForm.title.trim(),
        brief: taskForm.brief.trim(),
        client_id: taskForm.client_id || null,
        client_name: client?.company_name ?? null,
        assigned_va_id: assignTarget.id,
        priority: taskForm.priority,
        deadline: taskForm.deadline,
        status: 'not_started',
        time_logged_minutes: 0,
      }

      if (isDemoMode) {
        const newTask = { ...payload, id: `t-${Date.now()}` }
        setTasks((prev) => [...prev, newTask])
        showToast(`Task assigned to ${assignTarget.full_name}`)
      } else {
        const { data, error } = await supabase.from('tasks').insert(payload).select().single()
        if (error) throw error
        setTasks((prev) => [...prev, data])
        showToast(`Task assigned to ${assignTarget.full_name}`)
        sendPushNotification(assignTarget.id, {
          title: 'New task assigned',
          body: `${payload.title}${payload.client_name ? ` — ${payload.client_name}` : ''}`,
          url: '/va',
        })
      }
      setAssignTarget(null)
    } catch (err) {
      showToast(err.message ?? 'Failed to assign task', 'error')
    } finally {
      setSavingTask(false)
    }
  }

  // ── Edit VA ──────────────────────────────────────────────────────────────────
  function openEditVA(va) {
    setEditVA(va)
    setVaForm({ full_name: va.full_name })
    setVaErrors({})
  }

  function validateVA() {
    const e = {}
    if (!vaForm.full_name.trim()) e.full_name = 'Name is required'
    return e
  }

  async function handleSaveVA() {
    const e = validateVA()
    if (Object.keys(e).length) { setVaErrors(e); return }
    setSavingVA(true)
    try {
      const updates = { full_name: vaForm.full_name.trim() }
      if (isDemoMode) {
        setVas((prev) => prev.map((v) => (v.id === editVA.id ? { ...v, ...updates } : v)))
      } else {
        const { error } = await supabase.from('profiles').update(updates).eq('id', editVA.id)
        if (error) throw error
        setVas((prev) => prev.map((v) => (v.id === editVA.id ? { ...v, ...updates } : v)))
      }
      showToast('VA profile updated')
      setEditVA(null)
    } catch (err) {
      showToast(err.message ?? 'Failed to update VA', 'error')
    } finally {
      setSavingVA(false)
    }
  }

  const inputClass = 'bg-bg-tertiary border border-white/[0.08] rounded-btn px-3 py-2 w-full text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-vc-primary focus:ring-1 focus:ring-vc-primary'
  const selectClass = inputClass
  const textareaClass = `${inputClass} resize-none`

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h2 font-heading text-text-primary">VA Management</h1>
          <p className="text-sm text-text-secondary mt-0.5">{vas.length} virtual assistants</p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="bg-vc-primary hover:bg-vc-accent text-white text-sm px-4 py-2 rounded flex items-center gap-2"
        >
          <UserPlus size={14} />
          Invite VA
        </button>
      </div>

      <InviteModal isOpen={showInvite} onClose={() => setShowInvite(false)} role="va" />

      {/* VA Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {vas.map((va) => (
          <div key={va.id} className="vc-card">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 bg-vc-text flex items-center justify-center flex-shrink-0">
                <span className="text-vc-accent font-semibold text-sm">{va.full_name[0]}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-text-primary">{va.full_name}</p>
                <p className="text-xs text-text-secondary">{va.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="green" size="xs">Active</Badge>
                <button
                  onClick={() => openEditVA(va)}
                  className="text-text-secondary hover:text-text-primary transition-colors"
                  title="Edit VA"
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={() => openAssignTask(va)}
                  className="flex items-center gap-1 text-xs border border-white/[0.06] text-text-secondary hover:text-text-primary px-2 py-1 rounded transition-colors"
                  title="Assign task"
                >
                  <ClipboardList size={12} />
                  Assign Task
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-bg-tertiary p-3">
                <p className="text-xs text-text-secondary">Tasks This Week</p>
                <p className="text-lg font-semibold text-text-primary mt-0.5">
                  {va.tasks_completed_this_week}<span className="text-text-secondary text-sm font-normal">/{va.tasks_assigned}</span>
                </p>
              </div>
              <div className="bg-bg-tertiary p-3">
                <p className="text-xs text-text-secondary">Hours Logged</p>
                <p className="text-lg font-semibold text-text-primary mt-0.5">{va.hours_this_week}h</p>
              </div>
              <div className="bg-bg-tertiary p-3">
                <p className="text-xs text-text-secondary">Performance Score</p>
                <p className={`text-lg font-semibold mt-0.5 ${va.performance_score >= 90 ? 'text-status-success' : va.performance_score >= 70 ? 'text-status-warning' : 'text-status-danger'}`}>
                  {va.performance_score}
                </p>
              </div>
              <div className="bg-bg-tertiary p-3">
                <p className="text-xs text-text-secondary">Training Complete</p>
                <p className="text-lg font-semibold text-text-primary mt-0.5">{va.training_completion}%</p>
              </div>
            </div>

            {/* Training progress */}
            {(() => {
              const training = DEMO_VA_TRAINING[va.id]
              return (
                <div className="space-y-2">
                  <div>
                    <div className="flex justify-between text-xs text-text-secondary mb-1">
                      <span>Training progress</span>
                      <span>{training ? `${training.modules_completed}/${training.modules_total} modules` : `${va.training_completion}%`}</span>
                    </div>
                    <div className="h-1.5 bg-vc-border">
                      <div className="h-full bg-vc-primary transition-all" style={{ width: `${va.training_completion}%` }} />
                    </div>
                  </div>
                  {training && (
                    <div className="flex items-center justify-between text-xs text-text-secondary pt-1">
                      <span>Avg. quiz score</span>
                      <span className={`font-medium ${training.avg_score >= 80 ? 'text-status-success' : training.avg_score >= 60 ? 'text-status-warning' : 'text-status-danger'}`}>
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
      <div className="border border-white/[0.06]">
        <div className="px-5 py-3 border-b border-white/[0.06]">
          <h2 className="text-sm font-medium text-text-primary">Current Task Queue</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] bg-bg-tertiary">
              <th className="text-left px-5 py-2.5 text-xs text-text-secondary font-medium">Task</th>
              <th className="text-left px-5 py-2.5 text-xs text-text-secondary font-medium">Client</th>
              <th className="text-left px-5 py-2.5 text-xs text-text-secondary font-medium">Assigned VA</th>
              <th className="text-left px-5 py-2.5 text-xs text-text-secondary font-medium">Priority</th>
              <th className="text-left px-5 py-2.5 text-xs text-text-secondary font-medium">Deadline</th>
              <th className="text-left px-5 py-2.5 text-xs text-text-secondary font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => {
              const vaName = vas.find((v) => v.id === t.assigned_va_id)?.full_name ?? '—'
              const priorityVariant = { urgent: 'red', high: 'amber', medium: 'blue', low: 'default' }
              const statusVariant = { complete: 'green', in_progress: 'blue', not_started: 'default' }
              const statusLabel = { complete: 'Complete', in_progress: 'In Progress', not_started: 'Not Started' }
              return (
                <tr key={t.id} className="border-b border-white/[0.06] last:border-0 hover:bg-bg-tertiary transition-colors">
                  <td className="px-5 py-3 font-medium text-text-primary">{t.title}</td>
                  <td className="px-5 py-3 text-text-secondary">{t.client_name ?? '—'}</td>
                  <td className="px-5 py-3 text-text-secondary">{vaName}</td>
                  <td className="px-5 py-3">
                    <Badge variant={priorityVariant[t.priority]}>{t.priority.charAt(0).toUpperCase() + t.priority.slice(1)}</Badge>
                  </td>
                  <td className="px-5 py-3 text-text-secondary">{t.deadline}</td>
                  <td className="px-5 py-3">
                    <Badge variant={statusVariant[t.status]}>{statusLabel[t.status]}</Badge>
                  </td>
                </tr>
              )
            })}
            {tasks.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-6 text-center text-sm text-text-secondary">No tasks yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Assign Task Modal ──────────────────────────────────────────────── */}
      <Modal
        isOpen={!!assignTarget}
        onClose={() => setAssignTarget(null)}
        title={assignTarget ? `Assign Task — ${assignTarget.full_name}` : 'Assign Task'}
        size="md"
      >
        {assignTarget && (
          <div className="space-y-4">
            <FormField label="Task Title" required error={taskErrors.title}>
              <input
                className={inputClass}
                value={taskForm.title}
                onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                placeholder="e.g. Design March ad creatives"
              />
            </FormField>

            <FormField label="Brief">
              <textarea
                className={textareaClass}
                rows={3}
                value={taskForm.brief}
                onChange={(e) => setTaskForm({ ...taskForm, brief: e.target.value })}
                placeholder="Task description and instructions..."
              />
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Client">
                <select
                  className={selectClass}
                  value={taskForm.client_id}
                  onChange={(e) => setTaskForm({ ...taskForm, client_id: e.target.value })}
                >
                  <option value="">No client</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.company_name}</option>
                  ))}
                </select>
              </FormField>

              <FormField label="Priority" required>
                <select
                  className={selectClass}
                  value={taskForm.priority}
                  onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </FormField>
            </div>

            <FormField label="Deadline" required error={taskErrors.deadline}>
              <input
                type="date"
                className={inputClass}
                value={taskForm.deadline}
                onChange={(e) => setTaskForm({ ...taskForm, deadline: e.target.value })}
              />
            </FormField>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setAssignTarget(null)} className="border border-white/[0.06] text-text-primary text-sm px-4 py-2 rounded hover:bg-bg-tertiary">
                Cancel
              </button>
              <button onClick={handleSaveTask} disabled={savingTask} className="bg-vc-primary hover:bg-vc-accent text-white text-sm px-4 py-2 rounded disabled:opacity-60">
                {savingTask ? 'Assigning…' : 'Assign Task'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Edit VA Modal ──────────────────────────────────────────────────── */}
      <Modal
        isOpen={!!editVA}
        onClose={() => setEditVA(null)}
        title={editVA ? `Edit VA — ${editVA.full_name}` : 'Edit VA'}
        size="sm"
      >
        {editVA && (
          <div className="space-y-4">
            <FormField label="Full Name" required error={vaErrors.full_name}>
              <input
                className={inputClass}
                value={vaForm.full_name}
                onChange={(e) => setVaForm({ ...vaForm, full_name: e.target.value })}
              />
            </FormField>

            <FormField label="Email">
              <input
                className={`${inputClass} bg-bg-tertiary cursor-not-allowed`}
                value={editVA.email}
                readOnly
              />
            </FormField>

            <FormField label="Role">
              <input
                className={`${inputClass} bg-bg-tertiary cursor-not-allowed`}
                value="Virtual Assistant"
                readOnly
              />
            </FormField>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setEditVA(null)} className="border border-white/[0.06] text-text-primary text-sm px-4 py-2 rounded hover:bg-bg-tertiary">
                Cancel
              </button>
              <button onClick={handleSaveVA} disabled={savingVA} className="bg-vc-primary hover:bg-vc-accent text-white text-sm px-4 py-2 rounded disabled:opacity-60">
                {savingVA ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
