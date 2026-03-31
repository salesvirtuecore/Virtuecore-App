import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Check, MessageSquare, FileText, Download, Eye } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import { DEMO_CONTENT_CALENDAR } from '../../data/placeholder'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameMonth, isSameDay } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import Modal from '../../components/ui/Modal'

const STATUS_BADGE = { scheduled: 'blue', published: 'green', draft: 'default' }
const PLATFORM_COLOR = { Instagram: '#E1306C', Facebook: '#1877F2', TikTok: '#000000', LinkedIn: '#0A66C2' }

export default function ContentCalendar() {
  const { profile, isDemo } = useAuth()
  const [current, setCurrent] = useState(new Date())
  const [selected, setSelected] = useState(null)
  const [posts, setPosts] = useState(isDemo ? DEMO_CONTENT_CALENDAR : [])
  const [loadingPosts, setLoadingPosts] = useState(!isDemo)
  const [approvedIds, setApprovedIds] = useState(new Set())
  const [feedbackOpen, setFeedbackOpen] = useState({})
  const [feedbackText, setFeedbackText] = useState({})
  const [submittedFeedback, setSubmittedFeedback] = useState(new Set())
  const [contentPlans, setContentPlans] = useState([])
  const [previewPlan, setPreviewPlan] = useState(null)

  useEffect(() => {
    const clientId = profile?.client_id
    if (isDemo || !supabase || !clientId) return

    setLoadingPosts(true)
    Promise.all([
      supabase.from('content_calendar').select('*').eq('client_id', clientId).order('post_date', { ascending: true }),
      supabase.from('deliverables').select('id, title, file_url, created_at').eq('client_id', clientId).eq('type', 'content_calendar').order('created_at', { ascending: false }),
    ]).then(([{ data: calData }, { data: planData }]) => {
      setPosts(calData || [])
      setContentPlans(planData || [])
      setLoadingPosts(false)
    })
  }, [profile?.client_id])

  const monthStart = startOfMonth(current)
  const monthEnd = endOfMonth(current)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

  const days = []
  let d = calStart
  while (d <= calEnd) {
    days.push(d)
    d = addDays(d, 1)
  }

  const postsMap = {}
  posts.forEach((post) => {
    const key = post.post_date
    if (!postsMap[key]) postsMap[key] = []
    postsMap[key].push(post)
  })

  const selectedPosts = selected ? (postsMap[format(selected, 'yyyy-MM-dd')] ?? []) : []

  async function handleApprove(postId) {
    if (isDemo) {
      setPosts((prev) =>
        prev.map((p) => p.id === postId ? { ...p, status: 'published' } : p)
      )
      setApprovedIds((prev) => new Set([...prev, postId]))
    } else {
      await supabase
        .from('content_calendar')
        .update({ status: 'published' })
        .eq('id', postId)
      setPosts((prev) =>
        prev.map((p) => p.id === postId ? { ...p, status: 'published' } : p)
      )
      setApprovedIds((prev) => new Set([...prev, postId]))
    }
  }

  async function handleSubmitFeedback(post) {
    const text = feedbackText[post.id]
    if (!text?.trim()) return

    if (isDemo) {
    } else {
      // Send as a message to the client thread
      await supabase.from('crm_messages').insert({
        client_id: post.client_id,
        sender_id: null,
        content: `Changes requested for ${post.platform} post on ${post.post_date}: ${text}`,
      })
    }
    setSubmittedFeedback((prev) => new Set([...prev, post.id]))
    setFeedbackOpen((prev) => ({ ...prev, [post.id]: false }))
    setFeedbackText((prev) => ({ ...prev, [post.id]: '' }))
  }

  return (
    <div className="p-4 md:p-6 space-y-5 w-full overflow-x-hidden">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h2 font-heading text-text-primary">Content Calendar</h1>
          <p className="text-sm text-text-secondary mt-0.5">{posts.length} posts scheduled</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setCurrent(subMonths(current, 1))} className="p-1.5 border border-white/[0.06] hover:bg-bg-tertiary transition-colors">
            <ChevronLeft size={14} />
          </button>
          <span className="text-sm font-medium text-text-primary px-2">{format(current, 'MMMM yyyy')}</span>
          <button onClick={() => setCurrent(addMonths(current, 1))} className="p-1.5 border border-white/[0.06] hover:bg-bg-tertiary transition-colors">
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {contentPlans.length > 0 && (
        <div className="vc-card space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Content Plans</p>
          {contentPlans.map((plan) => (
            <div key={plan.id} className="flex items-center justify-between gap-3 py-2 border-t border-white/[0.06] first:border-0">
              <div className="flex items-center gap-2 min-w-0">
                <FileText size={14} className="text-text-secondary flex-shrink-0" />
                <span className="text-sm text-text-primary truncate">{plan.title}</span>
                <span className="text-xs text-text-secondary flex-shrink-0">{new Date(plan.created_at).toLocaleDateString('en-GB')}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {plan.file_url && (
                  <>
                    <button onClick={() => setPreviewPlan(plan)} className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary border border-white/[0.06] px-2 py-1 transition-colors">
                      <Eye size={12} /> Preview
                    </button>
                    <a href={plan.file_url} target="_blank" rel="noreferrer" download className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary border border-white/[0.06] px-2 py-1 transition-colors">
                      <Download size={12} /> Download
                    </a>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="border border-white/[0.06] overflow-x-auto">
        <div className="min-w-[420px]">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-white/[0.06]">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
            <div key={day} className="px-3 py-2 text-xs font-medium text-text-secondary text-center border-r border-white/[0.06] last:border-0">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7">
          {days.map((day, idx) => {
            const key = format(day, 'yyyy-MM-dd')
            const posts = postsMap[key] ?? []
            const isCurrentMonth = isSameMonth(day, current)
            const isSelected = selected && isSameDay(day, selected)
            const isToday = isSameDay(day, new Date())

            return (
              <div
                key={idx}
                onClick={() => setSelected(posts.length > 0 ? day : null)}
                className={`min-h-20 p-2 border-b border-r border-white/[0.06] last-of-type:border-r-0 transition-colors ${
                  isCurrentMonth ? 'bg-bg-elevated' : 'bg-bg-secondary'
                } ${posts.length > 0 ? 'cursor-pointer hover:bg-bg-tertiary' : ''} ${
                  isSelected ? 'ring-1 ring-inset ring-gold' : ''
                }`}
              >
                <div className={`text-xs mb-1.5 font-medium w-5 h-5 flex items-center justify-center ${
                  isToday ? 'bg-vc-primary text-white rounded-full' :
                  isCurrentMonth ? 'text-text-primary' : 'text-text-secondary/50'
                }`}>
                  {format(day, 'd')}
                </div>
                <div className="space-y-0.5">
                  {posts.slice(0, 2).map((post) => (
                    <div
                      key={post.id}
                      className="text-xs px-1.5 py-0.5 truncate"
                      style={{ backgroundColor: `${PLATFORM_COLOR[post.platform]}15`, color: PLATFORM_COLOR[post.platform] }}
                    >
                      {post.platform}
                    </div>
                  ))}
                  {posts.length > 2 && (
                    <p className="text-xs text-text-secondary pl-1">+{posts.length - 2} more</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        </div>
      </div>

      {/* Post detail */}
      {selected && selectedPosts.length > 0 && (
        <div className="vc-card space-y-3">
          <h2 className="text-sm font-medium text-text-primary">{format(selected, 'EEEE, d MMMM yyyy')}</h2>
          {selectedPosts.map((post) => {
            const currentStatus = posts.find((p) => p.id === post.id)?.status ?? post.status
            const isApproved = approvedIds.has(post.id) || currentStatus === 'published'
            const feedbackSent = submittedFeedback.has(post.id)

            return (
              <div key={post.id} className="py-3 border-t border-white/[0.06] first:border-0">
                <div className="flex items-start gap-3">
                  <div
                    className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                    style={{ backgroundColor: PLATFORM_COLOR[post.platform] ?? '#666' }}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-text-primary">{post.platform}</span>
                      <Badge variant={STATUS_BADGE[currentStatus]} size="xs">{currentStatus}</Badge>
                    </div>
                    <p className="text-sm text-text-primary mb-3">{post.content}</p>

                    {/* Approval actions — only when status is 'scheduled' */}
                    {currentStatus === 'scheduled' && !isApproved && !feedbackSent && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleApprove(post.id)}
                          className="flex items-center gap-1.5 bg-vc-primary hover:bg-amber-600 text-white text-xs px-3 py-1.5 transition-colors"
                        >
                          <Check size={12} />
                          Approve
                        </button>
                        <button
                          onClick={() => setFeedbackOpen((p) => ({ ...p, [post.id]: !p[post.id] }))}
                          className="flex items-center gap-1.5 border border-white/[0.06] text-text-secondary hover:text-text-primary text-xs px-3 py-1.5 transition-colors hover:bg-bg-tertiary"
                        >
                          <MessageSquare size={12} />
                          Request changes
                        </button>
                      </div>
                    )}

                    {/* Success states */}
                    {isApproved && (
                      <p className="text-xs text-status-success font-medium flex items-center gap-1">
                        <Check size={12} /> Approved — marked as published
                      </p>
                    )}
                    {feedbackSent && (
                      <p className="text-xs text-text-secondary">Changes requested — team notified.</p>
                    )}

                    {/* Feedback input */}
                    {feedbackOpen[post.id] && (
                      <div className="mt-3 space-y-2">
                        <textarea
                          value={feedbackText[post.id] ?? ''}
                          onChange={(e) => setFeedbackText((p) => ({ ...p, [post.id]: e.target.value }))}
                          placeholder="Describe the changes you'd like…"
                          rows={3}
                          className="w-full border border-white/[0.06] px-3 py-2 text-sm focus:outline-none focus:border-vc-primary resize-none"
                        />
                        <button
                          onClick={() => handleSubmitFeedback(post)}
                          className="text-xs px-3 py-1.5 bg-vc-primary text-white hover:bg-vc-accent transition-colors"
                        >
                          Submit feedback
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal isOpen={Boolean(previewPlan)} onClose={() => setPreviewPlan(null)} title={previewPlan?.title || 'Content Plan'} size="lg">
        {previewPlan?.file_url && (
          previewPlan.file_url.toLowerCase().includes('.pdf')
            ? <iframe src={previewPlan.file_url} title="Content plan" className="w-full h-[70vh] border border-white/[0.06]" />
            : <img src={previewPlan.file_url} alt={previewPlan.title} className="max-h-[70vh] w-full object-contain border border-white/[0.06]" />
        )}
      </Modal>
    </div>
  )
}
