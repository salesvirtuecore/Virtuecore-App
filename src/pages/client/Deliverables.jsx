import { useEffect, useMemo, useState } from 'react'
import { Download, MessageSquare, Check, Eye, FileText } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import { DEMO_DELIVERABLES } from '../../data/placeholder'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import Modal from '../../components/ui/Modal'
import { sendPushNotification } from '../../lib/pushNotifications'
import { notifySlack } from '../../lib/slackNotify'

const TYPE_LABELS = {
  ad_creative: 'Ad Creative',
  content_calendar: 'Content Calendar',
  report: 'Report',
  website: 'Website',
  lead_magnet: 'Lead Magnet',
  other: 'Other',
}

const STATUS_BADGE = {
  approved: 'green',
  pending_review: 'amber',
  changes_requested: 'red',
  draft: 'default',
}

const STATUS_LABEL = {
  approved: 'Approved',
  pending_review: 'Pending Review',
  changes_requested: 'Changes Requested',
  draft: 'Draft',
}

export default function Deliverables() {
  const { profile, isDemo } = useAuth()
  const [deliverables, setDeliverables] = useState(isDemo ? DEMO_DELIVERABLES.filter((d) => d.client_id === 'c-001') : [])
  const [loading, setLoading] = useState(!isDemo)
  const [previewItem, setPreviewItem] = useState(null)
  const [feedback, setFeedback] = useState({})
  const [showFeedback, setShowFeedback] = useState({})
  const [justApproved, setJustApproved] = useState(new Set())

  const clientId = isDemo ? 'c-001' : profile?.client_id

  useEffect(() => {
    if (isDemo || !supabase || !clientId) {
      setLoading(false)
      return
    }

    let canceled = false

    async function loadDeliverables() {
      setLoading(true)
      const { data, error } = await supabase
        .from('deliverables')
        .select('id, client_id, title, status, feedback, file_url, type, created_at')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })

      if (!canceled) {
        if (!error) setDeliverables(data || [])
        setLoading(false)
      }
    }

    loadDeliverables()

    const channel = supabase
      .channel(`client-deliverables-${clientId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'deliverables', filter: `client_id=eq.${clientId}` },
        () => loadDeliverables()
      )
      .subscribe()

    return () => {
      canceled = true
      supabase.removeChannel(channel)
    }
  }, [clientId])

  const normalizedDeliverables = useMemo(() => {
    return deliverables.map((d) => ({
      ...d,
      file_url: d.file_url === '#' ? '/demo-deliverable.pdf' : d.file_url,
    }))
  }, [deliverables])

  function isPreviewable(url) {
    if (!url) return false
    const normalized = url.toLowerCase().split('?')[0]
    return normalized.endsWith('.pdf') || normalized.endsWith('.png') || normalized.endsWith('.jpg') || normalized.endsWith('.jpeg') || normalized.endsWith('.webp')
  }

  async function notifyAdmins(title, body) {
    if (isDemo || !supabase) return
    const { data: admins } = await supabase.from('profiles').select('id').eq('role', 'admin')
    for (const admin of admins || []) {
      sendPushNotification(admin.id, { title, body, url: `/admin/clients/${clientId}` })
    }
  }

  async function approve(id) {
    const deliverable = deliverables.find((d) => d.id === id)
    if (!isDemo) {
      await supabase.from('deliverables').update({ status: 'approved' }).eq('id', id)
    }
    setDeliverables((prev) => prev.map((d) => d.id === id ? { ...d, status: 'approved' } : d))
    setJustApproved((prev) => new Set([...prev, id]))
    setTimeout(() => setJustApproved((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    }), 3000)
    notifyAdmins('Deliverable approved ✓', `${profile?.full_name ?? 'Client'} approved "${deliverable?.title ?? 'a deliverable'}"`)
    notifySlack('deliverable_approved', { title: deliverable?.title ?? 'a deliverable', client_name: profile?.full_name ?? 'Client' })
  }

  async function requestChanges(id) {
    const text = feedback[id]
    if (!text?.trim()) return
    const deliverable = deliverables.find((d) => d.id === id)
    if (!isDemo) {
      await supabase.from('deliverables').update({ status: 'changes_requested', feedback: text }).eq('id', id)
    }
    setDeliverables((prev) => prev.map((d) =>
      d.id === id ? { ...d, status: 'changes_requested', feedback: text } : d
    ))
    setShowFeedback((prev) => ({ ...prev, [id]: false }))
    notifyAdmins('Changes requested', `${profile?.full_name ?? 'Client'} requested changes on "${deliverable?.title ?? 'a deliverable'}"`)
    notifySlack('deliverable_changes', { title: deliverable?.title ?? 'a deliverable', client_name: profile?.full_name ?? 'Client', feedback: text })
  }

  return (
    <div className="p-4 md:p-6 space-y-5 w-full overflow-x-hidden">
      <div>
        <h1 className="text-h2 font-heading text-text-primary">Deliverables</h1>
        <p className="text-sm text-text-secondary mt-0.5">Review and approve your assets</p>
      </div>

      {loading && (
        <div className="space-y-3 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="vc-card space-y-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="h-4 w-48 bg-bg-tertiary rounded" />
                  <div className="h-3 w-32 bg-bg-tertiary rounded" />
                </div>
                <div className="h-6 w-20 bg-bg-tertiary rounded" />
              </div>
              <div className="flex gap-2">
                <div className="h-8 w-24 bg-bg-tertiary rounded" />
                <div className="h-8 w-24 bg-bg-tertiary rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {normalizedDeliverables.map((d) => (
          <div key={d.id} className="vc-card">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-medium text-text-primary">{d.title}</p>
                <p className="text-xs text-text-secondary mt-0.5">{TYPE_LABELS[d.type]} · {d.created_at}</p>
              </div>
              <Badge variant={STATUS_BADGE[d.status]}>{STATUS_LABEL[d.status]}</Badge>
            </div>

            {d.feedback && (
              <div className="mb-3 p-3 bg-status-danger/10 border border-status-danger/20 text-sm text-red-700">
                <span className="font-medium">Feedback: </span>{d.feedback}
              </div>
            )}

            {justApproved.has(d.id) && (
              <div className="mb-3 flex items-center gap-1.5 text-sm text-status-success bg-status-success/10 border border-status-success/20 px-3 py-2">
                <Check size={14} />
                Approved — thank you! The team has been notified.
              </div>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              {d.file_url && isPreviewable(d.file_url) && (
                <Button variant="secondary" size="sm" onClick={() => setPreviewItem(d)}>
                  <Eye size={14} />
                  Preview
                </Button>
              )}

              {d.file_url ? (
                <a href={d.file_url} download target="_blank" rel="noreferrer">
                  <Button variant="secondary" size="sm">
                    <Download size={14} />
                    Download
                  </Button>
                </a>
              ) : (
                <Button variant="secondary" size="sm" disabled>
                  <FileText size={14} />
                  No file
                </Button>
              )}

              {d.status === 'pending_review' && !justApproved.has(d.id) && (
                <>
                  <Button variant="primary" size="sm" onClick={() => approve(d.id)}>
                    <Check size={14} />
                    Approve
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowFeedback((p) => ({ ...p, [d.id]: !p[d.id] }))}
                  >
                    <MessageSquare size={14} />
                    Request changes
                  </Button>
                </>
              )}
            </div>

            {showFeedback[d.id] && (
              <div className="mt-3 space-y-2">
                <textarea
                  value={feedback[d.id] ?? ''}
                  onChange={(e) => setFeedback((p) => ({ ...p, [d.id]: e.target.value }))}
                  placeholder="Describe the changes you'd like..."
                  rows={3}
                  className="w-full border border-white/[0.06] px-3 py-2 text-sm focus:outline-none focus:border-vc-primary resize-none"
                />
                <Button variant="danger" size="sm" onClick={() => requestChanges(d.id)}>
                  Submit feedback
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      <Modal
        isOpen={Boolean(previewItem)}
        onClose={() => setPreviewItem(null)}
        title={previewItem?.title || 'Deliverable Preview'}
        size="lg"
      >
        {previewItem?.file_url?.toLowerCase().includes('.pdf') ? (
          <iframe
            src={previewItem.file_url}
            title="Deliverable preview"
            className="w-full h-[70vh] border border-white/[0.06]"
          />
        ) : (
          <img
            src={previewItem?.file_url}
            alt={previewItem?.title || 'Deliverable preview'}
            className="max-h-[70vh] w-full object-contain border border-white/[0.06]"
          />
        )}
      </Modal>
    </div>
  )
}
