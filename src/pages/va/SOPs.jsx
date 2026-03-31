import { useState } from 'react'
import { Search, ExternalLink, FolderOpen } from 'lucide-react'
import { DEMO_SOPS } from '../../data/placeholder'

const CATEGORIES = ['All', 'Operations', 'Paid Advertising', 'Content', 'Automation']

export default function SOPs() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')

  const filtered = DEMO_SOPS.filter((s) => {
    const matchSearch = s.title.toLowerCase().includes(search.toLowerCase())
    const matchCat = category === 'All' || s.category === category
    return matchSearch && matchCat
  })

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-h2 font-heading text-text-primary">SOPs & Knowledge Base</h1>
        <p className="text-sm text-text-secondary mt-0.5">{DEMO_SOPS.length} documents</p>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-white/[0.06] focus:outline-none focus:border-vc-primary"
          />
        </div>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              category === cat
                ? 'bg-vc-primary text-white'
                : 'bg-bg-elevated border border-white/[0.08] text-text-secondary hover:text-text-primary'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Documents */}
      <div className="border border-white/[0.06] divide-y divide-white/[0.06]">
        {filtered.map((sop) => (
          <div key={sop.id} className="flex items-center justify-between px-5 py-3 hover:bg-bg-tertiary transition-colors">
            <div className="flex items-center gap-3">
              <FolderOpen size={16} className="text-text-secondary flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-text-primary">{sop.title}</p>
                <p className="text-xs text-text-secondary">{sop.category} · Updated {sop.updated}</p>
              </div>
            </div>
            <a
              href={sop.url}
              className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary transition-colors px-2 py-1"
            >
              <ExternalLink size={12} />
              Open
            </a>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="px-5 py-8 text-center text-sm text-text-secondary">
            No documents match your search.
          </div>
        )}
      </div>
    </div>
  )
}
