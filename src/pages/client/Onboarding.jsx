import { useEffect, useState } from 'react'
import { CheckCircle, Circle, Upload, Link as LinkIcon } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { supabase } from '../../lib/supabase'
import { apiFetch } from '../../lib/api'
import { uploadClientDocument } from '../../lib/clientUtils'
import { ONBOARDING_STEPS } from '../../data/onboardingSteps'

function embedUrl(url) {
  if (!url) return null
  if (url.includes('youtube.com/watch')) {
    const id = new URL(url).searchParams.get('v')
    return id ? `https://www.youtube.com/embed/${id}` : url
  }
  if (url.includes('youtu.be/')) {
    const id = url.split('youtu.be/')[1]?.split('?')[0]
    return id ? `https://www.youtube.com/embed/${id}` : url
  }
  return url // Loom share links already embed directly
}

export default function Onboarding() {
  const { profile } = useAuth()
  const { showToast } = useToast()
  const [progress, setProgress] = useState({})
  const [loading, setLoading] = useState(true)
  const [docType, setDocType] = useState('file')
  const [file, setFile] = useState(null)
  const [externalLink, setExternalLink] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function loadProgress() {
    setLoading(true)
    try {
      const res = await apiFetch('/api/onboarding/get-progress')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load progress')
      const byStep = {}
      for (const row of data.progress || []) byStep[row.step_id] = row
      setProgress(byStep)
    } catch (err) {
      showToast(err.message || 'Failed to load onboarding progress', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (profile?.client_id) loadProgress()
  }, [profile?.client_id])

  async function toggleStep(stepId, completed) {
    setProgress((prev) => ({ ...prev, [stepId]: { ...prev[stepId], completed } }))
    try {
      const res = await apiFetch('/api/onboarding/mark-step', {
        method: 'POST',
        body: JSON.stringify({ step_id: stepId, completed }),
      })
      if (!res.ok) throw new Error('Failed to save')
    } catch {
      showToast('Could not save progress — please retry', 'error')
      loadProgress()
    }
  }

  async function submitCredentials(e) {
    e.preventDefault()
    if (docType === 'file' && !file) return showToast('Choose a file first', 'error')
    if (docType === 'google_doc_link' && !externalLink.trim()) return showToast('Paste a Google Doc link first', 'error')

    setSubmitting(true)
    try {
      let filePath = null
      if (docType === 'file') {
        filePath = await uploadClientDocument(supabase, profile.client_id, 'credentials', file)
      }
      const res = await apiFetch('/api/onboarding/submit-credentials', {
        method: 'POST',
        body: JSON.stringify({
          doc_type: docType,
          file_path: filePath,
          external_link: docType === 'google_doc_link' ? externalLink.trim() : null,
          notes: notes.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Submit failed')
      showToast('Credentials submitted — thank you!')
      setFile(null)
      setExternalLink('')
      setNotes('')
      loadProgress()
    } catch (err) {
      showToast(err.message || 'Submit failed', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const completedCount = ONBOARDING_STEPS.filter((s) => progress[s.id]?.completed).length

  if (loading) {
    return <div className="p-6 text-sm text-text-secondary">Loading...</div>
  }

  return (
    <div className="p-4 md:p-6 space-y-5 w-full overflow-x-hidden">
      <div>
        <h1 className="text-h2 font-heading text-text-primary">Getting Started</h1>
        <p className="text-sm text-text-secondary mt-0.5">
          Work through these {ONBOARDING_STEPS.length} steps to get everything set up. ({completedCount}/{ONBOARDING_STEPS.length} done)
        </p>
      </div>

      <div className="space-y-4">
        {ONBOARDING_STEPS.map((step) => {
          const done = Boolean(progress[step.id]?.completed)
          const isSubmitStep = step.id === 'submit'
          return (
            <div key={step.id} className={`vc-card ${done ? 'border-status-success/30' : ''}`}>
              <div className="flex items-start gap-3 mb-3">
                {done ? (
                  <CheckCircle size={20} className="text-status-success flex-shrink-0 mt-0.5" />
                ) : (
                  <Circle size={20} className="text-text-tertiary flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-text-primary">Step {step.order}: {step.title}</h3>
                  <p className="text-xs text-text-secondary mt-1 leading-relaxed">{step.description}</p>
                </div>
              </div>

              {step.video_url && (
                <div className="aspect-video rounded overflow-hidden mb-3 bg-bg-tertiary">
                  <iframe
                    src={embedUrl(step.video_url)}
                    title={step.title}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              )}

              {isSubmitStep ? (
                <form onSubmit={submitCredentials} className="space-y-3 ml-7">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setDocType('file')}
                      className={`text-xs px-3 py-1.5 rounded flex items-center gap-1.5 ${docType === 'file' ? 'bg-vc-primary text-white' : 'bg-bg-tertiary text-text-secondary'}`}
                    >
                      <Upload size={12} /> Upload a file
                    </button>
                    <button
                      type="button"
                      onClick={() => setDocType('google_doc_link')}
                      className={`text-xs px-3 py-1.5 rounded flex items-center gap-1.5 ${docType === 'google_doc_link' ? 'bg-vc-primary text-white' : 'bg-bg-tertiary text-text-secondary'}`}
                    >
                      <LinkIcon size={12} /> Paste a Google Doc link
                    </button>
                  </div>
                  {docType === 'file' ? (
                    <input
                      type="file"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                      className="text-xs text-text-secondary w-full"
                    />
                  ) : (
                    <input
                      type="url"
                      value={externalLink}
                      onChange={(e) => setExternalLink(e.target.value)}
                      placeholder="https://docs.google.com/document/..."
                      className="w-full text-sm bg-bg-tertiary border border-white/[0.08] rounded px-3 py-2 text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-vc-primary"
                    />
                  )}
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Anything we should know? (optional)"
                    rows={2}
                    className="w-full text-sm bg-bg-tertiary border border-white/[0.08] rounded px-3 py-2 text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-vc-primary"
                  />
                  <button
                    type="submit"
                    disabled={submitting}
                    className="text-xs px-4 py-2 bg-vc-primary text-white hover:bg-vc-accent rounded transition-colors disabled:opacity-60"
                  >
                    {submitting ? 'Submitting...' : 'Submit credentials'}
                  </button>
                </form>
              ) : (
                !done && (
                  <div className="ml-7">
                    <button
                      onClick={() => toggleStep(step.id, true)}
                      className="text-xs px-4 py-2 border border-vc-primary text-vc-primary hover:bg-vc-primary/10 rounded transition-colors"
                    >
                      Mark as done
                    </button>
                  </div>
                )
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
