'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type {
  QaAnswer,
  QaCitation,
  QaConnectionTestResponse,
  QaFallbackItem,
  QaModelConfigResponse,
  QaModelId,
  QaResponse,
} from '@llmwiki/contracts'
import { getQaModelConfig, streamQa, testQaModelConnection } from '../lib/qa'
import {
  DEFAULT_MODEL_PREFERENCES,
  loadModelPreferences,
  MODEL_PREFS_EVENT,
  MODEL_PREFS_KEY,
  type ModelPreferences,
} from '../lib/model-settings'
import {
  AlertCircleIcon,
  CheckCircleIcon,
  DocumentIcon,
  LayersIcon,
  QaIcon,
  RefreshIcon,
  SearchIcon,
  SpinnerIcon,
  WikiIcon,
} from './Icons'

const SUGGESTIONS = [
  {
    category: 'Platform governance',
    title: 'How does the gateway handle unified authentication and rate limiting?',
    description: 'Find the API security, access control, and traffic governance rules',
    icon: '⌘',
  },
  {
    category: 'Change management',
    title: 'What process does a production change follow?',
    description: 'Walk the request, approval, release, and rollback chain',
    icon: '↗',
  },
  {
    category: 'Security response',
    title: 'How should a data leak be handled?',
    description: 'Check severity levels, response roles, and handling deadlines',
    icon: '◇',
  },
  {
    category: 'Service standards',
    title: 'How is the SLA first-response deadline defined?',
    description: 'Extract the enforceable timing rules from the service policy',
    icon: '◷',
  },
]

const HISTORY_KEY = 'llmwiki-ask-history'

type QaState = 'empty' | 'loading' | 'streaming' | 'answered' | 'no_evidence' | 'error'
type Feedback = 'up' | 'down'

interface Turn {
  id: number
  question: string
  state: QaState
  answers: QaAnswer[]
  citations: QaCitation[]
  fallback: QaFallbackItem[]
  metrics: QaResponse['metrics'] | null
  compiledAt: string | null
  confidence: QaResponse['confidence'] | null
  mode: QaResponse['mode']
  model: QaModelId | null
  providerConfigured: boolean
  generation: QaResponse['generation'] | null
  error: string | null
}

function MarkdownAnswer({
  text,
  onCite,
  litId,
}: {
  text: string
  onCite: (id: number) => void
  litId: number | null
}) {
  const markdown = text.replace(/\[(\d+)\](?!\()/g, '[$1](#cite-$1)')

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ href, children, ...props }) => {
          if (href?.startsWith('#cite-')) {
            const id = Number(href.slice(6))
            return (
              <button
                type="button"
                onClick={() => onCite(id)}
                className={`qa-cite ${litId === id ? 'qa-cite-lit' : ''}`}
                aria-label={`Locate citation ${id}`}
              >
                {id}
              </button>
            )
          }
          return (
            <a href={href} target="_blank" rel="noreferrer" {...props}>
              {children}
            </a>
          )
        },
      }}
    >
      {markdown}
    </ReactMarkdown>
  )
}

function sourceLabel(citation: QaCitation) {
  if (!citation.sourcePath) return citation.origin === 'conclusion' ? 'Page conclusion' : 'Source evidence'
  return citation.sourcePath.split('/').pop() ?? citation.sourcePath
}

function scoreLabel(score: number) {
  if (score <= 1) return `${Math.round(score * 100)}%`
  return score.toFixed(1)
}

function formatTime(value: string | null) {
  if (!value) return 'Current compiled version'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Current compiled version'
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function QaView() {
  const router = useRouter()
  const [turns, setTurns] = useState<Turn[]>([])
  const [input, setInput] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [activeTurnId, setActiveTurnId] = useState<number | null>(null)
  const [litCitationId, setLitCitationId] = useState<number | null>(null)
  const [expandedCitationId, setExpandedCitationId] = useState<number | null>(null)
  const [feedback, setFeedback] = useState<Record<number, Feedback>>({})
  const [notice, setNotice] = useState<string | null>(null)
  const [modelPanelOpen, setModelPanelOpen] = useState(false)
  const [modelConfig, setModelConfig] = useState<QaModelConfigResponse | null>(null)
  const [modelConfigError, setModelConfigError] = useState<string | null>(null)
  const [modelPreferences, setModelPreferences] = useState<ModelPreferences>(DEFAULT_MODEL_PREFERENCES)
  const [connectionTest, setConnectionTest] = useState<QaConnectionTestResponse | null>(null)
  const [testingConnection, setTestingConnection] = useState(false)
  const threadRef = useRef<HTMLDivElement>(null)
  const seqRef = useRef(0)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(HISTORY_KEY)
      if (saved) setHistory(JSON.parse(saved) as string[])
      setModelPreferences(loadModelPreferences())
    } catch {
      /* 浏览器禁用存储时仍可正常问答 */
    }

    void getQaModelConfig()
      .then((remoteConfig) => {
        setModelConfig(remoteConfig)
        setModelConfigError(null)
        if (!localStorage.getItem(MODEL_PREFS_KEY)) {
          setModelPreferences(previous => ({ ...previous, model: remoteConfig.defaultModel }))
        }
      })
      .catch((error: unknown) => {
        setModelConfigError(error instanceof Error ? error.message : 'Failed to read the model configuration')
      })
  }, [])

  useEffect(() => {
    const syncPreferences = (event: Event) => {
      const preferences = (event as CustomEvent<ModelPreferences>).detail
      setModelPreferences(preferences ?? loadModelPreferences())
    }
    window.addEventListener(MODEL_PREFS_EVENT, syncPreferences)
    return () => window.removeEventListener(MODEL_PREFS_EVENT, syncPreferences)
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(MODEL_PREFS_KEY, JSON.stringify(modelPreferences))
    } catch {
      /* ignore */
    }
  }, [modelPreferences])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 1800)
    return () => window.clearTimeout(timer)
  }, [notice])

  const pushHistory = useCallback((question: string) => {
    setHistory((previous) => {
      const next = [question, ...previous.filter(item => item !== question)].slice(0, 20)
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
      } catch {
        /* 浏览器禁用存储时仅保留当前会话 */
      }
      return next
    })
  }, [])

  const removeHistory = useCallback((question: string) => {
    setHistory((previous) => {
      const next = previous.filter(item => item !== question)
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  useEffect(() => {
    const element = threadRef.current
    if (element) element.scrollTop = element.scrollHeight
  }, [turns])

  const ask = useCallback(
    async (raw: string) => {
      const question = raw.trim()
      if (!question) return
      pushHistory(question)
      setInput('')
      setLitCitationId(null)
      setExpandedCitationId(null)

      const id = ++seqRef.current
      setActiveTurnId(id)
      setTurns(previous => [
        ...previous,
        {
          id,
          question,
          state: 'loading',
          answers: [],
          citations: [],
          fallback: [],
          metrics: null,
          compiledAt: null,
          confidence: null,
          mode: modelPreferences.generationMode === 'deepseek' ? 'deepseek-rag' : 'local-weighted-retrieval',
          model: modelPreferences.generationMode === 'deepseek' ? modelPreferences.model : null,
          providerConfigured: modelConfig?.configured ?? false,
          generation: null,
          error: null,
        },
      ])

      const patchTurn = (patch: Partial<Turn>) => {
        setTurns(previous =>
          previous.map(turn => (turn.id === id ? { ...turn, ...patch } : turn)),
        )
      }

      await streamQa(
        question,
        modelPreferences,
        (chunk) => {
          switch (chunk.type) {
            case 'meta':
              patchTurn({
                state: 'streaming',
                metrics: chunk.metrics,
                compiledAt: chunk.compiledAt,
                confidence: chunk.confidence as QaResponse['confidence'],
                mode: chunk.mode,
                model: chunk.model as QaModelId,
                providerConfigured: chunk.providerConfigured,
              })
              break
            case 'generation':
              patchTurn({ generation: chunk.generation ?? null, mode: chunk.mode })
              break
            case 'delta':
              setTurns(current =>
                current.map((turn) => {
                  if (turn.id !== id) return turn
                  const currentText = turn.answers[0]?.text ?? ''
                  return {
                    ...turn,
                    state: 'streaming',
                    answers: [{ text: currentText + chunk.text, citations: [] }],
                  }
                }),
              )
              break
            case 'answer_complete':
              patchTurn({ answers: chunk.answers })
              break
            case 'answer':
              setTurns(current =>
                current.map(turn =>
                  turn.id === id ? { ...turn, answers: [...turn.answers, chunk.answer] } : turn,
                ),
              )
              break
            case 'citations':
              patchTurn({ citations: chunk.citations, state: 'answered' })
              setExpandedCitationId(chunk.citations[0]?.id ?? null)
              break
            case 'fallback':
              patchTurn({ fallback: chunk.fallback })
              break
          }
        },
        () => {
          setTurns(current =>
            current.map((turn) => {
              if (turn.id !== id) return turn
              return {
                ...turn,
                state: turn.answers.length > 0 ? 'answered' : 'no_evidence',
              }
            }),
          )
        },
        message => patchTurn({ state: 'error', error: message }),
      )
    },
    [modelConfig?.configured, modelPreferences, pushHistory],
  )

  const openWiki = useCallback(
    (slug: string) => router.push(`/wiki?slug=${encodeURIComponent(slug)}`),
    [router],
  )

  const activeTurn = useMemo(
    () => turns.find(turn => turn.id === activeTurnId) ?? turns.at(-1) ?? null,
    [activeTurnId, turns],
  )
  const isBusy = turns.some(turn => turn.state === 'loading' || turn.state === 'streaming')

  const focusCitation = useCallback((turnId: number, citationId: number) => {
    setActiveTurnId(turnId)
    setExpandedCitationId(citationId)
    setLitCitationId(citationId)
    window.setTimeout(() => {
      document
        .getElementById(`qa-source-${turnId}-${citationId}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 40)
    window.setTimeout(() => setLitCitationId(null), 2400)
  }, [])

  const copyAnswer = useCallback(async (turn: Turn) => {
    try {
      await navigator.clipboard.writeText(turn.answers.map(answer => answer.text).join('\n\n'))
      setNotice('Answer copied')
    } catch {
      setNotice('Copy failed. Try again.')
    }
  }, [])

  const vote = useCallback((turnId: number, value: Feedback) => {
    setFeedback((previous) => {
      const next = { ...previous }
      if (previous[turnId] === value) delete next[turnId]
      else next[turnId] = value
      return next
    })
    setNotice(value === 'up' ? 'Recorded: this answer helped' : 'Recorded: needs improvement')
  }, [])

  const startNew = useCallback(() => {
    setTurns([])
    setActiveTurnId(null)
    setLitCitationId(null)
    setExpandedCitationId(null)
    setInput('')
  }, [])

  const runConnectionTest = useCallback(async () => {
    setTestingConnection(true)
    setConnectionTest(null)
    try {
      const result = await testQaModelConnection(modelPreferences.model)
      setConnectionTest(result)
    } catch (error) {
      setConnectionTest({
        ok: false,
        provider: 'deepseek',
        model: modelPreferences.model,
        latencyMs: 0,
        message: error instanceof Error ? error.message : 'Connection test failed',
      })
    } finally {
      setTestingConnection(false)
    }
  }, [modelPreferences.model])

  return (
    <div className="qa-scope relative overflow-hidden rounded-[22px] p-3 sm:p-4">
      {notice && (
        <div className="qa-toast" role="status">
          <CheckCircleIcon className="h-4 w-4" />
          {notice}
        </div>
      )}

      {modelPanelOpen && (
        <div className="qa-model-overlay" role="presentation" onMouseDown={() => setModelPanelOpen(false)}>
          <section
            className="qa-model-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="qa-model-panel-title"
            onMouseDown={event => event.stopPropagation()}
          >
            <header>
              <div>
                <span className="qa-model-logo">DS</span>
                <div>
                  <h2 id="qa-model-panel-title">Model connection and generation</h2>
                  <p>The backend credential store holds the key; the browser never sees it in plaintext</p>
                </div>
              </div>
              <button type="button" onClick={() => setModelPanelOpen(false)} aria-label="Close model settings">×</button>
            </header>

            <div className="qa-provider-card">
              <div className="qa-provider-identity">
                <span className="qa-model-logo compact">DS</span>
                <div><strong>DeepSeek API</strong><small>{modelConfig?.endpoint ?? 'Reading configuration…'}</small></div>
              </div>
              <span className={`qa-provider-state ${modelConfig?.configured ? 'is-online' : ''}`}>
                <i />{modelConfig?.configured ? 'Credentials loaded' : 'Awaiting credentials'}
              </span>
              <div className="qa-credential-row">
                <span>API Key</span><code>{modelConfig?.credentialLabel ?? 'Checking'}</code>
                <em>{modelConfig?.credentialSource === 'credentials-file' ? 'Credential store' : modelConfig?.credentialSource === 'environment' ? 'Environment variable' : 'Not configured'}</em>
              </div>
              <div className="qa-store-row">
                <span><i />Knowledge data layer</span>
                <strong>{modelConfig?.knowledgeStore.engine ?? 'SQLite'}</strong>
                <em>{modelConfig ? `${modelConfig.knowledgeStore.pages} pages · ${modelConfig.knowledgeStore.chunks} evidence segments` : 'Syncing knowledge data'}</em>
                <b>{modelConfig?.knowledgeStore.persistent ? 'Persistent' : 'In-memory'}</b>
              </div>
            </div>

            <div className="qa-model-form">
              <label>
                <span>Answer mode<small>Decides whether the model is called</small></span>
                <div className="qa-segmented-control">
                  <button
                    type="button"
                    className={modelPreferences.generationMode === 'deepseek' ? 'is-active' : ''}
                    onClick={() => setModelPreferences(previous => ({ ...previous, generationMode: 'deepseek' }))}
                  >DeepSeek RAG</button>
                  <button
                    type="button"
                    className={modelPreferences.generationMode === 'local' ? 'is-active' : ''}
                    onClick={() => setModelPreferences(previous => ({ ...previous, generationMode: 'local' }))}
                  >Local retrieval</button>
                </div>
              </label>

              <label>
                <span>Model<small>Chosen by question complexity</small></span>
                <select
                  value={modelPreferences.model}
                  onChange={event => setModelPreferences(previous => ({ ...previous, model: event.target.value as QaModelId }))}
                  disabled={modelPreferences.generationMode === 'local'}
                >
                  {(modelConfig?.models ?? [
                    { id: 'deepseek-v4-flash' as const, label: 'DeepSeek V4 Flash', description: '' },
                    { id: 'deepseek-v4-pro' as const, label: 'DeepSeek V4 Pro', description: '' },
                  ]).map(model => <option key={model.id} value={model.id}>{model.label}</option>)}
                </select>
              </label>

              <label>
                <span>Temperature<small>Lower is steadier and better for knowledge Q&A</small></span>
                <div className="qa-temperature-control">
                  <input
                    type="range"
                    min="0"
                    max="1.5"
                    step="0.1"
                    value={modelPreferences.temperature}
                    disabled={modelPreferences.generationMode === 'local'}
                    onChange={event => setModelPreferences(previous => ({ ...previous, temperature: Number(event.target.value) }))}
                  />
                  <code>{modelPreferences.temperature.toFixed(1)}</code>
                </div>
              </label>

              <label>
                <span>Maximum output<small>Caps the length of one answer</small></span>
                <div className="qa-temperature-control">
                  <input
                    type="range"
                    min="256"
                    max="4096"
                    step="128"
                    value={modelPreferences.maxTokens}
                    disabled={modelPreferences.generationMode === 'local'}
                    onChange={event => setModelPreferences(previous => ({ ...previous, maxTokens: Number(event.target.value) }))}
                  />
                  <code>{modelPreferences.maxTokens}</code>
                </div>
              </label>
            </div>

            {modelConfigError && <div className="qa-config-message is-error">{modelConfigError}</div>}
            {connectionTest && (
              <div className={`qa-config-message ${connectionTest.ok ? 'is-ok' : 'is-error'}`}>
                <span>{connectionTest.ok ? '✓' : '!'}</span>
                <div><strong>{connectionTest.message}</strong><small>{connectionTest.latencyMs > 0 ? `${connectionTest.latencyMs} ms` : 'Check the backend configuration'}</small></div>
              </div>
            )}

            <footer>
              <p><i />The model may read only the evidence segments this retrieval matched</p>
              <div>
                <button type="button" className="qa-test-button" onClick={runConnectionTest} disabled={testingConnection}>
                  {testingConnection ? <SpinnerIcon className="h-4 w-4 animate-spin" /> : 'Test connection'}
                </button>
                <button type="button" className="qa-save-button" onClick={() => setModelPanelOpen(false)}>Apply</button>
              </div>
            </footer>
          </section>
        </div>
      )}

      <header className="qa-workspace-header">
        <div className="flex min-w-0 items-center gap-3">
          <div className="qa-brand-mark">
            <QaIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="qa-ink text-lg font-semibold tracking-tight">Knowledge Q&A workbench</h1>
              <span className="qa-status-dot"><i />Retrieval online</span>
            </div>
            <p className="qa-faint mt-0.5 truncate text-[13px]">Answer from the enterprise knowledge base with conclusions and source evidence linked both ways</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="qa-stat-pill"><strong>47</strong> pages</span>
          <span className="qa-stat-pill"><strong>98</strong> citations</span>
          <span className="qa-stat-pill"><strong>3,210</strong> relations</span>
          <button type="button" onClick={() => setModelPanelOpen(true)} className="qa-model-trigger">
            <span className="qa-model-trigger-mark">DS</span>
            <span><strong>{modelPreferences.generationMode === 'deepseek' ? modelPreferences.model : 'Local retrieval'}</strong><small>{modelConfig?.configured ? 'DeepSeek connected' : 'Check model settings'}</small></span>
            <em>⌄</em>
          </button>
          <button type="button" onClick={startNew} className="qa-primary-button">
            <span>＋</span> New chat
          </button>
        </div>
      </header>

      <div className="qa-workspace-grid">
        <aside className="qa-panel qa-history-panel">
          <div className="qa-section-heading">
            <div>
              <span className="qa-ink">Recent questions</span>
              <small>{history.length} entries</small>
            </div>
          </div>

          <div className="qa-history-list">
            {history.length === 0 ? (
              <div className="qa-empty-compact">
                <QaIcon className="h-5 w-5" />
                <span>Sessions are saved automatically once you ask</span>
              </div>
            ) : (
              history.map((item, index) => (
                <div key={`${item}-${index}`} className="qa-history-item">
                  <button type="button" onClick={() => ask(item)} title={item}>
                    <span className="qa-history-index">{String(index + 1).padStart(2, '0')}</span>
                    <span className="min-w-0 flex-1">
                      <strong>{item}</strong>
                      <small>{index === 0 ? 'Just now' : 'Earlier question'}</small>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeHistory(item)}
                    className="qa-history-remove"
                    aria-label={`Remove history entry: ${item}`}
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="qa-space-card">
            <div className="flex items-center gap-2">
              <WikiIcon className="h-4 w-4" />
              <span>Current knowledge space</span>
            </div>
            <strong>LLM Wiki knowledge base</strong>
            <div className="qa-space-metrics">
              <span><b>128</b> documents</span>
              <span><b>6</b> domains</span>
            </div>
            <div className="qa-freshness"><i />Knowledge index synced</div>
          </div>
        </aside>

        <main className="qa-panel qa-conversation-panel">
          <div className="qa-conversation-bar">
            <div>
              <span className="qa-ink text-[15px] font-semibold">
                {activeTurn ? 'Knowledge assistant' : 'Start a traceable Q&A turn'}
              </span>
              <span className="qa-faint ml-2 text-[13px]">
                {activeTurn ? formatTime(activeTurn.compiledAt) : 'RAG · retrieval-augmented generation'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" className="qa-mode-pill" onClick={() => setModelPanelOpen(true)}>
                <i />{activeTurn?.mode === 'deepseek-rag' ? activeTurn.model : activeTurn?.mode === 'local-fallback' ? 'Model fallback' : modelPreferences.generationMode === 'deepseek' ? modelPreferences.model : 'Local retrieval'}
              </button>
              {activeTurn?.confidence && (
                <span className="qa-confidence-pill">{activeTurn.confidence === 'high' ? 'High' : activeTurn.confidence === 'medium' ? 'Medium' : 'Low'} confidence</span>
              )}
            </div>
          </div>

          <div ref={threadRef} className="qa-thread" aria-live="polite">
            {turns.length === 0 && (
              <div className="qa-launcher">
                <div className="qa-launcher-title">
                  <span className="qa-launcher-orbit"><SearchIcon className="h-6 w-6" /></span>
                  <div>
                    <h2>What would you like to learn from the knowledge base?</h2>
                    <p>Pick a question to see how the system retrieves, filters, and organizes trustworthy evidence.</p>
                  </div>
                </div>

                <div className="qa-suggestion-grid">
                  {SUGGESTIONS.map(suggestion => (
                    <button
                      key={suggestion.title}
                      type="button"
                      onClick={() => ask(suggestion.title)}
                      className="qa-suggestion-card"
                    >
                      <span className="qa-suggestion-icon">{suggestion.icon}</span>
                      <span className="min-w-0 flex-1">
                        <small>{suggestion.category}</small>
                        <strong>{suggestion.title}</strong>
                        <em>{suggestion.description}</em>
                      </span>
                      <span className="qa-suggestion-arrow">→</span>
                    </button>
                  ))}
                </div>

                <div className="qa-capability-strip">
                  <span><SearchIcon className="h-4 w-4" /><b>Weighted retrieval</b><small>Field weights plus segment recall</small></span>
                  <span><LayersIcon className="h-4 w-4" /><b>Evidence reranking</b><small>Filter segments by relevance</small></span>
                  <span><DocumentIcon className="h-4 w-4" /><b>Model generation</b><small>DeepSeek answers from the evidence</small></span>
                </div>
              </div>
            )}

            {turns.map(turn => (
              <section key={turn.id} className="qa-turn" onClick={() => setActiveTurnId(turn.id)}>
                <div className="qa-user-row">
                  <div className="qa-user-message">{turn.question}</div>
                  <div className="qa-user-avatar">You</div>
                </div>

                <div className="qa-answer-row">
                  <div className="qa-assistant-avatar"><QaIcon className="h-4 w-4" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="qa-answer-meta">
                      <div>
                        <strong>Knowledge assistant</strong>
                        <span>{turn.mode === 'deepseek-chat' ? 'General chat' : 'From compiled knowledge assets'}</span>
                      </div>
                      {(turn.generation || (turn.metrics && turn.mode !== 'deepseek-chat')) && (
                        <div className="flex items-center gap-2">
                          {turn.generation && (
                            <span className={`qa-generation-chip ${turn.mode === 'deepseek-rag' || turn.mode === 'deepseek-chat' ? 'is-model' : 'is-local'}`}>
                              {turn.mode === 'deepseek-rag' || turn.mode === 'deepseek-chat' ? `${turn.generation.model} · ${(turn.generation.latencyMs / 1000).toFixed(1)}s` : 'Local fallback'}
                            </span>
                          )}
                          {turn.metrics && turn.mode !== 'deepseek-chat' && (
                            <div className="qa-result-metrics">
                              <span>Scanned <b>{turn.metrics.searched}</b></span>
                              <span>Matched <b>{turn.metrics.matched}</b></span>
                              <span>Used <b>{turn.metrics.adopted}</b></span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {turn.state === 'loading' && (
                      <div className="qa-searching-state">
                        <SpinnerIcon className="h-4 w-4 animate-spin" />
                        Searching related segments across knowledge pages…
                      </div>
                    )}

                    {turn.state === 'error' && (
                      <div className="qa-error-state">
                        <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                        <div>
                          <p>{turn.error ?? 'The question request failed'}</p>
                          <button type="button" onClick={() => ask(turn.question)}>Search again</button>
                        </div>
                      </div>
                    )}

                    {turn.generation?.fallbackReason && turn.mode === 'local-fallback' && (
                      <div className="qa-model-fallback">
                        <AlertCircleIcon className="h-3.5 w-3.5" />
                        DeepSeek did not finish generating; the traceable local retrieval result follows: {turn.generation.fallbackReason}
                      </div>
                    )}

                    {(turn.state === 'streaming' || turn.state === 'answered') && turn.answers.length > 0 && (
                      <div className="qa-answer-body">
                        {turn.answers.map((answer, index) => (
                          <div key={index} className="qa-markdown">
                            <MarkdownAnswer
                              text={answer.text}
                              onCite={citationId => focusCitation(turn.id, citationId)}
                              litId={activeTurn?.id === turn.id ? litCitationId : null}
                            />
                            {!/\[\d+\]/.test(answer.text) && answer.citations.length > 0 && (
                              <span className="qa-answer-references">
                                {answer.citations.map(citationId => (
                                  <button
                                    key={citationId}
                                    type="button"
                                    onClick={() => focusCitation(turn.id, citationId)}
                                    className={`qa-cite ${activeTurn?.id === turn.id && litCitationId === citationId ? 'qa-cite-lit' : ''}`}
                                    aria-label={`Locate citation ${citationId}`}
                                  >
                                    {citationId}
                                  </button>
                                ))}
                              </span>
                            )}
                          </div>
                        ))}
                        {turn.state === 'streaming' && <span className="qa-stream-caret" />}
                      </div>
                    )}

                    {turn.state === 'no_evidence' && (
                      <div className="qa-no-evidence-state">
                        <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                        <div>
                          <strong>Evidence is insufficient for a definite conclusion</strong>
                          <p>The closest pages are still listed on the right; narrow or reword the question and search again.</p>
                        </div>
                      </div>
                    )}

                    {turn.state === 'answered' && (
                      <div className="space-y-3">
                        <div className="qa-answer-actions">
                          <button type="button" onClick={() => copyAnswer(turn)}>Copy answer</button>
                          <button type="button" onClick={() => ask(turn.question)}>
                            <RefreshIcon className="h-3.5 w-3.5" />Search again
                          </button>
                          <span className="qa-action-divider" />
                          <span>Was this answer helpful?</span>
                          <button
                            type="button"
                            className={feedback[turn.id] === 'up' ? 'is-selected' : ''}
                            onClick={() => vote(turn.id, 'up')}
                            aria-label="Answer was helpful"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className={feedback[turn.id] === 'down' ? 'is-selected' : ''}
                            onClick={() => vote(turn.id, 'down')}
                            aria-label="Answer needs improvement"
                          >
                            ↓
                          </button>
                        </div>
                        <div className="qa-followups">
                          <span>Keep asking</span>
                          <button type="button" onClick={() => ask(`${turn.question} Please turn this into an actionable checklist.`)}>Make a checklist</button>
                          <button type="button" onClick={() => ask(`${turn.question} Which risk points are easiest to miss?`)}>List the risk points</button>
                          <button type="button" onClick={() => ask(`${turn.question} What are the responsibilities and deadlines?`)}>Check responsibilities</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            ))}
          </div>

          <div className="qa-composer-wrap">
            <div className="qa-composer">
              <SearchIcon className="qa-faint h-4 w-4 shrink-0" />
              <textarea
                value={input}
                onChange={event => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    if (!isBusy) void ask(input)
                  }
                }}
                rows={1}
                placeholder={isBusy ? 'Processing the current question…' : 'Ask a question. Enter sends; Shift + Enter adds a line'}
                disabled={isBusy}
                aria-label="Ask the knowledge base"
              />
              <div className="qa-composer-tools">
                <span>Knowledge base</span>
                <button
                  type="button"
                  onClick={() => ask(input)}
                  disabled={!input.trim() || isBusy}
                  aria-label="Send question"
                >
                  {isBusy ? <SpinnerIcon className="h-4 w-4 animate-spin" /> : '↑'}
                </button>
              </div>
            </div>
            <p>Answers use verifiable material only · click a citation number to locate its evidence</p>
          </div>
        </main>

        <aside className="qa-panel qa-evidence-panel">
          <div className="qa-section-heading qa-evidence-heading">
            <div>
              <span className="qa-ink">Evidence workspace</span>
              <small>{activeTurn ? `Question #${activeTurn.id}` : 'Awaiting retrieval'}</small>
            </div>
            <span className="qa-evidence-count">{activeTurn?.citations.length ?? 0} used</span>
          </div>

          <div className="qa-evidence-summary">
            <div><span>Scanned</span><strong>{activeTurn?.metrics?.searched ?? 47} pages</strong></div>
            <div><span>Matched</span><strong>{activeTurn?.metrics?.matched ?? 0} segments</strong></div>
            <div><span>Evidence used</span><strong>{activeTurn?.metrics?.adopted ?? 0} items</strong></div>
          </div>

          <div className="qa-evidence-list">
            {!activeTurn && (
              <div className="qa-evidence-empty">
                <span className="qa-evidence-radar"><i /><i /><i /><SearchIcon className="h-5 w-5" /></span>
                <strong>Waiting for a retrieval</strong>
                <p>After you ask, the source evidence the system used appears here in relevance order.</p>
                <div>
                  <span>Citation locate</span><span>Confidence tiers</span><span>Source jump</span>
                </div>
              </div>
            )}

            {activeTurn?.citations.map((citation) => {
              const expanded = expandedCitationId === citation.id
              const highlighted = litCitationId === citation.id
              return (
                <article
                  id={`qa-source-${activeTurn.id}-${citation.id}`}
                  key={`${activeTurn.id}-${citation.id}`}
                  className={`qa-source-card ${highlighted ? 'is-highlighted' : ''} ${expanded ? 'is-expanded' : ''}`}
                >
                  <button
                    type="button"
                    className="qa-source-card-main"
                    onClick={() => {
                      setExpandedCitationId(expanded ? null : citation.id)
                      setLitCitationId(citation.id)
                    }}
                    aria-expanded={expanded}
                  >
                    <span className="qa-source-number">{citation.id}</span>
                    <span className="min-w-0 flex-1">
                      <span className="qa-source-kicker">
                        <b>{citation.origin === 'evidence' ? 'Source evidence' : 'Page conclusion'}</b>
                        <em>{citation.confidence === 'high' ? 'High confidence' : citation.confidence === 'medium' ? 'Medium confidence' : 'Low confidence'}</em>
                      </span>
                      <strong className="qa-source-title">{citation.pageTitle}</strong>
                      <small>{sourceLabel(citation)}</small>
                    </span>
                    <span className="qa-source-score">{scoreLabel(citation.score)}</span>
                  </button>
                  <div className="qa-source-snippet">
                    <p>{citation.snippet}</p>
                    <div>
                      <span>{citation.pageType}</span>
                      <button type="button" onClick={() => openWiki(citation.pageSlug)}>Open the Wiki page →</button>
                    </div>
                  </div>
                </article>
              )
            })}

            {activeTurn?.state === 'no_evidence' && activeTurn.fallback.map((item, index) => (
              <button
                key={`${item.pageSlug}-${index}`}
                type="button"
                onClick={() => openWiki(item.pageSlug)}
                className="qa-fallback-card"
              >
                <span>{String(index + 1).padStart(2, '0')}</span>
                <span><strong>{item.pageTitle}</strong><small>{item.summary}</small></span>
                <em>→</em>
              </button>
            ))}
          </div>

          <div className="qa-evidence-footer">
            <span><i />Evidence comes from the current compiled knowledge base</span>
            <small>
              {activeTurn?.generation?.provider === 'deepseek'
                ? `${activeTurn.generation.totalTokens ?? '—'} tokens · ${activeTurn.generation.latencyMs} ms`
                : formatTime(activeTurn?.compiledAt ?? null)}
            </small>
          </div>
        </aside>
      </div>
    </div>
  )
}
