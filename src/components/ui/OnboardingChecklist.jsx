import { useEffect, useState } from 'react'
import { Check, X, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase, isDemoMode } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

const STEPS = [
  { id: 'account', label: 'Create your account', required: true, auto: true },
  { id: 'message', label: 'Send your first message', required: true, link: '/client/messages' },
  { id: 'deliverable', label: 'Review your first deliverable', required: true, link: '/client/deliverables' },
  { id: 'stripe', label: 'Connect Stripe billing', required: false, link: '/client/billing' },
  { id: 'call', label: 'Book a discovery call', required: false, external: true },
]

export default function OnboardingChecklist({ calendlyUrl }) {
  const { profile } = useAuth()
  const [completed, setCompleted] = useState({ account: true })
  const [dismissed, setDismissed] = useState(false)

  const storageKey = `vc_onboarding_${profile?.id}`

  useEffect(() => {
    if (!profile?.id) return
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (parsed.dismissed) { setDismissed(true); return }
        setCompleted((prev) => ({ ...prev, ...parsed.completed }))
      } catch {}
    }
  }, [profile?.id])

  useEffect(() => {
    if (isDemoMode || !profile?.client_id) return

    // Check stripe
    supabase.from('clients').select('stripe_account_id').eq('id', profile.client_id).maybeSingle()
      .then(({ data }) => {
        if (data?.stripe_account_id) mark('stripe')
      })

    // Check message sent
    supabase.from('messages').select('id', { count: 'exact', head: true })
      .eq('client_id', profile.client_id).eq('sender_role', 'client')
      .then(({ count }) => { if (count > 0) mark('message') })

    // Check deliverable viewed
    supabase.from('deliverables').select('id', { count: 'exact', head: true })
      .eq('client_id', profile.client_id)
      .then(({ count }) => { if (count > 0) mark('deliverable') })
  }, [profile?.client_id])

  function mark(id) {
    setCompleted((prev) => {
      const next = { ...prev, [id]: true }
      localStorage.setItem(storageKey, JSON.stringify({ completed: next }))
      return next
    })
  }

  function dismiss() {
    localStorage.setItem(storageKey, JSON.stringify({ dismissed: true }))
    setDismissed(true)
  }

  if (dismissed) return null

  const requiredSteps = STEPS.filter((s) => s.required)
  const allRequiredDone = requiredSteps.every((s) => completed[s.id])
  if (allRequiredDone) return null

  const doneCount = STEPS.filter((s) => completed[s.id]).length
  const pct = Math.round((doneCount / STEPS.length) * 100)

  return (
    <div className="border border-gold/40 bg-amber-50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-vc-text">Get started with VirtueCore</p>
          <p className="text-xs text-vc-muted mt-0.5">{doneCount} of {STEPS.length} steps complete</p>
        </div>
        <button onClick={dismiss} className="text-vc-muted hover:text-vc-text transition-colors">
          <X size={14} />
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-white border border-vc-border rounded-full overflow-hidden">
        <div className="h-full bg-gold transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>

      <div className="space-y-2">
        {STEPS.map((step) => {
          const done = completed[step.id]
          return (
            <div key={step.id} className="flex items-center gap-3">
              <div className={`w-4 h-4 flex-shrink-0 flex items-center justify-center border ${done ? 'bg-green-500 border-green-500' : 'border-vc-border bg-white'}`}>
                {done && <Check size={10} className="text-white" strokeWidth={3} />}
              </div>
              <span className={`text-xs flex-1 ${done ? 'line-through text-vc-muted' : 'text-vc-text'}`}>
                {step.label}
                {!step.required && <span className="ml-1 text-vc-muted">(optional)</span>}
              </span>
              {!done && step.link && (
                <Link to={step.link} className="text-xs text-gold hover:underline flex items-center gap-1">
                  Go <ExternalLink size={10} />
                </Link>
              )}
              {!done && step.external && calendlyUrl && (
                <a href={calendlyUrl} target="_blank" rel="noreferrer" className="text-xs text-gold hover:underline flex items-center gap-1">
                  Book <ExternalLink size={10} />
                </a>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
