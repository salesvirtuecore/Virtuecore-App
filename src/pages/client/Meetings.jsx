import { Video, Calendar } from 'lucide-react'

const RECORDINGS = [
  { id: 'r-001', title: 'Monthly Review — February 2026', date: '2026-02-28', duration: '34 min', url: '#' },
  { id: 'r-002', title: 'Strategy Call — Q1 Planning', date: '2026-01-10', duration: '51 min', url: '#' },
  { id: 'r-003', title: 'Onboarding Call', date: '2025-10-05', duration: '62 min', url: '#' },
]

export default function Meetings() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-vc-text">Meetings</h1>
        <p className="text-sm text-vc-muted mt-0.5">Schedule a call and access recordings</p>
      </div>

      {/* Calendly embed placeholder */}
      <div className="border border-vc-border p-6">
        <div className="flex items-center gap-2 mb-4">
          <Calendar size={16} className="text-gold" />
          <h2 className="text-sm font-medium text-vc-text">Book a Call</h2>
        </div>
        <div className="bg-vc-secondary border border-vc-border h-96 flex items-center justify-center">
          <div className="text-center">
            <Calendar size={32} className="text-vc-muted mx-auto mb-3" />
            <p className="text-sm font-medium text-vc-text">Calendly Integration</p>
            <p className="text-xs text-vc-muted mt-1 max-w-xs">
              Your Calendly scheduling link will be embedded here. Replace this placeholder with your Calendly widget embed code.
            </p>
            <a
              href="https://calendly.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-3 px-4 py-2 bg-vc-text text-white text-sm hover:bg-gray-800 transition-colors"
            >
              Book via Calendly
            </a>
          </div>
        </div>
      </div>

      {/* Recordings */}
      <div className="border border-vc-border">
        <div className="px-5 py-3 border-b border-vc-border flex items-center gap-2">
          <Video size={14} className="text-vc-muted" />
          <h2 className="text-sm font-medium text-vc-text">Recording Library</h2>
        </div>
        <div className="divide-y divide-vc-border">
          {RECORDINGS.map((r) => (
            <div key={r.id} className="px-5 py-3 flex items-center justify-between hover:bg-vc-secondary transition-colors">
              <div>
                <p className="text-sm font-medium text-vc-text">{r.title}</p>
                <p className="text-xs text-vc-muted">{r.date} · {r.duration}</p>
              </div>
              <a
                href={r.url}
                className="text-xs px-3 py-1.5 border border-vc-border text-vc-muted hover:text-vc-text hover:border-vc-text transition-colors flex items-center gap-1"
              >
                <Video size={12} />
                Watch
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
