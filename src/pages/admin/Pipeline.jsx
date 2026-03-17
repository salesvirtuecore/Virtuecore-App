import { useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { DEMO_PIPELINE } from '../../data/placeholder'
import Modal from '../../components/ui/Modal'
import FormField from '../../components/ui/FormField'
import { isDemoMode, supabase } from '../../lib/supabase'
import { useToast } from '../../context/ToastContext'

const STAGES = [
  { id: 'captured', label: 'Lead Captured' },
  { id: 'call_booked', label: 'Call Booked' },
  { id: 'call_completed', label: 'Call Completed' },
  { id: 'proposal_sent', label: 'Proposal Sent' },
  { id: 'contract_signed', label: 'Contract Signed' },
  { id: 'onboarding', label: 'Onboarding' },
]

const EMPTY_LEAD_FORM = {
  name: '',
  email: '',
  company: '',
  source: 'organic',
  score: 50,
  stage: 'captured',
  notes: '',
}

function ScoreDot({ score }) {
  const color = score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-amber-500' : 'bg-red-500'
  return <div className={`w-1.5 h-1.5 rounded-full ${color} flex-shrink-0`} />
}

export default function Pipeline() {
  const [leads, setLeads] = useState(DEMO_PIPELINE)
  const [selected, setSelected] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editLead, setEditLead] = useState(null)
  const [leadForm, setLeadForm] = useState(EMPTY_LEAD_FORM)
  const [leadErrors, setLeadErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const { showToast } = useToast()

  function moveStage(leadId, direction) {
    setLeads((prev) =>
      prev.map((l) => {
        if (l.id !== leadId) return l
        const idx = STAGES.findIndex((s) => s.id === l.stage)
        const newIdx = idx + direction
        if (newIdx < 0 || newIdx >= STAGES.length) return l
        return { ...l, stage: STAGES[newIdx].id }
      })
    )
    // In live mode, persist stage change
    if (!isDemoMode) {
      const lead = leads.find((l) => l.id === leadId)
      if (lead) {
        const idx = STAGES.findIndex((s) => s.id === lead.stage)
        const newIdx = idx + direction
        if (newIdx >= 0 && newIdx < STAGES.length) {
          supabase.from('pipeline_leads').update({ stage: STAGES[newIdx].id }).eq('id', leadId).then(({ error }) => {
            if (error) showToast('Failed to update stage', 'error')
          })
        }
      }
    }
    // Keep selected in sync
    if (selected?.id === leadId) {
      setSelected((prev) => {
        if (!prev) return null
        const idx = STAGES.findIndex((s) => s.id === prev.stage)
        const newIdx = idx + direction
        if (newIdx < 0 || newIdx >= STAGES.length) return prev
        return { ...prev, stage: STAGES[newIdx].id }
      })
    }
  }

  function openAdd() {
    setEditLead(null)
    setLeadForm(EMPTY_LEAD_FORM)
    setLeadErrors({})
    setShowAddModal(true)
  }

  function openEdit(lead) {
    setEditLead(lead)
    setLeadForm({
      name: lead.name,
      email: lead.email,
      company: lead.company,
      source: lead.source,
      score: lead.score,
      stage: lead.stage,
      notes: lead.notes ?? '',
    })
    setLeadErrors({})
    setShowAddModal(true)
  }

  function validateLead() {
    const e = {}
    if (!leadForm.name.trim()) e.name = 'Name is required'
    if (!leadForm.email.trim()) e.email = 'Email is required'
    if (leadForm.score === '' || isNaN(Number(leadForm.score))) e.score = 'Valid score (0–100) required'
    return e
  }

  async function handleSaveLead() {
    const e = validateLead()
    if (Object.keys(e).length) { setLeadErrors(e); return }
    setSaving(true)
    try {
      const payload = {
        name: leadForm.name.trim(),
        email: leadForm.email.trim(),
        company: leadForm.company.trim(),
        source: leadForm.source,
        score: Number(leadForm.score),
        stage: leadForm.stage,
        notes: leadForm.notes.trim(),
      }

      if (isDemoMode) {
        if (editLead) {
          setLeads((prev) => prev.map((l) => (l.id === editLead.id ? { ...l, ...payload } : l)))
          if (selected?.id === editLead.id) setSelected((prev) => ({ ...prev, ...payload }))
        } else {
          const newLead = { ...payload, id: `p-${Date.now()}`, created_at: new Date().toISOString().split('T')[0] }
          setLeads((prev) => [...prev, newLead])
        }
      } else {
        if (editLead) {
          const { error } = await supabase.from('pipeline_leads').update(payload).eq('id', editLead.id)
          if (error) throw error
          setLeads((prev) => prev.map((l) => (l.id === editLead.id ? { ...l, ...payload } : l)))
          if (selected?.id === editLead.id) setSelected((prev) => ({ ...prev, ...payload }))
        } else {
          const { data, error } = await supabase.from('pipeline_leads').insert(payload).select().single()
          if (error) throw error
          setLeads((prev) => [...prev, data])
        }
      }

      showToast(editLead ? 'Lead updated' : 'Lead added')
      setShowAddModal(false)
    } catch (err) {
      showToast(err.message ?? 'Failed to save lead', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteLead(leadId) {
    if (!confirm('Delete this lead?')) return
    try {
      if (!isDemoMode) {
        const { error } = await supabase.from('pipeline_leads').delete().eq('id', leadId)
        if (error) throw error
      }
      setLeads((prev) => prev.filter((l) => l.id !== leadId))
      if (selected?.id === leadId) setSelected(null)
      showToast('Lead deleted')
    } catch (err) {
      showToast(err.message ?? 'Failed to delete lead', 'error')
    }
  }

  const inputClass = 'border border-vc-border rounded px-3 py-2 w-full text-sm text-vc-text focus:outline-none focus:border-gold'
  const selectClass = inputClass
  const textareaClass = `${inputClass} resize-none`

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-vc-text">Sales Pipeline</h1>
          <p className="text-sm text-vc-muted mt-0.5">{leads.length} leads tracked</p>
        </div>
        <button
          onClick={openAdd}
          className="bg-gold hover:bg-gold-dark text-white text-sm px-4 py-2 rounded flex items-center gap-2"
        >
          <Plus size={14} />
          Add Lead
        </button>
      </div>

      {/* Kanban */}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {STAGES.map((stage) => {
          const stageLeads = leads.filter((l) => l.stage === stage.id)
          return (
            <div key={stage.id} className="flex-shrink-0 w-56">
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-xs font-medium text-vc-text">{stage.label}</span>
                <span className="text-xs text-vc-muted bg-vc-secondary px-1.5 py-0.5">{stageLeads.length}</span>
              </div>
              <div className="space-y-2 min-h-20">
                {stageLeads.map((lead) => (
                  <div
                    key={lead.id}
                    onClick={() => setSelected(selected?.id === lead.id ? null : lead)}
                    className="bg-white border border-vc-border p-3 cursor-pointer hover:border-vc-text transition-colors"
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <ScoreDot score={lead.score} />
                      <span className="text-xs font-medium text-vc-text truncate flex-1">{lead.name}</span>
                    </div>
                    <p className="text-xs text-vc-muted truncate">{lead.company}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-vc-muted">{lead.source}</span>
                      <span className="text-xs font-medium text-vc-text">{lead.score}</span>
                    </div>
                    {/* Move + Edit + Delete buttons */}
                    <div className="flex gap-1 mt-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); moveStage(lead.id, -1) }}
                        className="text-xs px-1.5 py-0.5 border border-vc-border text-vc-muted hover:text-vc-text transition-colors"
                        title="Move left"
                      >←</button>
                      <button
                        onClick={(e) => { e.stopPropagation(); moveStage(lead.id, 1) }}
                        className="text-xs px-1.5 py-0.5 border border-vc-border text-vc-muted hover:text-vc-text transition-colors"
                        title="Move right"
                      >→</button>
                      <button
                        onClick={(e) => { e.stopPropagation(); openEdit(lead) }}
                        className="ml-auto text-vc-muted hover:text-vc-text transition-colors p-0.5"
                        title="Edit lead"
                      >
                        <Pencil size={11} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteLead(lead.id) }}
                        className="text-vc-muted hover:text-red-500 transition-colors p-0.5"
                        title="Delete lead"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="border border-vc-border p-5 bg-vc-secondary">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-medium text-vc-text">{selected.name}</h3>
              <p className="text-sm text-vc-muted">{selected.company} · {selected.email}</p>
            </div>
            <button onClick={() => setSelected(null)} className="text-vc-muted hover:text-vc-text text-xs">✕</button>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm mb-3">
            <div><p className="text-xs text-vc-muted">Source</p><p className="font-medium">{selected.source}</p></div>
            <div><p className="text-xs text-vc-muted">Score</p><p className="font-medium">{selected.score}/100</p></div>
            <div><p className="text-xs text-vc-muted">Added</p><p className="font-medium">{selected.created_at}</p></div>
          </div>
          <p className="text-sm text-vc-muted">{selected.notes}</p>
        </div>
      )}

      {/* ── Add / Edit Lead Modal ──────────────────────────────────────── */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title={editLead ? 'Edit Lead' : 'Add Lead'}
        size="md"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Name" required error={leadErrors.name}>
              <input
                className={inputClass}
                value={leadForm.name}
                onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })}
                placeholder="Gary Ellis"
              />
            </FormField>

            <FormField label="Email" required error={leadErrors.email}>
              <input
                type="email"
                className={inputClass}
                value={leadForm.email}
                onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })}
                placeholder="gary@example.co.uk"
              />
            </FormField>
          </div>

          <FormField label="Company">
            <input
              className={inputClass}
              value={leadForm.company}
              onChange={(e) => setLeadForm({ ...leadForm, company: e.target.value })}
              placeholder="Ellis Electrical"
            />
          </FormField>

          <div className="grid grid-cols-3 gap-3">
            <FormField label="Source" required>
              <select
                className={selectClass}
                value={leadForm.source}
                onChange={(e) => setLeadForm({ ...leadForm, source: e.target.value })}
              >
                <option value="organic">Organic</option>
                <option value="referral">Referral</option>
                <option value="paid">Paid</option>
                <option value="cold outreach">Cold Outreach</option>
                <option value="other">Other</option>
              </select>
            </FormField>

            <FormField label="Score (0–100)" required error={leadErrors.score}>
              <input
                type="number"
                className={inputClass}
                value={leadForm.score}
                onChange={(e) => setLeadForm({ ...leadForm, score: e.target.value })}
                min="0"
                max="100"
              />
            </FormField>

            <FormField label="Stage" required>
              <select
                className={selectClass}
                value={leadForm.stage}
                onChange={(e) => setLeadForm({ ...leadForm, stage: e.target.value })}
              >
                {STAGES.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </FormField>
          </div>

          <FormField label="Notes">
            <textarea
              className={textareaClass}
              rows={3}
              value={leadForm.notes}
              onChange={(e) => setLeadForm({ ...leadForm, notes: e.target.value })}
              placeholder="Any additional notes..."
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setShowAddModal(false)} className="border border-vc-border text-vc-text text-sm px-4 py-2 rounded hover:bg-vc-secondary">
              Cancel
            </button>
            <button onClick={handleSaveLead} disabled={saving} className="bg-gold hover:bg-gold-dark text-white text-sm px-4 py-2 rounded disabled:opacity-60">
              {saving ? 'Saving…' : editLead ? 'Save Changes' : 'Add Lead'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
