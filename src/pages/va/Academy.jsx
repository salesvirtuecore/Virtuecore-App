import { useState } from 'react'
import { BookOpen, CheckCircle, Circle, Clock, ChevronRight, ChevronLeft, Trophy, RotateCcw, Play } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { ACADEMY_MODULES } from '../../data/academyModules'

// ── Views ─────────────────────────────────────────────────────────────────────
const VIEW = { LIST: 'list', DETAIL: 'detail', QUIZ: 'quiz', RESULTS: 'results' }

export default function Academy() {
  const { profile } = useAuth()
  const [view, setView] = useState(VIEW.LIST)
  const [selectedModule, setSelectedModule] = useState(null)
  const [completions, setCompletions] = useState({}) // { moduleId: { score, completed } }
  const [quizState, setQuizState] = useState(null)
  // quizState: { currentQ: number, answers: {qId: optionId}, finished: false }

  const totalModules = ACADEMY_MODULES.length
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

      if (profile?.id) {
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
            className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary mb-3 transition-colors"
          >
            <ChevronLeft size={14} /> Back to module
          </button>
          <h1 className="text-h2 font-heading text-text-primary">{selectedModule.title}</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            Question {quizState.currentQ + 1} of {questions.length}
          </p>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-vc-border">
          <div
            className="h-full bg-vc-primary transition-all duration-300"
            style={{ width: `${((quizState.currentQ + 1) / questions.length) * 100}%` }}
          />
        </div>

        {/* Question */}
        <div className="border border-white/[0.06] p-6">
          <p className="text-base font-medium text-text-primary mb-5">{q.question}</p>

          <div className="space-y-2">
            {q.options.map((opt) => {
              let style = 'border border-white/[0.06] text-text-primary hover:bg-bg-tertiary'
              if (answered) {
                if (opt.id === q.correct_option_id) {
                  style = 'border border-green-400 bg-status-success/10 text-green-800'
                } else if (opt.id === answered && answered !== q.correct_option_id) {
                  style = 'border border-red-400 bg-status-danger/10 text-red-800'
                } else {
                  style = 'border border-white/[0.06] text-text-secondary'
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
            <div className={`mt-4 p-3 text-sm border ${isCorrect ? 'bg-status-success/10 border-status-success/20 text-green-800' : 'bg-status-danger/10 border-status-danger/20 text-red-800'}`}>
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
              className="flex items-center gap-2 bg-vc-primary hover:bg-amber-600 text-white text-sm px-5 py-2.5 transition-colors"
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
          className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          <ChevronLeft size={14} /> Back to modules
        </button>

        <div className="border border-white/[0.06] p-8 text-center space-y-4">
          <div className={`w-14 h-14 mx-auto flex items-center justify-center ${passed ? 'bg-status-success/10' : 'bg-status-danger/10'}`}>
            <Trophy size={26} className={passed ? 'text-status-success' : 'text-status-danger'} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-text-primary">{score}%</h2>
            <p className="text-sm text-text-secondary mt-0.5">
              {correct} out of {total} correct
            </p>
          </div>
          <div className={`inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 ${passed ? 'bg-status-success/10 text-green-800' : 'bg-status-danger/10 text-red-700'}`}>
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
          <p className="text-sm text-text-secondary">
            {passed
              ? 'Well done! This module is now marked as complete in your progress.'
              : "Don't worry — review the material and try again."}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={retakeQuiz}
            className="flex items-center gap-2 border border-white/[0.06] text-text-primary text-sm px-4 py-2 hover:bg-bg-tertiary transition-colors"
          >
            <RotateCcw size={14} />
            Retake quiz
          </button>
          <button
            onClick={() => setView(VIEW.LIST)}
            className="flex items-center gap-2 bg-vc-primary hover:bg-amber-600 text-white text-sm px-4 py-2 transition-colors"
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
            className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary mb-3 transition-colors"
          >
            <ChevronLeft size={14} /> Back to modules
          </button>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-h2 font-heading text-text-primary">{selectedModule.title}</h1>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs text-text-secondary flex items-center gap-1">
                  <Clock size={12} />
                  {selectedModule.estimated_minutes} min
                </span>
                {completion?.completed && (
                  <span className="flex items-center gap-1 text-xs text-status-success font-medium">
                    <CheckCircle size={12} />
                    Completed — {completion.score}%
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Video placeholder */}
        <div className="border border-white/[0.06] bg-bg-tertiary flex items-center justify-center h-44">
          {selectedModule.video_url ? (
            <video src={selectedModule.video_url} controls className="w-full h-full" />
          ) : (
            <div className="text-center">
              <div className="w-12 h-12 bg-vc-border flex items-center justify-center mx-auto mb-2">
                <Play size={20} className="text-text-secondary ml-0.5" />
              </div>
              <p className="text-sm text-text-secondary">Video coming soon</p>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="vc-card">
          <h2 className="text-sm font-medium text-text-primary mb-3">Module Overview</h2>
          <p className="text-sm text-text-secondary mb-4">{selectedModule.description}</p>
          {selectedModule.content_html && (
            <div
              className="text-sm text-text-primary prose-sm space-y-2 [&_h3]:font-semibold [&_h3]:text-text-primary [&_h3]:mt-4 [&_h3]:mb-1 [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:space-y-1 [&_li]:text-text-secondary [&_p]:text-text-secondary [&_strong]:text-text-primary"
              dangerouslySetInnerHTML={{ __html: selectedModule.content_html }}
            />
          )}
        </div>

        {/* Quiz CTA */}
        {hasQuiz ? (
          <div className="vc-card flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text-primary">Module Quiz</p>
              <p className="text-xs text-text-secondary mt-0.5">
                {selectedModule.quiz_questions.length} questions · Pass mark: 70%
              </p>
            </div>
            <button
              onClick={startQuiz}
              className="flex items-center gap-2 bg-vc-primary hover:bg-amber-600 text-white text-sm px-4 py-2 transition-colors"
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
          <div className="vc-card bg-bg-tertiary">
            <p className="text-sm text-text-secondary">No quiz for this module — mark as complete when you have reviewed the content.</p>
          </div>
        )}
      </div>
    )
  }

  // ── Module list view ────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-h2 font-heading text-text-primary">VirtueCore Academy</h1>
        <p className="text-sm text-text-secondary mt-0.5">Your training hub — complete all modules to qualify for advanced client assignments</p>
      </div>

      {/* Overall progress */}
      <div className="vc-card">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-text-primary">Overall progress</span>
          <span className="text-sm font-semibold text-text-primary">{completedCount}/{totalModules} modules complete</span>
        </div>
        <div className="h-2 bg-vc-border">
          <div className="h-full bg-vc-primary transition-all duration-500" style={{ width: `${overallPct}%` }} />
        </div>
        <p className="text-xs text-text-secondary mt-1">{overallPct}% complete</p>
      </div>

      {/* Module list */}
      <div className="space-y-2">
        {ACADEMY_MODULES.map((mod) => {
          const completion = completions[mod.id]
          const isComplete = completion?.completed
          const score = completion?.score

          return (
            <button
              key={mod.id}
              onClick={() => openModule(mod)}
              className="w-full vc-card text-left hover:bg-bg-tertiary transition-colors"
            >
              <div className="flex items-start gap-3">
                {/* Status icon */}
                <div className="mt-0.5 flex-shrink-0">
                  {isComplete ? (
                    <CheckCircle size={18} className="text-status-success" />
                  ) : (
                    <Circle size={18} className="text-vc-border" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className={`text-sm font-medium ${isComplete ? 'text-text-secondary' : 'text-text-primary'}`}>
                      {mod.title}
                    </p>
                    {isComplete && score !== undefined && (
                      <span className="text-xs bg-status-success/10 text-status-success px-1.5 py-0.5 font-medium">
                        {score}%
                      </span>
                    )}
                    {mod.quiz_questions.length > 0 && (
                      <Badge variant="default" size="xs">Quiz</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-text-secondary">
                    <span className="flex items-center gap-1">
                      <Clock size={11} />
                      {mod.estimated_minutes} min
                    </span>
                    {mod.quiz_questions.length > 0 && (
                      <span>{mod.quiz_questions.length} questions</span>
                    )}
                  </div>
                </div>

                <ChevronRight size={16} className="text-text-secondary flex-shrink-0 mt-0.5" />
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
