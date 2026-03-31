import { useState, useEffect, useRef } from 'react'
import { Play, Square } from 'lucide-react'
import { supabase, isDemoMode } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { DEMO_TASKS } from '../../data/placeholder'

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const DEMO_ENTRIES = [
  { id: '1', task_name: 'Design March ad creatives — Meta', client_name: 'Hartley & Sons Roofing', duration_minutes: 90, started_at: '2026-03-14T09:00:00Z' },
  { id: '2', task_name: 'Build onboarding questionnaire — Apex', client_name: 'Apex Drainage Solutions', duration_minutes: 60, started_at: '2026-03-14T11:00:00Z' },
  { id: '3', task_name: 'Update Google Ads negative keywords — Prestige', client_name: 'Prestige Window Cleaning', duration_minutes: 45, started_at: '2026-03-13T14:00:00Z' },
]

export default function TimeTracker() {
  const { profile } = useAuth()
  const [tasks, setTasks] = useState(isDemoMode ? DEMO_TASKS.filter((t) => t.status !== 'complete') : [])
  const [entries, setEntries] = useState(isDemoMode ? DEMO_ENTRIES : [])
  const [activeTask, setActiveTask] = useState('')
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [saving, setSaving] = useState(false)
  const startedAtRef = useRef(null)

  useEffect(() => {
    if (isDemoMode || !supabase || !profile?.id) return

    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)

    // Both queries are independent — run in parallel
    Promise.all([
      supabase
        .from('tasks')
        .select('id, title, client_id, clients(company_name)')
        .eq('assigned_va_id', profile.id)
        .neq('status', 'complete')
        .order('created_at', { ascending: false }),
      supabase
        .from('va_time_entries')
        .select('*, tasks(title, clients(company_name))')
        .eq('va_id', profile.id)
        .gte('started_at', weekAgo.toISOString())
        .order('started_at', { ascending: false }),
    ]).then(([{ data: taskData }, { data: entryData }]) => {
      if (taskData) setTasks(taskData.map((t) => ({ ...t, client_name: t.clients?.company_name ?? '—' })))
      if (entryData) setEntries(entryData.map((e) => ({
        ...e,
        task_name: e.tasks?.title ?? '—',
        client_name: e.tasks?.clients?.company_name ?? '—',
      })))
    })
  }, [profile?.id])

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(id)
  }, [running])

  function start() {
    if (!activeTask) return
    startedAtRef.current = new Date().toISOString()
    setElapsed(0)
    setRunning(true)
  }

  async function stop() {
    setRunning(false)
    if (elapsed < 60) {
      setElapsed(0)
      return
    }

    const durationMinutes = Math.round(elapsed / 60)
    const startedAt = startedAtRef.current ?? new Date().toISOString()
    const endedAt = new Date().toISOString()

    if (isDemoMode) {
      const task = tasks.find((t) => t.id === activeTask)
      setEntries((prev) => [
        {
          id: `demo-${Date.now()}`,
          task_name: task?.title ?? activeTask,
          client_name: task?.client_name ?? '—',
          duration_minutes: durationMinutes,
          started_at: startedAt,
        },
        ...prev,
      ])
      setElapsed(0)
      return
    }

    setSaving(true)
    try {
      const task = tasks.find((t) => t.id === activeTask)

      // Run insert and time fetch in parallel — they don't depend on each other
      const [{ data, error }, { data: taskRow }] = await Promise.all([
        supabase
          .from('va_time_entries')
          .insert({
            va_id: profile.id,
            task_id: activeTask || null,
            client_id: task?.client_id ?? null,
            started_at: startedAt,
            ended_at: endedAt,
            duration_minutes: durationMinutes,
          })
          .select('*, tasks(title, clients(company_name))')
          .single(),
        activeTask
          ? supabase.from('tasks').select('time_logged_minutes').eq('id', activeTask).single()
          : Promise.resolve({ data: null }),
      ])

      if (error) throw error

      // Update task total with the fetched current value
      if (activeTask) {
        await supabase
          .from('tasks')
          .update({ time_logged_minutes: (taskRow?.time_logged_minutes ?? 0) + durationMinutes })
          .eq('id', activeTask)
      }

      setEntries((prev) => [
        {
          ...data,
          task_name: data.tasks?.title ?? task?.title ?? '—',
          client_name: data.tasks?.clients?.company_name ?? task?.client_name ?? '—',
        },
        ...prev,
      ])
    } catch (err) {
      console.error('Failed to save time entry:', err)
    } finally {
      setSaving(false)
      setElapsed(0)
    }
  }

  const totalMinutes = entries.reduce((s, e) => s + (e.duration_minutes ?? 0), 0)
  const totalHours = (totalMinutes / 60).toFixed(1)

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-h2 font-heading text-text-primary">Time Tracker</h1>
        <p className="text-sm text-text-secondary mt-0.5">{totalHours}h logged this week</p>
      </div>

      {/* Timer */}
      <div className="border border-white/[0.06] p-6">
        <h2 className="text-sm font-medium text-text-primary mb-4">Clock In</h2>
        <div className="flex items-center gap-3 mb-4">
          <select
            value={activeTask}
            onChange={(e) => setActiveTask(e.target.value)}
            disabled={running}
            className="flex-1 border border-white/[0.06] px-3 py-2 text-sm focus:outline-none focus:border-vc-primary bg-bg-elevated disabled:bg-bg-tertiary"
          >
            <option value="">Select a task...</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>{t.title}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-3xl font-mono font-semibold text-text-primary tabular-nums">
            {formatDuration(elapsed)}
          </div>
          {!running ? (
            <button
              onClick={start}
              disabled={!activeTask}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Play size={14} fill="currentColor" />
              Start
            </button>
          ) : (
            <button
              onClick={stop}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-60 transition-colors"
            >
              <Square size={14} fill="currentColor" />
              {saving ? 'Saving...' : 'Stop & Save'}
            </button>
          )}
        </div>
        {running && elapsed < 60 && (
          <p className="text-xs text-text-secondary mt-3">
            Log at least 1 minute before stopping to save an entry.
          </p>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="vc-card">
          <p className="text-xs text-text-secondary">This week</p>
          <p className="text-2xl font-semibold text-text-primary mt-1">{totalHours}h</p>
        </div>
        <div className="vc-card">
          <p className="text-xs text-text-secondary">Total entries</p>
          <p className="text-2xl font-semibold text-text-primary mt-1">{entries.length}</p>
        </div>
        <div className="vc-card">
          <p className="text-xs text-text-secondary">Avg per session</p>
          <p className="text-2xl font-semibold text-text-primary mt-1">
            {entries.length ? Math.round(totalMinutes / entries.length) : 0}m
          </p>
        </div>
      </div>

      {/* Log */}
      <div className="border border-white/[0.06] overflow-x-auto">
        <div className="px-5 py-3 border-b border-white/[0.06]">
          <h2 className="text-sm font-medium text-text-primary">Time Log</h2>
        </div>
        {entries.length === 0 ? (
          <p className="px-5 py-4 text-sm text-text-secondary">No entries this week.</p>
        ) : (
          <table className="w-full text-sm min-w-[400px]">
            <thead>
              <tr className="border-b border-white/[0.06] bg-bg-tertiary">
                <th className="text-left px-5 py-2.5 text-xs text-text-secondary font-medium">Task</th>
                <th className="text-left px-5 py-2.5 text-xs text-text-secondary font-medium">Client</th>
                <th className="text-left px-5 py-2.5 text-xs text-text-secondary font-medium">Duration</th>
                <th className="text-left px-5 py-2.5 text-xs text-text-secondary font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={e.id ?? i} className="border-b border-white/[0.06] last:border-0 hover:bg-bg-tertiary transition-colors">
                  <td className="px-5 py-3 text-text-primary">{e.task_name}</td>
                  <td className="px-5 py-3 text-text-secondary">{e.client_name}</td>
                  <td className="px-5 py-3 text-text-primary">
                    {e.duration_minutes >= 60
                      ? `${Math.floor(e.duration_minutes / 60)}h ${e.duration_minutes % 60}m`
                      : `${e.duration_minutes}m`}
                  </td>
                  <td className="px-5 py-3 text-text-secondary">
                    {e.started_at ? new Date(e.started_at).toLocaleDateString('en-GB') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
