import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, Zap } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { DEMO_WEEKLY_PULSES } from '../../data/placeholder'
import { format, parseISO, isMonday } from 'date-fns'

function WowBadge({ value, inverted = false }) {
  if (value == null) return <span className="text-xs text-text-secondary">—</span>
  if (value === 0) return <span className="flex items-center gap-0.5 text-xs text-text-secondary"><Minus size={10} /> 0%</span>
  const isGood = inverted ? value < 0 : value > 0
  const Icon = value > 0 ? TrendingUp : TrendingDown
  return (
    <span className={`flex items-center gap-0.5 text-xs font-medium ${isGood ? 'text-status-success' : 'text-status-danger'}`}>
      <Icon size={10} />
      {value > 0 ? '+' : ''}{value}%
    </span>
  )
}

function PulseCard({ pulse, isLatest, expanded, onToggle }) {
  const m = pulse.metrics
  const weekLabel = `${format(parseISO(pulse.week_start), 'd MMM')} – ${format(parseISO(pulse.week_end), 'd MMM yyyy')}`

  return (
    <div className={`border ${isLatest ? 'border-vc-primary/40' : 'border-white/[0.06]'}`}>
      {/* Header */}
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-bg-tertiary transition-colors text-left"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          {isLatest && <span className="w-2 h-2 rounded-full bg-vc-primary animate-pulse flex-shrink-0" />}
          <div>
            <p className="text-sm font-medium text-text-primary">Week of {weekLabel}</p>
            {!expanded && (
              <p className="text-xs text-text-secondary mt-0.5 line-clamp-1">{m.leads} leads · £{m.spend?.toLocaleString()} spend · {m.tasks_completed} tasks</p>
            )}
          </div>
        </div>
        {expanded ? <ChevronUp size={14} className="text-text-secondary flex-shrink-0" /> : <ChevronDown size={14} className="text-text-secondary flex-shrink-0" />}
      </button>

      {expanded && (
        <div className="border-t border-white/[0.06]">
          {/* Summary quote */}
          <div className="px-4 py-4 bg-bg-tertiary border-b border-white/[0.06]">
            <div className="flex gap-2">
              <Zap size={14} className="text-vc-accent flex-shrink-0 mt-0.5" />
              <p className="text-sm text-text-primary leading-relaxed font-medium">{pulse.summary}</p>
            </div>
          </div>

          {/* Metrics grid */}
          <div className="px-4 py-4 grid grid-cols-2 md:grid-cols-4 gap-4 border-b border-white/[0.06]">
            <div>
              <p className="text-xs text-text-secondary mb-1">Leads</p>
              <p className="text-2xl font-bold text-text-primary">{m.leads}</p>
              <WowBadge value={pulse.wow?.leads} />
            </div>
            <div>
              <p className="text-xs text-text-secondary mb-1">Ad Spend</p>
              <p className="text-2xl font-bold text-text-primary">£{m.spend?.toLocaleString()}</p>
              <WowBadge value={pulse.wow?.spend} />
            </div>
            <div>
              <p className="text-xs text-text-secondary mb-1">Cost Per Lead</p>
              <p className="text-2xl font-bold text-text-primary">{m.cpl ? `£${m.cpl}` : '—'}</p>
              <WowBadge value={pulse.wow?.cpl} inverted />
            </div>
            <div>
              <p className="text-xs text-text-secondary mb-1">Pipeline Created</p>
              <p className="text-2xl font-bold text-text-primary">£{m.pipeline_value?.toLocaleString() ?? '—'}</p>
            </div>
          </div>

          {/* Secondary metrics */}
          <div className="px-4 py-3 flex flex-wrap gap-6 border-b border-white/[0.06]">
            <div className="text-xs">
              <span className="text-text-secondary">Messages handled: </span>
              <span className="font-medium text-text-primary">{m.messages}</span>
            </div>
            <div className="text-xs">
              <span className="text-text-secondary">Tasks completed: </span>
              <span className="font-medium text-text-primary">{m.tasks_completed}</span>
            </div>
            <div className="text-xs">
              <span className="text-text-secondary">Deliverables ready: </span>
              <span className="font-medium text-text-primary">{m.deliverables}</span>
            </div>
            {m.automations_triggered > 0 && (
              <div className="text-xs">
                <span className="text-text-secondary">Automations triggered: </span>
                <span className="font-medium text-text-primary">{m.automations_triggered}×</span>
              </div>
            )}
          </div>

          {/* Highlights */}
          {pulse.highlights?.length > 0 && (
            <div className="px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary mb-2">Key highlights</p>
              <ul className="space-y-1.5">
                {pulse.highlights.map((h, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-text-primary">
                    <span className="text-vc-accent font-bold mt-0.5 flex-shrink-0">·</span>
                    {h}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function WeeklyPulse() {
  const { profile, isDemo } = useAuth()
  const { pathname } = useLocation()
  const useDemo = isDemo || pathname.startsWith('/preview/')
  const [pulses, setPulses] = useState(useDemo ? DEMO_WEEKLY_PULSES : [])
  const [loading, setLoading] = useState(!useDemo)
  const [expanded, setExpanded] = useState(new Set([0]))

  useEffect(() => {
    if (useDemo || !supabase || !profile?.client_id) return
    setLoading(true)
    fetch(`/api/admin/weekly-pulse?client_id=${profile.client_id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.this_week) {
          const weekEnd = new Date()
          const weekStart = new Date(weekEnd); weekStart.setDate(weekEnd.getDate() - 7)
          const tw = data.this_week
          setPulses([{
            week_start: weekStart.toISOString().split('T')[0],
            week_end: weekEnd.toISOString().split('T')[0],
            summary: `Last week: ${tw.leads} lead${tw.leads !== 1 ? 's' : ''} generated, ${tw.messages} messages handled, ${tw.deliverables} deliverable${tw.deliverables !== 1 ? 's' : ''} ready, ad spend £${tw.spend?.toLocaleString()}.`,
            metrics: { ...tw, pipeline_value: tw.leads * 750 },
            wow: data.wow,
            highlights: [],
          }])
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [profile?.client_id, useDemo])

  const isNewWeek = isMonday(new Date())

  return (
    <div className="p-4 md:p-6 space-y-5 w-full overflow-x-hidden">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-h2 font-heading text-text-primary">Weekly Pulse</h1>
          {isNewWeek && (
            <span className="text-xs bg-vc-primary text-white px-2 py-0.5 font-medium">New this week</span>
          )}
        </div>
        <p className="text-sm text-text-secondary mt-0.5">Your weekly heartbeat — what happened, what's winning, what's next.</p>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-40">
          <div className="w-5 h-5 border-2 border-white/[0.06] border-t-vc-primary rounded-full animate-spin" />
        </div>
      )}

      {!loading && pulses.length === 0 && (
        <div className="border border-white/[0.06] p-8 text-center">
          <p className="text-sm text-text-secondary">Your weekly pulse will appear here every Monday.</p>
          <p className="text-xs text-text-secondary mt-1">It summarises leads, tasks, ad performance and key highlights from the previous week.</p>
        </div>
      )}

      {!loading && pulses.map((pulse, i) => (
        <PulseCard
          key={pulse.week_start}
          pulse={pulse}
          isLatest={i === 0}
          expanded={expanded.has(i)}
          onToggle={() => setExpanded((prev) => {
            const next = new Set(prev)
            next.has(i) ? next.delete(i) : next.add(i)
            return next
          })}
        />
      ))}
    </div>
  )
}
