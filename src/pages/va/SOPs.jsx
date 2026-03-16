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
        <h1 className="text-xl font-semibold text-vc-text">SOPs & Knowledge Base</h1>
        <p className="text-sm text-vc-muted mt-0.5">{DEMO_SOPS.length} documents</p>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-vc-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-vc-border focus:outline-none focus:border-vc-text"
          />
        </div>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              category === cat
                ? 'bg-vc-text text-white'
                : 'bg-white border border-vc-border text-vc-muted hover:text-vc-text'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Documents */}
      <div className="border border-vc-border divide-y divide-vc-border">
        {filtered.map((sop) => (
          <div key={sop.id} className="flex items-center justify-between px-5 py-3 hover:bg-vc-secondary transition-colors">
            <div className="flex items-center gap-3">
              <FolderOpen size={16} className="text-vc-muted flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-vc-text">{sop.title}</p>
                <p className="text-xs text-vc-muted">{sop.category} · Updated {sop.updated}</p>
              </div>
            </div>
            <a
              href={sop.url}
              className="flex items-center gap-1 text-xs text-vc-muted hover:text-vc-text transition-colors px-2 py-1"
            >
              <ExternalLink size={12} />
              Open
            </a>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="px-5 py-8 text-center text-sm text-vc-muted">
            No documents match your search.
          </div>
        )}
      </div>
    </div>
  )
}
