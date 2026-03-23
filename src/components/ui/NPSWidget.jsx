import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { isDemoMode } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

function getMonthKey(userId) {
  const now = new Date()
  return `vc_nps_${userId}_${now.getFullYear()}-${now.getMonth() + 1}`
}

const SCORE_COLOR = (s) => {
  if (s <= 6) return 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200'
  if (s <= 8) return 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200'
  return 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200'
}
const SCORE_COLOR_ACTIVE = (s) => {
  if (s <= 6) return 'bg-red-500 text-white border-red-500'
  if (s <= 8) return 'bg-amber-400 text-white border-amber-400'
  return 'bg-green-500 text-white border-green-500'
}

export default function NPSWidget() {
  const { profile } = useAuth()
  const [visible, setVisible] = useState(false)
  const [score, setScore] = useState(null)
  const [comment, setComment] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!profile?.id || isDemoMode) return
    // Only show for client role
    if (profile.role !== 'client') return
    const key = getMonthKey(profile.id)
    if (localStorage.getItem(key)) return
    // Delay 8 seconds so it doesn't interrupt page load
    const timer = setTimeout(() => setVisible(true), 8000)
    return () => clearTimeout(timer)
  }, [profile?.id])

  function dismiss() {
    if (profile?.id) localStorage.setItem(getMonthKey(profile.id), 'skipped')
    setVisible(false)
  }

  async function handleSubmit() {
    if (!score) return
    setSubmitting(true)
    try {
      await fetch('/api/admin/save-nps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: profile.id,
          client_id: profile.client_id ?? null,
          score,
          comment: comment.trim() || null,
        }),
      })
      if (profile?.id) localStorage.setItem(getMonthKey(profile.id), `${score}`)
      setSubmitted(true)
    } catch {
      // fail silently — always mark as done
      if (profile?.id) localStorage.setItem(getMonthKey(profile.id), `${score}`)
      setSubmitted(true)
    } finally {
      setSubmitting(false)
    }
    setTimeout(() => setVisible(false), 2500)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-[60] w-[calc(100vw-2rem)] max-w-sm">
      <div className="bg-white border border-vc-border shadow-xl p-5 animate-in slide-in-from-bottom-4 duration-300">
        {submitted ? (
          <div className="text-center py-2">
            <p className="text-2xl mb-2">🎉</p>
            <p className="text-sm font-semibold text-vc-text">Thanks for your feedback!</p>
            <p className="text-xs text-vc-muted mt-1">
              {score >= 9 ? "We're thrilled you're happy — we'll keep pushing." : score >= 7 ? "Noted — we'll keep working to improve." : "Thank you for being honest. We'll reach out soon."}
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-2 mb-4">
              <div>
                <p className="text-sm font-semibold text-vc-text">How are we doing?</p>
                <p className="text-xs text-vc-muted mt-0.5">Monthly pulse check — takes 20 seconds</p>
              </div>
              <button onClick={dismiss} className="text-vc-muted hover:text-vc-text transition-colors flex-shrink-0 mt-0.5">
                <X size={14} />
              </button>
            </div>

            {/* Score buttons */}
            <div className="mb-1">
              <p className="text-xs text-vc-muted mb-2">How likely are you to recommend VirtueCore? (1–10)</p>
              <div className="grid grid-cols-10 gap-1">
                {[1,2,3,4,5,6,7,8,9,10].map((s) => (
                  <button
                    key={s}
                    onClick={() => setScore(s)}
                    className={`h-8 text-xs font-bold border rounded-sm transition-colors ${
                      score === s ? SCORE_COLOR_ACTIVE(s) : SCORE_COLOR(s)
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-vc-muted mt-1">
                <span>Not likely</span>
                <span>Very likely</span>
              </div>
            </div>

            {/* Comment */}
            {score !== null && (
              <div className="mt-3">
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Optional: what could we do better? (or what's working well)"
                  rows={2}
                  className="w-full border border-vc-border px-3 py-2 text-xs focus:outline-none focus:border-vc-text resize-none"
                />
              </div>
            )}

            <div className="flex gap-2 mt-3">
              <button
                onClick={handleSubmit}
                disabled={!score || submitting}
                className="flex-1 bg-gold hover:bg-amber-600 text-white text-xs py-2 font-medium disabled:opacity-40 transition-colors"
              >
                {submitting ? 'Sending…' : 'Submit feedback'}
              </button>
              <button
                onClick={dismiss}
                className="text-xs text-vc-muted hover:text-vc-text border border-vc-border px-3 py-2 transition-colors"
              >
                Not now
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
