import { useState, useEffect } from 'react'
import { Play, Square } from 'lucide-react'
import { DEMO_TASKS } from '../../data/placeholder'

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const WEEK_ENTRIES = [
  { task: 'Design March ad creatives — Meta', client: 'Hartley & Sons Roofing', duration: 90, date: '2026-03-14' },
  { task: 'Build onboarding questionnaire — Apex', client: 'Apex Drainage Solutions', duration: 60, date: '2026-03-14' },
  { task: 'Update Google Ads negative keywords — Prestige', client: 'Prestige Window Cleaning', duration: 45, date: '2026-03-13' },
]

export default function TimeTracker() {
  const [activeTask, setActiveTask] = useState('')
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [entries, setEntries] = useState(WEEK_ENTRIES)

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(id)
  }, [running])

  function start() {
    if (!activeTask) return
    setElapsed(0)
    setRunning(true)
  }

  function stop() {
    setRunning(false)
    if (elapsed > 0) {
      const task = DEMO_TASKS.find((t) => t.id === activeTask)
      setEntries((prev) => [{
        task: task?.title ?? activeTask,
        client: task?.client_name ?? '—',
        duration: Math.round(elapsed / 60),
        date: new Date().toISOString().slice(0, 10),
      }, ...prev])
    }
    setElapsed(0)
  }

  const totalMinutes = entries.reduce((s, e) => s + e.duration, 0)
  const totalHours = (totalMinutes / 60).toFixed(1)

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-vc-text">Time Tracker</h1>
        <p className="text-sm text-vc-muted mt-0.5">{totalHours}h logged this week</p>
      </div>

      {/* Timer */}
      <div className="border border-vc-border p-6">
        <h2 className="text-sm font-medium text-vc-text mb-4">Clock In</h2>
        <div className="flex items-center gap-3 mb-4">
          <select
            value={activeTask}
            onChange={(e) => setActiveTask(e.target.value)}
            disabled={running}
            className="flex-1 border border-vc-border px-3 py-2 text-sm focus:outline-none focus:border-vc-text bg-white disabled:bg-vc-secondary"
          >
            <option value="">Select a task...</option>
            {DEMO_TASKS.filter(t => t.status !== 'complete').map((t) => (
              <option key={t.id} value={t.id}>{t.title}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-3xl font-mono font-semibold text-vc-text tabular-nums">
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
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
            >
              <Square size={14} fill="currentColor" />
              Stop & Save
            </button>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="border border-vc-border p-4">
          <p className="text-xs text-vc-muted">This week</p>
          <p className="text-2xl font-semibold text-vc-text mt-1">{totalHours}h</p>
        </div>
        <div className="border border-vc-border p-4">
          <p className="text-xs text-vc-muted">Total entries</p>
          <p className="text-2xl font-semibold text-vc-text mt-1">{entries.length}</p>
        </div>
        <div className="border border-vc-border p-4">
          <p className="text-xs text-vc-muted">Avg per session</p>
          <p className="text-2xl font-semibold text-vc-text mt-1">
            {entries.length ? Math.round(totalMinutes / entries.length) : 0}m
          </p>
        </div>
      </div>

      {/* Log */}
      <div className="border border-vc-border overflow-x-auto">
        <div className="px-5 py-3 border-b border-vc-border">
          <h2 className="text-sm font-medium text-vc-text">Time Log</h2>
        </div>
        <table className="w-full text-sm min-w-[400px]">
          <thead>
            <tr className="border-b border-vc-border bg-vc-secondary">
              <th className="text-left px-5 py-2.5 text-xs text-vc-muted font-medium">Task</th>
              <th className="text-left px-5 py-2.5 text-xs text-vc-muted font-medium">Client</th>
              <th className="text-left px-5 py-2.5 text-xs text-vc-muted font-medium">Duration</th>
              <th className="text-left px-5 py-2.5 text-xs text-vc-muted font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => (
              <tr key={i} className="border-b border-vc-border last:border-0 hover:bg-vc-secondary transition-colors">
                <td className="px-5 py-3 text-vc-text">{e.task}</td>
                <td className="px-5 py-3 text-vc-muted">{e.client}</td>
                <td className="px-5 py-3 text-vc-text">
                  {e.duration >= 60 ? `${Math.floor(e.duration / 60)}h ${e.duration % 60}m` : `${e.duration}m`}
                </td>
                <td className="px-5 py-3 text-vc-muted">{e.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
