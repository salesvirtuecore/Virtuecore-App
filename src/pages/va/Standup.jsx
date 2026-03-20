import { useState, useEffect } from 'react'
import { CheckSquare } from 'lucide-react'
import Button from '../../components/ui/Button'
import { supabase, isDemoMode } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

const DEMO_HISTORY = [
  {
    id: 'h1',
    date: '2026-03-14',
    yesterday: 'Completed Google Ads negative keyword update for Prestige. Started on Hartley March creatives.',
    today: 'Continue Hartley creatives. Begin Apex onboarding questionnaire.',
    blockers: null,
  },
  {
    id: 'h2',
    date: '2026-03-13',
    yesterday: 'Reviewed Clearview email brief. Set up new Apex client folder structure.',
    today: 'Write Google Ads negative keywords for Prestige. Review March campaign briefs.',
    blockers: 'Waiting on Hartley brand assets from Samuel.',
  },
]

// Stable — date won't change during a session
const TODAY = new Date().toISOString().slice(0, 10)

const FIELDS = [
  { key: 'yesterday', label: 'What did you complete yesterday?', placeholder: 'Tasks completed, milestones reached...' },
  { key: 'today', label: 'What are you working on today?', placeholder: 'Planned tasks for today...' },
  { key: 'blockers', label: 'Any blockers or questions?', placeholder: 'Leave blank if none...' },
]

export default function Standup() {
  const { profile } = useAuth()

  const [history, setHistory] = useState(isDemoMode ? DEMO_HISTORY : [])
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(!isDemoMode)
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [form, setForm] = useState({ yesterday: '', today: '', blockers: '' })

  useEffect(() => {
    if (isDemoMode || !supabase || !profile?.id) return

    setLoading(true)
    supabase
      .from('standups')
      .select('*')
      .eq('va_id', profile.id)
      .order('date', { ascending: false })
      .limit(14)
      .then(({ data }) => {
        if (data) {
          setHistory(data)
          const todaysEntry = data.find((s) => s.date === TODAY)
          if (todaysEntry) {
            setSubmitted(true)
            setForm({
              yesterday: todaysEntry.yesterday,
              today: todaysEntry.today,
              blockers: todaysEntry.blockers ?? '',
            })
          }
        }
        setLoading(false)
      })
  }, [profile?.id])

  async function submit(e) {
    e.preventDefault()
    if (!form.yesterday.trim() || !form.today.trim()) return

    if (isDemoMode) {
      setSubmitted(true)
      return
    }

    setSubmitError('')
    setSaving(true)
    try {
      const { data, error } = await supabase
        .from('standups')
        .upsert(
          {
            va_id: profile.id,
            date: TODAY,
            yesterday: form.yesterday.trim(),
            today: form.today.trim(),
            blockers: form.blockers.trim() || null,
          },
          { onConflict: 'va_id,date' }
        )
        .select()
        .single()

      if (error) throw error

      setSubmitted(true)
      setHistory((prev) => [data, ...prev.filter((s) => s.date !== TODAY)])
    } catch (err) {
      setSubmitError(err.message ?? 'Failed to submit standup. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold text-vc-text mb-4">Daily Standup</h1>
        <p className="text-sm text-vc-muted">Loading...</p>
      </div>
    )
  }

  const pastEntries = history.filter((s) => s.date !== TODAY)

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-vc-text">Daily Standup</h1>
        <p className="text-sm text-vc-muted mt-0.5">{TODAY}</p>
      </div>

      {/* Today's form */}
      <div className="border border-vc-border p-5">
        <h2 className="text-sm font-medium text-vc-text mb-4">Today's Update</h2>

        {submitted ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 border border-green-200 px-4 py-3">
              <CheckSquare size={16} />
              Standup submitted for {TODAY}
            </div>
            <button
              onClick={() => setSubmitted(false)}
              className="text-xs text-vc-muted hover:text-vc-text transition-colors"
            >
              Edit submission
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {FIELDS.map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-vc-text mb-1.5">{label}</label>
                <textarea
                  value={form[key]}
                  onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                  placeholder={placeholder}
                  rows={3}
                  className="w-full border border-vc-border px-3 py-2 text-sm focus:outline-none focus:border-vc-text resize-none"
                />
              </div>
            ))}
            {submitError && <p className="text-xs text-red-500">{submitError}</p>}
            <Button type="submit" disabled={!form.yesterday.trim() || !form.today.trim() || saving}>
              {saving ? 'Submitting...' : 'Submit standup'}
            </Button>
          </form>
        )}
      </div>

      {/* History */}
      {pastEntries.length > 0 && (
        <div className="border border-vc-border">
          <div className="px-5 py-3 border-b border-vc-border">
            <h2 className="text-sm font-medium text-vc-text">History</h2>
          </div>
          <div className="divide-y divide-vc-border">
            {pastEntries.map((s) => (
              <div key={s.id} className="px-5 py-4">
                <p className="text-xs font-medium text-vc-muted mb-3">{s.date}</p>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-vc-muted mb-0.5">Yesterday</p>
                    <p className="text-sm text-vc-text">{s.yesterday}</p>
                  </div>
                  <div>
                    <p className="text-xs text-vc-muted mb-0.5">Today</p>
                    <p className="text-sm text-vc-text">{s.today}</p>
                  </div>
                  {s.blockers && (
                    <div>
                      <p className="text-xs text-vc-muted mb-0.5">Blockers</p>
                      <p className="text-sm text-red-600">{s.blockers}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
