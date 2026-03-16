import { useState } from 'react'
import { Download, MessageSquare, Check } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import { DEMO_DELIVERABLES } from '../../data/placeholder'
import { supabase, isDemoMode } from '../../lib/supabase'

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
  const [deliverables, setDeliverables] = useState(DEMO_DELIVERABLES)
  const [feedback, setFeedback] = useState({})
  const [showFeedback, setShowFeedback] = useState({})
  const [justApproved, setJustApproved] = useState(new Set())

  async function approve(id) {
    if (!isDemoMode) {
      await supabase
        .from('deliverables')
        .update({ status: 'approved' })
        .eq('id', id)
    }
    setDeliverables((prev) => prev.map((d) => d.id === id ? { ...d, status: 'approved' } : d))
    setJustApproved((prev) => new Set([...prev, id]))
    setTimeout(() => setJustApproved((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    }), 3000)
  }

  async function requestChanges(id) {
    const text = feedback[id]
    if (!text?.trim()) return
    if (!isDemoMode) {
      await supabase
        .from('deliverables')
        .update({ status: 'changes_requested', feedback: text })
        .eq('id', id)
    }
    setDeliverables((prev) => prev.map((d) =>
      d.id === id ? { ...d, status: 'changes_requested', feedback: text } : d
    ))
    setShowFeedback((prev) => ({ ...prev, [id]: false }))
  }

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-vc-text">Deliverables</h1>
        <p className="text-sm text-vc-muted mt-0.5">Review and approve your assets</p>
      </div>

      <div className="space-y-3">
        {deliverables.map((d) => (
          <div key={d.id} className="border border-vc-border p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-medium text-vc-text">{d.title}</p>
                <p className="text-xs text-vc-muted mt-0.5">{TYPE_LABELS[d.type]} · {d.created_at}</p>
              </div>
              <Badge variant={STATUS_BADGE[d.status]}>{STATUS_LABEL[d.status]}</Badge>
            </div>

            {d.feedback && (
              <div className="mb-3 p-3 bg-red-50 border border-red-200 text-sm text-red-700">
                <span className="font-medium">Feedback: </span>{d.feedback}
              </div>
            )}

            {justApproved.has(d.id) && (
              <div className="mb-3 flex items-center gap-1.5 text-sm text-green-700 bg-green-50 border border-green-200 px-3 py-2">
                <Check size={14} />
                Approved — thank you! The team has been notified.
              </div>
            )}

            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm">
                <Download size={14} />
                Download
              </Button>
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
                  className="w-full border border-vc-border px-3 py-2 text-sm focus:outline-none focus:border-vc-text resize-none"
                />
                <Button variant="danger" size="sm" onClick={() => requestChanges(d.id)}>
                  Submit feedback
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
