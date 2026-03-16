import { useState } from 'react'
import { CheckSquare } from 'lucide-react'
import Button from '../../components/ui/Button'

const PAST_STANDUPS = [
  {
    date: '2026-03-14',
    yesterday: 'Completed Google Ads negative keyword update for Prestige. Started on Hartley March creatives.',
    today: 'Continue Hartley creatives. Begin Apex onboarding questionnaire.',
    blockers: 'None.',
  },
  {
    date: '2026-03-13',
    yesterday: 'Reviewed Clearview email brief. Set up new Apex client folder structure.',
    today: 'Write Google Ads negative keywords for Prestige. Review March campaign briefs.',
    blockers: 'Waiting on Hartley brand assets from Samuel.',
  },
]

export default function Standup() {
  const today = '2026-03-16'
  const alreadySubmitted = false

  const [form, setForm] = useState({ yesterday: '', today: '', blockers: '' })
  const [submitted, setSubmitted] = useState(alreadySubmitted)

  function submit(e) {
    e.preventDefault()
    if (!form.yesterday.trim() || !form.today.trim()) return
    setSubmitted(true)
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-vc-text">Daily Standup</h1>
        <p className="text-sm text-vc-muted mt-0.5">{today}</p>
      </div>

      {/* Today's form */}
      <div className="border border-vc-border p-5">
        <h2 className="text-sm font-medium text-vc-text mb-4">Today's Update</h2>

        {submitted ? (
          <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 border border-green-200 px-4 py-3">
            <CheckSquare size={16} />
            Standup submitted for {today}
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {[
              { key: 'yesterday', label: 'What did you complete yesterday?', placeholder: 'Tasks completed, milestones reached...' },
              { key: 'today', label: 'What are you working on today?', placeholder: 'Planned tasks for today...' },
              { key: 'blockers', label: 'Any blockers or questions?', placeholder: 'Leave blank if none...' },
            ].map(({ key, label, placeholder }) => (
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
            <Button type="submit" disabled={!form.yesterday.trim() || !form.today.trim()}>
              Submit standup
            </Button>
          </form>
        )}
      </div>

      {/* History */}
      <div className="border border-vc-border">
        <div className="px-5 py-3 border-b border-vc-border">
          <h2 className="text-sm font-medium text-vc-text">History</h2>
        </div>
        <div className="divide-y divide-vc-border">
          {PAST_STANDUPS.map((s) => (
            <div key={s.date} className="px-5 py-4">
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
                {s.blockers !== 'None.' && (
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
    </div>
  )
}
