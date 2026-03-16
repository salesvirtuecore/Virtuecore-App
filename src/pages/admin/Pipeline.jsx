import { useState } from 'react'
import { DEMO_PIPELINE } from '../../data/placeholder'

const STAGES = [
  { id: 'captured', label: 'Lead Captured' },
  { id: 'call_booked', label: 'Call Booked' },
  { id: 'call_completed', label: 'Call Completed' },
  { id: 'proposal_sent', label: 'Proposal Sent' },
  { id: 'contract_signed', label: 'Contract Signed' },
  { id: 'onboarding', label: 'Onboarding' },
]

function ScoreDot({ score }) {
  const color = score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className={`w-1.5 h-1.5 rounded-full ${color} flex-shrink-0`} />
  )
}

export default function Pipeline() {
  const [leads, setLeads] = useState(DEMO_PIPELINE)
  const [selected, setSelected] = useState(null)

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
  }

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-vc-text">Sales Pipeline</h1>
        <p className="text-sm text-vc-muted mt-0.5">{leads.length} leads tracked</p>
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
                      <span className="text-xs font-medium text-vc-text truncate">{lead.name}</span>
                    </div>
                    <p className="text-xs text-vc-muted truncate">{lead.company}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-vc-muted">{lead.source}</span>
                      <span className="text-xs font-medium text-vc-text">{lead.score}</span>
                    </div>
                    {/* Move buttons */}
                    <div className="flex gap-1 mt-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); moveStage(lead.id, -1) }}
                        className="text-xs px-1.5 py-0.5 border border-vc-border text-vc-muted hover:text-vc-text transition-colors"
                      >←</button>
                      <button
                        onClick={(e) => { e.stopPropagation(); moveStage(lead.id, 1) }}
                        className="text-xs px-1.5 py-0.5 border border-vc-border text-vc-muted hover:text-vc-text transition-colors"
                      >→</button>
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
    </div>
  )
}
