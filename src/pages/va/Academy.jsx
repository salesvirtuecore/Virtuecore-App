import { useState } from 'react'
import { BookOpen, CheckCircle, Circle, Clock, ChevronRight, ChevronLeft, Trophy, RotateCcw, Play } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import { supabase, isDemoMode } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

// ── Demo module data ──────────────────────────────────────────────────────────
const DEMO_ACADEMY_MODULES = [
  {
    id: 'mod-meta',
    title: 'Meta Ads Fundamentals',
    description:
      'Learn the core concepts behind Meta Ads — campaign structure, objectives, audience targeting, and what makes a high-converting lead generation campaign. Covers CPL, CTR, creative formats, and basic reporting.',
    estimated_minutes: 45,
    order_index: 1,
    video_url: null, // placeholder — real video URL goes here
    content_html: `
      <p>Meta Ads remains one of the most powerful platforms for generating leads for local service businesses. Understanding the campaign structure is fundamental to running profitable campaigns.</p>
      <h3>Campaign Objectives</h3>
      <p>Always match your objective to your goal. For lead generation, use the <strong>Lead Generation</strong> objective — it opens a native form inside Facebook/Instagram, removing the friction of leaving the app.</p>
      <h3>Key Metrics to Monitor</h3>
      <ul>
        <li><strong>CPL (Cost Per Lead)</strong> — total spend ÷ leads generated</li>
        <li><strong>CTR (Click-Through Rate)</strong> — clicks ÷ impressions × 100</li>
        <li><strong>ROAS (Return on Ad Spend)</strong> — revenue ÷ spend</li>
      </ul>
      <h3>Audience Targeting</h3>
      <p>Start with broad targeting for local businesses — a 10–25 mile radius around the service area, age 25–65, all genders. Let Meta optimise with its algorithm before narrowing.</p>
    `,
    quiz_questions: [
      {
        id: 'q1-meta',
        question: 'What does CPL stand for in Meta Ads?',
        options: [
          { id: 'a', text: 'Cost Per Lead' },
          { id: 'b', text: 'Click Per Landing' },
          { id: 'c', text: 'Campaign Per Lead' },
          { id: 'd', text: 'Cost Per Like' },
        ],
        correct_option_id: 'a',
        explanation: 'CPL stands for Cost Per Lead — calculated as total ad spend divided by the number of leads generated.',
      },
      {
        id: 'q2-meta',
        question: 'Which Meta Ads objective should you use to generate form submissions?',
        options: [
          { id: 'a', text: 'Brand Awareness' },
          { id: 'b', text: 'Traffic' },
          { id: 'c', text: 'Lead Generation' },
          { id: 'd', text: 'Reach' },
        ],
        correct_option_id: 'c',
        explanation: 'Lead Generation opens a native form inside Facebook/Instagram, making it the correct objective for capturing contact details.',
      },
      {
        id: 'q3-meta',
        question: 'What is a good benchmark CTR for Meta lead generation ads?',
        options: [
          { id: 'a', text: '0.1–0.5%' },
          { id: 'b', text: '1–3%' },
          { id: 'c', text: '5–10%' },
          { id: 'd', text: '15–20%' },
        ],
        correct_option_id: 'b',
        explanation: '1–3% CTR is a healthy benchmark for Meta lead generation ads. Below 1% suggests creative or audience issues; above 3% is excellent.',
      },
    ],
  },
  {
    id: 'mod-google',
    title: 'Google Ads Setup & Optimisation',
    description:
      'Master Google Search campaigns for local service businesses. Covers keyword match types, Quality Score, bidding strategies, ad copy best practices, and ongoing optimisation workflows.',
    estimated_minutes: 60,
    order_index: 2,
    video_url: null,
    content_html: `
      <p>Google Search Ads capture high-intent demand — people actively searching for your service. This makes them often the highest-converting channel for local service businesses.</p>
      <h3>Keyword Match Types</h3>
      <ul>
        <li><strong>Exact Match</strong> — only shows for that exact search (or very close variants)</li>
        <li><strong>Phrase Match</strong> — shows when the search includes the keyword phrase</li>
        <li><strong>Broad Match</strong> — shows for searches that include the meaning of your keyword</li>
      </ul>
      <h3>Quality Score</h3>
      <p>Quality Score (1–10) is based on three components: Expected CTR, Ad Relevance, and Landing Page Experience. Higher Quality Scores mean lower CPCs and better ad positions.</p>
      <h3>ROAS</h3>
      <p>Return on Ad Spend = Revenue ÷ Ad Spend. A ROAS of 4x means every £1 spent returns £4 in revenue.</p>
    `,
    quiz_questions: [
      {
        id: 'q1-google',
        question: 'What match type shows ads for searches that include the meaning of your keyword?',
        options: [
          { id: 'a', text: 'Exact Match' },
          { id: 'b', text: 'Phrase Match' },
          { id: 'c', text: 'Broad Match' },
          { id: 'd', text: 'Negative Match' },
        ],
        correct_option_id: 'c',
        explanation: 'Broad Match shows ads for searches that include the meaning or intent of your keyword, even if the exact words differ.',
      },
      {
        id: 'q2-google',
        question: 'What is Quality Score in Google Ads based on?',
        options: [
          { id: 'a', text: 'Ad spend only' },
          { id: 'b', text: 'Expected CTR, ad relevance, and landing page experience' },
          { id: 'c', text: 'Number of keywords' },
          { id: 'd', text: 'Campaign age' },
        ],
        correct_option_id: 'b',
        explanation: 'Quality Score is calculated from three factors: Expected CTR, Ad Relevance, and Landing Page Experience.',
      },
      {
        id: 'q3-google',
        question: 'What does ROAS stand for?',
        options: [
          { id: 'a', text: 'Return On Ad Spend' },
          { id: 'b', text: 'Rate Of Ad Sales' },
          { id: 'c', text: 'Revenue Of Advertising System' },
          { id: 'd', text: 'Return On Audience Spend' },
        ],
        correct_option_id: 'a',
        explanation: 'ROAS stands for Return On Ad Spend — calculated as revenue generated divided by the cost of the ads.',
      },
    ],
  },
  {
    id: 'mod-content',
    title: 'Content Creation for Social Media',
    description:
      'Learn how to create compelling social media content for local service businesses. Covers content pillars, caption writing, platform best practices, and scheduling workflows.',
    estimated_minutes: 30,
    order_index: 3,
    video_url: null,
    content_html: `
      <p>Consistent, high-quality social media content builds trust and keeps clients top of mind with their audience.</p>
      <h3>Content Pillars</h3>
      <p>Every service business needs 4 core content pillars: Before & After / Results, Educational Tips, Social Proof (reviews), and Behind the Scenes.</p>
      <h3>Caption Writing</h3>
      <p>Lead with the hook (first line must grab attention), provide value in the body, and close with a clear CTA. For service businesses, "Book a free survey" or "Call now for a free quote" are proven CTAs.</p>
    `,
    quiz_questions: [],
  },
  {
    id: 'mod-client-comms',
    title: 'Client Communication & Reporting',
    description:
      'Master professional client communication, report structure, and how to present results confidently. Covers monthly report templates, managing client expectations, and escalation procedures.',
    estimated_minutes: 30,
    order_index: 4,
    video_url: null,
    content_html: `
      <p>Clear, proactive communication is the foundation of long-term client retention.</p>
      <h3>Monthly Reporting</h3>
      <p>Every report should cover: Executive Summary, KPI summary table, platform breakdown, notable wins, areas for improvement, and next month's plan.</p>
      <h3>Managing Expectations</h3>
      <p>Always set expectations before a campaign launches. Share benchmarks, typical lead volumes for the market, and a ramp-up timeline (most campaigns need 2–4 weeks to optimise).</p>
    `,
    quiz_questions: [],
  },
  {
    id: 'mod-zapier',
    title: 'Zapier Automation Basics',
    description:
      'Learn how to use Zapier to automate repetitive tasks across VirtueCore workflows. Covers Zap structure, triggers, actions, and the key automations used in the VirtueCore system.',
    estimated_minutes: 45,
    order_index: 5,
    video_url: null,
    content_html: `
      <p>Zapier connects the tools we use and automates the manual work between them — saving hours every week.</p>
      <h3>Zap Structure</h3>
      <p>Every Zap has a <strong>Trigger</strong> (something that happens) and one or more <strong>Actions</strong> (things that happen as a result). Example: New lead in Facebook → Send Slack notification → Add to CRM.</p>
      <h3>Key VirtueCore Automations</h3>
      <ul>
        <li>New Facebook Lead → Create pipeline entry in VirtueCore</li>
        <li>Invoice Paid in Stripe → Update invoice status</li>
        <li>Task completed → Notify client via message</li>
      </ul>
    `,
    quiz_questions: [],
  },
]

// ── Views ─────────────────────────────────────────────────────────────────────
const VIEW = { LIST: 'list', DETAIL: 'detail', QUIZ: 'quiz', RESULTS: 'results' }

export default function Academy() {
  const { profile } = useAuth()
  const [view, setView] = useState(VIEW.LIST)
  const [selectedModule, setSelectedModule] = useState(null)
  const [completions, setCompletions] = useState({}) // { moduleId: { score, completed } }
  const [quizState, setQuizState] = useState(null)
  // quizState: { currentQ: number, answers: {qId: optionId}, finished: false }

  const totalModules = DEMO_ACADEMY_MODULES.length
  const completedCount = Object.values(completions).filter((c) => c.completed).length
  const overallPct = Math.round((completedCount / totalModules) * 100)

  // ── Navigate to module detail ───────────────────────────────────────────────
  function openModule(mod) {
    setSelectedModule(mod)
    setView(VIEW.DETAIL)
    setQuizState(null)
  }

  // ── Start quiz ──────────────────────────────────────────────────────────────
  function startQuiz() {
    setQuizState({ currentQ: 0, answers: {}, finished: false })
    setView(VIEW.QUIZ)
  }

  // ── Answer a question ───────────────────────────────────────────────────────
  function selectAnswer(qId, optionId) {
    if (quizState.answers[qId]) return // already answered
    setQuizState((prev) => ({ ...prev, answers: { ...prev.answers, [qId]: optionId } }))
  }

  // ── Next question ───────────────────────────────────────────────────────────
  function nextQuestion() {
    const questions = selectedModule.quiz_questions
    if (quizState.currentQ < questions.length - 1) {
      setQuizState((prev) => ({ ...prev, currentQ: prev.currentQ + 1 }))
    } else {
      // Calculate score
      const correct = questions.filter(
        (q) => quizState.answers[q.id] === q.correct_option_id
      ).length
      const score = Math.round((correct / questions.length) * 100)
      const passed = score >= 70

      // Save completion
      const newCompletion = { score, completed: passed }
      setCompletions((prev) => ({ ...prev, [selectedModule.id]: newCompletion }))
      setQuizState((prev) => ({ ...prev, finished: true, score, correct, total: questions.length, passed }))

      // Persist to Supabase if not demo mode
      if (!isDemoMode && profile?.id) {
        supabase.from('module_completions').upsert({
          va_id: profile.id,
          module_id: selectedModule.id,
          score,
          completed: passed,
          completed_at: passed ? new Date().toISOString() : null,
        }, { onConflict: 'va_id,module_id' })
      }

      setView(VIEW.RESULTS)
    }
  }

  // ── Retake quiz ─────────────────────────────────────────────────────────────
  function retakeQuiz() {
    startQuiz()
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  if (view === VIEW.QUIZ && selectedModule && quizState) {
    const questions = selectedModule.quiz_questions
    const q = questions[quizState.currentQ]
    const answered = quizState.answers[q.id]
    const isCorrect = answered === q.correct_option_id

    return (
      <div className="p-6 max-w-2xl space-y-6">
        {/* Header */}
        <div>
          <button
            onClick={() => setView(VIEW.DETAIL)}
            className="flex items-center gap-1 text-sm text-vc-muted hover:text-vc-text mb-3 transition-colors"
          >
            <ChevronLeft size={14} /> Back to module
          </button>
          <h1 className="text-xl font-semibold text-vc-text">{selectedModule.title}</h1>
          <p className="text-sm text-vc-muted mt-0.5">
            Question {quizState.currentQ + 1} of {questions.length}
          </p>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-vc-border">
          <div
            className="h-full bg-gold transition-all duration-300"
            style={{ width: `${((quizState.currentQ + 1) / questions.length) * 100}%` }}
          />
        </div>

        {/* Question */}
        <div className="border border-vc-border p-6">
          <p className="text-base font-medium text-vc-text mb-5">{q.question}</p>

          <div className="space-y-2">
            {q.options.map((opt) => {
              let style = 'border border-vc-border text-vc-text hover:bg-vc-secondary'
              if (answered) {
                if (opt.id === q.correct_option_id) {
                  style = 'border border-green-400 bg-green-50 text-green-800'
                } else if (opt.id === answered && answered !== q.correct_option_id) {
                  style = 'border border-red-400 bg-red-50 text-red-800'
                } else {
                  style = 'border border-vc-border text-vc-muted'
                }
              }

              return (
                <button
                  key={opt.id}
                  onClick={() => selectAnswer(q.id, opt.id)}
                  disabled={!!answered}
                  className={`w-full text-left px-4 py-3 text-sm transition-colors flex items-center gap-3 ${style} ${!answered ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  <span className="w-6 h-6 border border-current rounded flex items-center justify-center text-xs font-medium flex-shrink-0 uppercase">
                    {opt.id}
                  </span>
                  {opt.text}
                </button>
              )
            })}
          </div>

          {/* Explanation */}
          {answered && q.explanation && (
            <div className={`mt-4 p-3 text-sm border ${isCorrect ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
              <span className="font-medium">{isCorrect ? 'Correct. ' : 'Incorrect. '}</span>
              {q.explanation}
            </div>
          )}
        </div>

        {/* Next */}
        {answered && (
          <div className="flex justify-end">
            <button
              onClick={nextQuestion}
              className="flex items-center gap-2 bg-gold hover:bg-amber-600 text-white text-sm px-5 py-2.5 transition-colors"
            >
              {quizState.currentQ < questions.length - 1 ? 'Next question' : 'See results'}
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    )
  }

  if (view === VIEW.RESULTS && quizState?.finished) {
    const { score, correct, total, passed } = quizState

    return (
      <div className="p-6 max-w-lg space-y-6">
        <button
          onClick={() => setView(VIEW.LIST)}
          className="flex items-center gap-1 text-sm text-vc-muted hover:text-vc-text transition-colors"
        >
          <ChevronLeft size={14} /> Back to modules
        </button>

        <div className="border border-vc-border p-8 text-center space-y-4">
          <div className={`w-14 h-14 mx-auto flex items-center justify-center ${passed ? 'bg-green-100' : 'bg-red-50'}`}>
            <Trophy size={26} className={passed ? 'text-green-600' : 'text-red-500'} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-vc-text">{score}%</h2>
            <p className="text-sm text-vc-muted mt-0.5">
              {correct} out of {total} correct
            </p>
          </div>
          <div className={`inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 ${passed ? 'bg-green-100 text-green-800' : 'bg-red-50 text-red-700'}`}>
            {passed ? (
              <>
                <CheckCircle size={14} />
                Passed — module complete
              </>
            ) : (
              <>
                <Circle size={14} />
                Not passed — 70% required
              </>
            )}
          </div>
          <p className="text-sm text-vc-muted">
            {passed
              ? 'Well done! This module is now marked as complete in your progress.'
              : "Don't worry — review the material and try again."}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={retakeQuiz}
            className="flex items-center gap-2 border border-vc-border text-vc-text text-sm px-4 py-2 hover:bg-vc-secondary transition-colors"
          >
            <RotateCcw size={14} />
            Retake quiz
          </button>
          <button
            onClick={() => setView(VIEW.LIST)}
            className="flex items-center gap-2 bg-gold hover:bg-amber-600 text-white text-sm px-4 py-2 transition-colors"
          >
            Back to modules
          </button>
        </div>
      </div>
    )
  }

  if (view === VIEW.DETAIL && selectedModule) {
    const completion = completions[selectedModule.id]
    const hasQuiz = selectedModule.quiz_questions.length > 0

    return (
      <div className="p-6 max-w-2xl space-y-6">
        <div>
          <button
            onClick={() => setView(VIEW.LIST)}
            className="flex items-center gap-1 text-sm text-vc-muted hover:text-vc-text mb-3 transition-colors"
          >
            <ChevronLeft size={14} /> Back to modules
          </button>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold text-vc-text">{selectedModule.title}</h1>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs text-vc-muted flex items-center gap-1">
                  <Clock size={12} />
                  {selectedModule.estimated_minutes} min
                </span>
                {completion?.completed && (
                  <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                    <CheckCircle size={12} />
                    Completed — {completion.score}%
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Video placeholder */}
        <div className="border border-vc-border bg-vc-secondary flex items-center justify-center h-44">
          {selectedModule.video_url ? (
            <video src={selectedModule.video_url} controls className="w-full h-full" />
          ) : (
            <div className="text-center">
              <div className="w-12 h-12 bg-vc-border flex items-center justify-center mx-auto mb-2">
                <Play size={20} className="text-vc-muted ml-0.5" />
              </div>
              <p className="text-sm text-vc-muted">Video coming soon</p>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="border border-vc-border p-5">
          <h2 className="text-sm font-medium text-vc-text mb-3">Module Overview</h2>
          <p className="text-sm text-vc-muted mb-4">{selectedModule.description}</p>
          {selectedModule.content_html && (
            <div
              className="text-sm text-vc-text prose-sm space-y-2 [&_h3]:font-semibold [&_h3]:text-vc-text [&_h3]:mt-4 [&_h3]:mb-1 [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:space-y-1 [&_li]:text-vc-muted [&_p]:text-vc-muted [&_strong]:text-vc-text"
              dangerouslySetInnerHTML={{ __html: selectedModule.content_html }}
            />
          )}
        </div>

        {/* Quiz CTA */}
        {hasQuiz ? (
          <div className="border border-vc-border p-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-vc-text">Module Quiz</p>
              <p className="text-xs text-vc-muted mt-0.5">
                {selectedModule.quiz_questions.length} questions · Pass mark: 70%
              </p>
            </div>
            <button
              onClick={startQuiz}
              className="flex items-center gap-2 bg-gold hover:bg-amber-600 text-white text-sm px-4 py-2 transition-colors"
            >
              {completion?.completed ? (
                <>
                  <RotateCcw size={14} />
                  Retake quiz
                </>
              ) : (
                <>
                  <Play size={14} />
                  Take quiz
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="border border-vc-border p-5 bg-vc-secondary">
            <p className="text-sm text-vc-muted">No quiz for this module — mark as complete when you have reviewed the content.</p>
          </div>
        )}
      </div>
    )
  }

  // ── Module list view ────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-vc-text">VirtueCore Academy</h1>
        <p className="text-sm text-vc-muted mt-0.5">Your training hub — complete all modules to qualify for advanced client assignments</p>
      </div>

      {/* Overall progress */}
      <div className="border border-vc-border p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-vc-text">Overall progress</span>
          <span className="text-sm font-semibold text-vc-text">{completedCount}/{totalModules} modules complete</span>
        </div>
        <div className="h-2 bg-vc-border">
          <div className="h-full bg-gold transition-all duration-500" style={{ width: `${overallPct}%` }} />
        </div>
        <p className="text-xs text-vc-muted mt-1">{overallPct}% complete</p>
      </div>

      {/* Module list */}
      <div className="space-y-2">
        {DEMO_ACADEMY_MODULES.map((mod) => {
          const completion = completions[mod.id]
          const isComplete = completion?.completed
          const score = completion?.score

          return (
            <button
              key={mod.id}
              onClick={() => openModule(mod)}
              className="w-full border border-vc-border p-4 text-left hover:bg-vc-secondary transition-colors"
            >
              <div className="flex items-start gap-3">
                {/* Status icon */}
                <div className="mt-0.5 flex-shrink-0">
                  {isComplete ? (
                    <CheckCircle size={18} className="text-green-500" />
                  ) : (
                    <Circle size={18} className="text-vc-border" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className={`text-sm font-medium ${isComplete ? 'text-vc-muted' : 'text-vc-text'}`}>
                      {mod.title}
                    </p>
                    {isComplete && score !== undefined && (
                      <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 font-medium">
                        {score}%
                      </span>
                    )}
                    {mod.quiz_questions.length > 0 && (
                      <Badge variant="default" size="xs">Quiz</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-vc-muted">
                    <span className="flex items-center gap-1">
                      <Clock size={11} />
                      {mod.estimated_minutes} min
                    </span>
                    {mod.quiz_questions.length > 0 && (
                      <span>{mod.quiz_questions.length} questions</span>
                    )}
                  </div>
                </div>

                <ChevronRight size={16} className="text-vc-muted flex-shrink-0 mt-0.5" />
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
