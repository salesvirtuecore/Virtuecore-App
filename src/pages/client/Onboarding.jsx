import { useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle, Circle, Upload, Link as LinkIcon, AlertTriangle, ExternalLink, Video, KeyRound, Eye, EyeOff, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { supabase } from '../../lib/supabase'
import { apiFetch } from '../../lib/api'
import { uploadClientDocument } from '../../lib/clientUtils'
import { ONBOARDING_STEPS } from '../../data/onboardingSteps'
import { LOGIN_APPS } from '../../data/loginApps'

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

// With up to 11 steps on one page, mounting every Loom iframe at once on
// load was causing several of them to render blank — too many heavy embeds
// initializing simultaneously. This only mounts the iframe once its card is
// actually scrolled near, so at most a couple load at a time.
function LazyVideo({ src, title }) {
  const containerRef = useRef(null)
  const [shouldLoad, setShouldLoad] = useState(false)

  useEffect(() => {
    if (shouldLoad || !containerRef.current) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setShouldLoad(true)
      },
      { rootMargin: '300px' }
    )
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [shouldLoad])

  return (
    <div ref={containerRef} className="aspect-video rounded overflow-hidden mb-3 bg-bg-tertiary">
      {shouldLoad && (
        <iframe
          src={src}
          title={title}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      )}
    </div>
  )
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
  const [activeStepId, setActiveStepId] = useState(ONBOARDING_STEPS[0].id)
  const [useStructuredLogins, setUseStructuredLogins] = useState(false)

  const isFirstLoad = useRef(true)
  const groupIdRef = useRef(0)

  function newLoginGroup() {
    groupIdRef.current += 1
    return { id: groupIdRef.current, email: '', password: '', apps: [], showPassword: false }
  }
  const [loginGroups, setLoginGroups] = useState(() => [newLoginGroup()])

  function updateLoginGroup(id, patch) {
    setLoginGroups((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)))
  }
  function addLoginGroup() {
    setLoginGroups((prev) => [...prev, newLoginGroup()])
  }
  function removeLoginGroup(id) {
    setLoginGroups((prev) => (prev.length > 1 ? prev.filter((g) => g.id !== id) : prev))
  }
  function toggleAppInGroup(id, app) {
    setLoginGroups((prev) => prev.map((g) => {
      if (g.id !== id) return g
      const has = g.apps.includes(app)
      return { ...g, apps: has ? g.apps.filter((a) => a !== app) : [...g.apps, app] }
    }))
  }

  async function loadProgress() {
    setLoading(true)
    try {
      const res = await apiFetch('/api/onboarding/get-progress')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load progress')
      const byStep = {}
      for (const row of data.progress || []) byStep[row.step_id] = row
      setProgress(byStep)
      if (isFirstLoad.current) {
        isFirstLoad.current = false
        const firstIncomplete = ONBOARDING_STEPS.find((s) => !byStep[s.id]?.completed)
        if (firstIncomplete) setActiveStepId(firstIncomplete.id)
      }
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

  async function submitLoginCredentials() {
    for (const g of loginGroups) {
      if (!g.email.trim() || !g.password) return showToast('Fill in an email and password for every login', 'error')
      if (g.apps.length === 0) return showToast('Select at least one app for every login', 'error')
    }

    setSubmitting(true)
    try {
      const res = await apiFetch('/api/onboarding/submit-login-credentials', {
        method: 'POST',
        body: JSON.stringify({
          groups: loginGroups.map((g) => ({
            email: g.email.trim(),
            password: g.password,
            apps: g.apps,
            notes: notes.trim() || null,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Submit failed')
      showToast('Logins submitted — thank you!')
      setLoginGroups([newLoginGroup()])
      setNotes('')
      loadProgress()
    } catch (err) {
      showToast(err.message || 'Submit failed', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const completedCount = ONBOARDING_STEPS.filter((s) => progress[s.id]?.completed).length
  const activeStep = useMemo(
    () => ONBOARDING_STEPS.find((s) => s.id === activeStepId) ?? ONBOARDING_STEPS[0],
    [activeStepId]
  )
  const activeIndex = ONBOARDING_STEPS.findIndex((s) => s.id === activeStep.id)

  if (loading) {
    return <div className="p-6 text-sm text-text-secondary">Loading...</div>
  }

  const done = Boolean(progress[activeStep.id]?.completed)
  const isSubmitStep = activeStep.id === 'submit'

  return (
    <div className="p-4 md:p-6 space-y-5 w-full overflow-x-hidden">
      <div>
        <h1 className="text-h2 font-heading text-text-primary">Getting Started</h1>
        <p className="text-sm text-text-secondary mt-0.5">
          Work through these {ONBOARDING_STEPS.length} steps to get everything set up. ({completedCount}/{ONBOARDING_STEPS.length} done)
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {ONBOARDING_STEPS.map((step) => {
          const stepDone = Boolean(progress[step.id]?.completed)
          const isActive = step.id === activeStep.id
          return (
            <button
              key={step.id}
              onClick={() => setActiveStepId(step.id)}
              className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg border transition-colors max-w-[13rem] ${
                isActive
                  ? 'bg-vc-primary/10 border-vc-primary text-text-primary'
                  : stepDone
                  ? 'border-status-success/30 text-text-secondary hover:border-status-success/50'
                  : 'border-white/[0.08] text-text-secondary hover:border-white/[0.16]'
              }`}
            >
              {stepDone ? (
                <CheckCircle size={14} className="text-status-success flex-shrink-0" />
              ) : (
                <span
                  className={`flex-shrink-0 w-4 h-4 rounded-full text-[10px] leading-4 text-center ${
                    isActive ? 'bg-vc-primary text-white' : 'bg-bg-tertiary text-text-tertiary'
                  }`}
                >
                  {step.order}
                </span>
              )}
              <span className="truncate font-medium">{step.title}</span>
            </button>
          )
        })}
      </div>

      <div className={`vc-card ${done ? 'border-status-success/30' : ''}`}>
        <div className="flex items-start gap-3 mb-3">
          {done ? (
            <CheckCircle size={20} className="text-status-success flex-shrink-0 mt-0.5" />
          ) : (
            <Circle size={20} className="text-text-tertiary flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-text-primary">Step {activeStep.order}: {activeStep.title}</h3>
            <p className="text-xs text-text-secondary mt-1 leading-relaxed">{activeStep.description}</p>
          </div>
          {isSubmitStep && (
            <button
              type="button"
              role="switch"
              aria-checked={useStructuredLogins}
              onClick={() => setUseStructuredLogins((v) => !v)}
              className="flex items-center gap-2 text-xs text-text-secondary flex-shrink-0 whitespace-nowrap"
              title="Switch between uploading a document and entering logins directly"
            >
              <KeyRound size={13} className={useStructuredLogins ? 'text-vc-primary' : 'text-text-tertiary'} />
              <span className="hidden sm:inline">{useStructuredLogins ? 'Enter logins directly' : 'Upload a document'}</span>
              <span className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${useStructuredLogins ? 'bg-vc-primary' : 'bg-bg-tertiary border border-white/[0.12]'}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${useStructuredLogins ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </span>
            </button>
          )}
        </div>

        {activeStep.warning && (
          <div className="ml-7 mb-3 flex items-start gap-2 text-xs text-amber-800 bg-status-warning/10 border border-status-warning/20 rounded px-3 py-2">
            <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
            <span>{activeStep.warning}</span>
          </div>
        )}

        {activeStep.video_url ? (
          <LazyVideo src={embedUrl(activeStep.video_url)} title={activeStep.title} />
        ) : activeStep.missingVideo && (
          <div className="ml-7 mb-3 flex items-center gap-2 text-xs text-text-secondary bg-bg-tertiary border border-white/[0.06] rounded px-3 py-2">
            <Video size={13} className="flex-shrink-0" />
            <span>Video walkthrough coming soon — follow the steps below in the meantime.</span>
          </div>
        )}

        {activeStep.summary && (
          <p className="text-xs text-text-secondary mb-3 ml-7 leading-relaxed">{activeStep.summary}</p>
        )}

        {activeStep.steps?.length > 0 && (
          <ol className="ml-7 mb-3 space-y-1.5 list-decimal list-inside">
            {activeStep.steps.map((line, i) => (
              <li key={i} className="text-xs text-text-primary leading-relaxed">{line}</li>
            ))}
          </ol>
        )}

        {activeStep.links?.length > 0 && (
          <div className="ml-7 mb-3 flex flex-wrap gap-2">
            {activeStep.links.map((link) => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 border border-vc-primary text-vc-primary hover:bg-vc-primary/10 rounded transition-colors"
              >
                {link.label} <ExternalLink size={11} />
              </a>
            ))}
          </div>
        )}

        {isSubmitStep ? (
          useStructuredLogins ? (
            <div className="space-y-3 ml-7">
              {loginGroups.map((group, idx) => (
                <div key={group.id} className="border border-white/[0.08] rounded-lg p-3 space-y-2 bg-bg-tertiary/40">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-text-secondary">Login {idx + 1}</span>
                    {loginGroups.length > 1 && (
                      <button type="button" onClick={() => removeLoginGroup(group.id)} className="text-text-tertiary hover:text-status-danger">
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  <div className="grid sm:grid-cols-2 gap-2">
                    <input
                      type="email"
                      value={group.email}
                      onChange={(e) => updateLoginGroup(group.id, { email: e.target.value })}
                      placeholder="Login email"
                      className="text-sm bg-bg-secondary border border-white/[0.08] rounded px-3 py-2 text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-vc-primary"
                    />
                    <div className="relative">
                      <input
                        type={group.showPassword ? 'text' : 'password'}
                        value={group.password}
                        onChange={(e) => updateLoginGroup(group.id, { password: e.target.value })}
                        placeholder="Password"
                        className="w-full text-sm bg-bg-secondary border border-white/[0.08] rounded px-3 py-2 pr-9 text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-vc-primary"
                      />
                      <button
                        type="button"
                        onClick={() => updateLoginGroup(group.id, { showPassword: !group.showPassword })}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary"
                      >
                        {group.showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>

                  {group.apps.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {group.apps.map((app) => (
                        <span key={app} className="inline-flex items-center gap-1 text-xs bg-vc-primary/10 text-vc-primary rounded-full pl-2.5 pr-1.5 py-1">
                          {app}
                          <button type="button" onClick={() => toggleAppInGroup(group.id, app)}>
                            <X size={11} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  <select
                    value=""
                    onChange={(e) => e.target.value && toggleAppInGroup(group.id, e.target.value)}
                    className="text-xs bg-bg-secondary border border-white/[0.08] rounded px-2 py-1.5 text-text-secondary focus:outline-none focus:border-vc-primary"
                  >
                    <option value="">+ Add an app this login is for...</option>
                    {LOGIN_APPS.filter((app) => !group.apps.includes(app)).map((app) => (
                      <option key={app} value={app}>{app}</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-text-tertiary">Add every app that uses this same email + password, so you don't have to type it out again.</p>
                </div>
              ))}

              <button
                type="button"
                onClick={addLoginGroup}
                className="text-xs px-3 py-1.5 border border-dashed border-white/[0.16] text-text-secondary hover:border-vc-primary hover:text-vc-primary rounded transition-colors"
              >
                + Add another login (different email/password)
              </button>

              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything we should know? (optional)"
                rows={2}
                className="w-full text-sm bg-bg-tertiary border border-white/[0.08] rounded px-3 py-2 text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-vc-primary"
              />

              <button
                type="button"
                onClick={submitLoginCredentials}
                disabled={submitting}
                className="text-xs px-4 py-2 bg-vc-primary text-white hover:bg-vc-accent rounded transition-colors disabled:opacity-60"
              >
                {submitting ? 'Submitting...' : 'Submit logins'}
              </button>
            </div>
          ) : (
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
          )
        ) : (
          !done && (
            <div className="ml-7">
              <button
                onClick={() => toggleStep(activeStep.id, true)}
                className="text-xs px-4 py-2 border border-vc-primary text-vc-primary hover:bg-vc-primary/10 rounded transition-colors"
              >
                Mark as done
              </button>
            </div>
          )
        )}

        <div className="ml-7 mt-4 pt-3 border-t border-white/[0.06] flex justify-between">
          <button
            onClick={() => setActiveStepId(ONBOARDING_STEPS[activeIndex - 1].id)}
            disabled={activeIndex === 0}
            className="text-xs px-3 py-1.5 text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            ← Previous
          </button>
          <button
            onClick={() => setActiveStepId(ONBOARDING_STEPS[activeIndex + 1].id)}
            disabled={activeIndex === ONBOARDING_STEPS.length - 1}
            className="text-xs px-3 py-1.5 text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  )
}
