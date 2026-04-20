import React, { useState, useEffect } from 'react'
import { Sparkles, ChevronRight, Loader2, CheckCircle2,
         BookOpen, Video, Code2, FileQuestion, Layers,
         RefreshCw, X, Wand2, LayoutList } from 'lucide-react'
import { useAICopilot, tryParseJSON } from '../../hooks/use-ai-copilot.js'
import { aiCopilotApi, courseApi } from '../../lib/api.js'
import type { Curriculum, ModuleStub, LessonStub } from '../../../../api/src/modules/ai-copilot/agents/curriculum-agent.js'

// ── Content type icons ────────────────────────────────────────────────────────

const CONTENT_ICONS: Record<string, React.ReactNode> = {
  TEXT:         <BookOpen size={14} />,
  VIDEO:        <Video size={14} />,
  CODE_SANDBOX: <Code2 size={14} />,
  QUIZ:         <FileQuestion size={14} />,
  SLIDE_DECK:   <Layers size={14} />,
}

// ── Copilot Studio ────────────────────────────────────────────────────────────

export function CopilotStudio() {
  const [step, setStep] = useState<'prompt' | 'generating' | 'review' | 'saving'>('prompt')
  const [form, setForm]       = useState({ title: '', description: '', audience: '', requirements: '' })
  const [curriculum, setCurriculum] = useState<Curriculum | null>(null)
  const [selectedModule, setSelectedModule] = useState<number>(0)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle')

  const { state, stream, reset } = useAICopilot()

  // Parse curriculum as JSON streams in
  useEffect(() => {
    if (state.raw.length > 100) {
      const parsed = tryParseJSON<Curriculum>(state.raw)
      if (parsed) setCurriculum(parsed)
    }
    if (state.status === 'done' && state.raw) {
      const parsed = tryParseJSON<Curriculum>(state.raw)
      if (parsed) {
        setCurriculum(parsed)
        setStep('review')
      }
    }
  }, [state.raw, state.status])

  const handleGenerate = async () => {
    if (!form.title.trim() || !form.description.trim()) return
    setStep('generating')
    setCurriculum(null)
    reset()
    await stream('generate-curriculum', form)
  }

  const handleSave = async () => {
    if (!curriculum) return
    setSaveStatus('saving')
    setStep('saving')
    try {
      await courseApi.create({
        title:          curriculum.title,
        description:    curriculum.description,
        level:          curriculum.level,
        estimatedHours: curriculum.estimatedHours,
        tags:           curriculum.tags,
        objectives:     curriculum.objectives,
        prerequisites:  curriculum.prerequisites,
        modules:        curriculum.modules,
      })
      setSaveStatus('done')
    } catch {
      setSaveStatus('error')
      setStep('review')
    }
  }

  const handleReset = () => {
    reset()
    setCurriculum(null)
    setStep('prompt')
    setSaveStatus('idle')
    setSelectedModule(0)
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Wand2 size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">AI Copilot Studio</h1>
            <p className="text-xs text-gray-500">Generate a full course with AI</p>
          </div>
        </div>
        {step !== 'prompt' && (
          <button onClick={handleReset} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
            <RefreshCw size={14} />
            Start over
          </button>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden flex">

        {/* ── Prompt step ── */}
        {step === 'prompt' && (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="w-full max-w-2xl">
              <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-3 py-1.5 rounded-full text-sm font-medium mb-4">
                  <Sparkles size={14} />
                  Powered by AI
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Describe your course
                </h2>
                <p className="text-gray-500 dark:text-gray-400">
                  AI will generate a complete curriculum with modules, lessons, quizzes, and media suggestions.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Course title <span className="text-red-500">*</span>
                  </label>
                  <input
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                    placeholder="e.g. Teleoperator Fundamentals for Robotic Arm Control"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={4}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition resize-none"
                    placeholder="What will students learn? What problem does this course solve?"
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Target audience
                    </label>
                    <input
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                      placeholder="e.g. Robot operators, beginners"
                      value={form.audience}
                      onChange={(e) => setForm((f) => ({ ...f, audience: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Special requirements
                    </label>
                    <input
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                      placeholder="e.g. Include safety modules"
                      value={form.requirements}
                      onChange={(e) => setForm((f) => ({ ...f, requirements: e.target.value }))}
                    />
                  </div>
                </div>

                <button
                  disabled={!form.title.trim() || !form.description.trim()}
                  onClick={handleGenerate}
                  className="w-full py-3 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  <Sparkles size={18} />
                  Generate course curriculum
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Generating step ── */}
        {step === 'generating' && (
          <div className="flex-1 flex flex-col p-6 gap-4 overflow-auto">
            {/* Progress bar */}
            <div className="flex items-center gap-3">
              <Loader2 size={18} className="text-indigo-500 animate-spin flex-shrink-0" />
              <div className="flex-1">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-700 dark:text-gray-300 font-medium">
                    {state.progress < 20 ? 'Designing curriculum...' :
                     state.progress < 50 ? 'Building modules...' :
                     state.progress < 80 ? 'Writing lessons...' : 'Finalizing content...'}
                  </span>
                  <span className="text-gray-500">{state.progress}%</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-bar-fill" style={{ width: `${state.progress}%` }} />
                </div>
              </div>
            </div>

            {/* Live preview */}
            {curriculum && (
              <LiveCurriculumPreview curriculum={curriculum} isStreaming />
            )}

            {/* Raw JSON stream (collapsed) */}
            {!curriculum && state.raw && (
              <div className="code-block text-xs max-h-96 overflow-auto">
                <span className="text-indigo-400">// Generating...</span>
                <br />
                <span className="text-green-300 stream-chunk">{state.raw}</span>
                <span className="ai-cursor" />
              </div>
            )}
          </div>
        )}

        {/* ── Review step ── */}
        {(step === 'review' || step === 'saving') && curriculum && (
          <div className="flex-1 flex overflow-hidden">
            {/* Module sidebar */}
            <div className="w-72 border-r border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden">
              <div className="p-4 border-b border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                  <LayoutList size={12} />
                  {curriculum.modules.length} modules · {curriculum.modules.reduce((a, m) => a + m.lessons.length, 0)} lessons
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm leading-tight">
                  {curriculum.title}
                </h3>
                <div className="flex items-center gap-2 mt-2">
                  <span className="badge badge-blue">{curriculum.level}</span>
                  <span className="badge badge-gray">{curriculum.estimatedHours}h</span>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {curriculum.modules.map((mod, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedModule(i)}
                    className={`w-full text-left p-3 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${selectedModule === i ? 'bg-indigo-50 dark:bg-indigo-900/20 border-l-2 border-l-indigo-500' : ''}`}
                  >
                    <div className="text-xs text-gray-400 mb-0.5">Module {i + 1}</div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white leading-tight">
                      {mod.title}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{mod.lessons.length} lessons</div>
                  </button>
                ))}
              </div>

              {/* Save button */}
              <div className="p-4 border-t border-gray-200 dark:border-gray-800">
                <button
                  onClick={handleSave}
                  disabled={step === 'saving' || saveStatus === 'done'}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  {saveStatus === 'saving' ? <><Loader2 size={14} className="animate-spin" /> Saving...</> :
                   saveStatus === 'done'   ? <><CheckCircle2 size={14} /> Saved!</> :
                   <><CheckCircle2 size={14} /> Create course</>}
                </button>
              </div>
            </div>

            {/* Module detail */}
            <div className="flex-1 overflow-y-auto p-6">
              {curriculum.modules[selectedModule] && (
                <ModuleDetail
                  module={curriculum.modules[selectedModule]!}
                  moduleIndex={selectedModule}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function LiveCurriculumPreview({ curriculum, isStreaming }: { curriculum: Curriculum; isStreaming?: boolean }) {
  return (
    <div className="card p-5 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 dark:text-white">{curriculum.title}</h3>
        {isStreaming && <span className="badge badge-blue animate-pulse">Live preview</span>}
      </div>
      {curriculum.description && (
        <p className="text-sm text-gray-600 dark:text-gray-400">{curriculum.description}</p>
      )}
      <div className="space-y-2">
        {curriculum.modules?.map((mod, i) => (
          <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
            <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
              {i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 dark:text-white">{mod.title}</div>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {mod.lessons?.map((l, j) => (
                  <span key={j} className="flex items-center gap-0.5 badge badge-gray text-xs">
                    {CONTENT_ICONS[l.contentType] ?? <BookOpen size={10} />}
                    {l.title}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ModuleDetail({ module, moduleIndex }: { module: ModuleStub; moduleIndex: number }) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <div className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">
          Module {moduleIndex + 1}
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">{module.title}</h2>
        {module.description && (
          <p className="text-gray-600 dark:text-gray-400 mt-2 text-sm">{module.description}</p>
        )}
      </div>

      <div className="space-y-3">
        {module.lessons.map((lesson, i) => (
          <LessonCard key={i} lesson={lesson} index={i} />
        ))}
      </div>
    </div>
  )
}

function LessonCard({ lesson, index }: { lesson: LessonStub; index: number }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="card overflow-hidden">
      <button
        className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-left"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 flex-shrink-0">
          {CONTENT_ICONS[lesson.contentType] ?? <BookOpen size={16} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Lesson {index + 1}</span>
            <span className="badge badge-gray">{lesson.contentType.replace('_', ' ')}</span>
            {lesson.hasQuiz && <span className="badge badge-purple">Quiz</span>}
            <span className="badge badge-gray ml-auto">{lesson.estimatedMinutes}min</span>
          </div>
          <div className="text-sm font-medium text-gray-900 dark:text-white mt-0.5">{lesson.title}</div>
        </div>
        <ChevronRight size={16} className={`text-gray-400 transition-transform flex-shrink-0 ${expanded ? 'rotate-90' : ''}`} />
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-800 pt-3 space-y-3 animate-slide-up">
          <p className="text-sm text-gray-600 dark:text-gray-400">{lesson.description}</p>
          {lesson.objectives?.length > 0 && (
            <div>
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Learning objectives
              </div>
              <ul className="space-y-1">
                {lesson.objectives.map((obj, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <CheckCircle2 size={14} className="text-green-500 flex-shrink-0 mt-0.5" />
                    {obj}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
