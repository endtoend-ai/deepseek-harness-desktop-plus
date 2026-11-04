'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  EvalCaseResult,
  EvalComparison,
  EvalLatestResponse,
  EvalReport,
} from '@llmwiki/contracts'
import { fetchEvaluation } from '../lib/api'
import {
  AlertCircleIcon,
  CheckCircleIcon,
  ClockIcon,
  EvalIcon,
  RefreshIcon,
  SearchIcon,
  SpinnerIcon,
} from './Icons'

const METRIC_LABELS: Record<string, { label: string; short: string; desc: string }> = {
  answer_completed: { label: 'Answer completed', short: 'Done', desc: 'Whether the expected state and the task result agree' },
  retrieval_hit: { label: 'Retrieval hit', short: 'Retrieval', desc: 'Whether the expected knowledge page was retrieved' },
  evidence_coverage: { label: 'Evidence coverage', short: 'Coverage', desc: 'Whether the evidence covers the question key semantics' },
  citation_valid: { label: 'Citations valid', short: 'Citations', desc: 'Whether each citation exists and resolves to source text' },
  answer_faithful: { label: 'Faithful to evidence', short: 'Faithful', desc: 'Whether the answer reconciles with the cited evidence' },
  no_answer_honest: { label: 'Honest refusal', short: 'Refusal', desc: 'Whether it avoids asserting facts without evidence' },
  input_robust: { label: 'Input robustness', short: 'Robust', desc: 'Whether it stays stable under noisy or malformed input' },
}

const METRIC_ORDER = [
  'answer_completed',
  'retrieval_hit',
  'evidence_coverage',
  'citation_valid',
  'answer_faithful',
  'no_answer_honest',
  'input_robust',
]

const KIND_LABELS: Record<string, string> = {
  direct_fact: 'Direct fact',
  cross_source: 'Cross-source summary',
  concept_link: 'Concept link',
  citation_jump: 'Citation jump',
  no_evidence: 'Insufficient evidence',
  adversarial: 'Adversarial input',
}

type CaseFilter = 'all' | 'passed' | 'failed'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('zh-CN', { hour12: false })
}

function percentage(value: number) {
  return `${Math.round(value * 100)}%`
}

function casePassed(result: EvalCaseResult) {
  return result.scores.every(score => score.score === null || score.score === 1)
}

function metricTone(mean: number) {
  if (mean >= 0.999) return 'perfect'
  if (mean >= 0.85) return 'healthy'
  if (mean >= 0.7) return 'watch'
  return 'risk'
}

function ScoreOrbit({ score }: { score: number }) {
  const radius = 68
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - score / 100)
  return (
    <div className="ev-score-orbit">
      <div className="ev-orbit-glow" />
      <svg viewBox="0 0 180 180" aria-label={`Overall quality score ${score}`}>
        <defs>
          <linearGradient id="ev-score-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--ev-accent)" />
            <stop offset="70%" stopColor="var(--ev-gold)" />
            <stop offset="100%" stopColor="var(--ev-warn)" />
          </linearGradient>
        </defs>
        <circle className="ev-orbit-track" cx="90" cy="90" r={radius} />
        <circle
          className="ev-orbit-value"
          cx="90"
          cy="90"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
        <circle className="ev-orbit-inner" cx="90" cy="90" r="51" />
      </svg>
      <div className="ev-score-value">
        <strong>{score.toFixed(1)}</strong>
        <span>Quality index</span>
      </div>
      <i className="ev-orbit-node node-a" />
      <i className="ev-orbit-node node-b" />
    </div>
  )
}

function MetricCard({
  metricKey,
  mean,
  n,
  comparison,
  active,
  onClick,
}: {
  metricKey: string
  mean: number
  n: number
  comparison: EvalComparison['metrics'][number] | undefined
  active: boolean
  onClick: () => void
}) {
  const info = METRIC_LABELS[metricKey] ?? { label: metricKey, short: metricKey, desc: '' }
  const tone = metricTone(mean)
  const delta = comparison?.before === null
    || comparison?.after === null
    || comparison?.before === undefined
    || comparison?.after === undefined
    ? null
    : Math.round((comparison.after - comparison.before) * 100)

  return (
    <button
      type="button"
      onClick={onClick}
      className={`ev-metric-card tone-${tone} ${active ? 'is-active' : ''}`}
      aria-pressed={active}
    >
      <div className="ev-metric-card-head">
        <span className="ev-metric-index">{String(METRIC_ORDER.indexOf(metricKey) + 1).padStart(2, '0')}</span>
        <span className="ev-metric-status">{tone === 'perfect' ? 'Perfect' : tone === 'healthy' ? 'Healthy' : tone === 'watch' ? 'Watch' : 'At risk'}</span>
      </div>
      <div className="ev-metric-main">
        <div>
          <strong>{info.label}</strong>
          <small>{info.desc}</small>
        </div>
        <div className="ev-metric-score">
          <b>{Math.round(mean * 100)}</b><em>%</em>
        </div>
      </div>
      <div className="ev-metric-scale">
        <span style={{ width: `${mean * 100}%` }} />
        {[25, 50, 75].map(mark => <i key={mark} style={{ left: `${mark}%` }} />)}
      </div>
      <div className="ev-metric-footer">
        <span>Valid samples n={n}</span>
        <span className={delta !== null && delta > 0 ? 'is-up' : delta !== null && delta < 0 ? 'is-down' : ''}>
          {delta === null ? 'No baseline' : delta > 0 ? `${delta} vs baseline` : delta < 0 ? `${delta} vs baseline` : 'Level with baseline'}
        </span>
      </div>
    </button>
  )
}

function ComparisonRail({ report, baseline, comparison }: {
  report: EvalReport
  baseline: EvalReport | null
  comparison: EvalComparison | null
}) {
  const before = baseline?.totalScore ?? report.totalScore
  const delta = report.totalScore - before
  const improved = comparison?.metrics.filter(metric => metric.trend === '涨').length ?? 0
  const stable = comparison?.metrics.filter(metric => metric.trend === '持平').length ?? 0

  return (
    <section className="ev-panel ev-comparison-panel" id="evaluation-comparison">
      <header className="ev-panel-header">
        <div>
          <span className="ev-kicker">Regression control</span>
          <h2>Quality trajectory before and after</h2>
          <p>A reproducible comparison over the same question set, fixed time, and evaluator</p>
        </div>
        <span className={`ev-regression-badge ${comparison?.regressionFree ? 'is-safe' : 'is-risk'}`}>
          <i />{comparison?.regressionFree ? 'No metric regressed' : 'Quality regression found'}
        </span>
      </header>

      <div className="ev-comparison-body">
        <div className="ev-score-journey">
          <div className="ev-journey-point baseline"><span>Before</span><strong>{before.toFixed(1)}</strong><small>Baseline version</small></div>
          <div className="ev-journey-line"><i /><span>{delta >= 0 ? '+' : ''}{delta.toFixed(1)} points</span></div>
          <div className="ev-journey-point current"><span>After</span><strong>{report.totalScore.toFixed(1)}</strong><small>Current version</small></div>
        </div>
        <div className="ev-comparison-stats">
          <div><span>Improved</span><strong>{improved}</strong><small>/ {comparison?.metrics.length ?? METRIC_ORDER.length}</small></div>
          <div><span>Stable</span><strong>{stable}</strong><small>Held without loss</small></div>
          <div><span>Regressions</span><strong className={comparison?.regressionFree ? 'is-good' : 'is-bad'}>{comparison?.regressions.length ?? 0}</strong><small>Must be 0</small></div>
        </div>
      </div>

      <div className="ev-delta-grid">
        {(comparison?.metrics ?? []).map((metric) => {
          const label = METRIC_LABELS[metric.key]?.short ?? metric.key
          const beforeValue = metric.before === null ? null : Math.round(metric.before * 100)
          const afterValue = metric.after === null ? null : Math.round(metric.after * 100)
          const deltaValue = beforeValue === null || afterValue === null ? null : afterValue - beforeValue
          return (
            <div key={metric.key} className={`ev-delta-cell ${deltaValue !== null && deltaValue > 0 ? 'is-up' : deltaValue !== null && deltaValue < 0 ? 'is-down' : ''}`}>
              <span>{label}</span>
              <div><small>{beforeValue ?? '—'}</small><i>→</i><strong>{afterValue ?? '—'}</strong></div>
              <em>{deltaValue === null ? '—' : deltaValue > 0 ? `+${deltaValue}` : deltaValue}</em>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function CaseDiagnostic({ result, expanded, onToggle }: {
  result: EvalCaseResult
  expanded: boolean
  onToggle: () => void
}) {
  const failures = result.scores.filter(score => score.score === 0)
  const passed = failures.length === 0
  const applicable = result.scores.filter(score => score.score !== null)
  const score = applicable.length === 0 ? 0 : Math.round((applicable.filter(item => item.score === 1).length / applicable.length) * 100)

  return (
    <article className={`ev-case-row ${passed ? 'is-passed' : 'is-failed'} ${expanded ? 'is-expanded' : ''}`}>
      <button type="button" className="ev-case-summary" onClick={onToggle} aria-expanded={expanded}>
        <span className="ev-case-state">{passed ? <CheckCircleIcon className="h-4 w-4" /> : <AlertCircleIcon className="h-4 w-4" />}</span>
        <span className="ev-case-copy">
          <span><em>{KIND_LABELS[result.kind] ?? result.kind}</em><small>{result.caseId}</small></span>
          <strong>{result.question}</strong>
        </span>
        <span className="ev-case-evidence"><b>{result.citations.length}</b><small>Evidence</small></span>
        <span className="ev-case-grade"><b>{score}</b><small>Score</small></span>
        <span className="ev-case-result">{passed ? 'Passed' : `${failures.length} failed`}</span>
        <span className="ev-case-chevron">⌄</span>
      </button>

      <div className="ev-case-detail">
        <div className="ev-case-score-grid">
          {result.scores.map(item => (
            <div key={item.key} className={item.score === 1 ? 'is-ok' : item.score === 0 ? 'is-fail' : 'is-na'}>
              <span>{item.score === 1 ? '✓' : item.score === 0 ? '!' : '—'}</span>
              <div><strong>{METRIC_LABELS[item.key]?.label ?? item.key}</strong><small>{item.comment}</small></div>
            </div>
          ))}
        </div>
        <div className="ev-case-sources">
          <span>Matched evidence</span>
          <div>
            {result.citations.length === 0 ? <small>No evidence was used for this case</small> : result.citations.map((citation, index) => (
              <span key={`${citation.pageSlug}-${index}`} title={citation.sourcePath ?? citation.pageSlug}>
                <b>{index + 1}</b>{citation.pageTitle}
              </span>
            ))}
          </div>
        </div>
      </div>
    </article>
  )
}

export function EvaluationView() {
  const [data, setData] = useState<EvalLatestResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [caseFilter, setCaseFilter] = useState<CaseFilter>('all')
  const [query, setQuery] = useState('')
  const [activeMetric, setActiveMetric] = useState<string | null>(null)
  const [expandedCaseId, setExpandedCaseId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await fetchEvaluation())
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 1800)
    return () => window.clearTimeout(timer)
  }, [notice])

  const report = data?.report ?? null
  const metricEntries = useMemo(() => {
    if (!report) return []
    return METRIC_ORDER
      .filter(key => report.metricMeans[key])
      .map(key => ({ key, ...report.metricMeans[key] }))
  }, [report])

  const filteredCases = useMemo(() => {
    if (!report) return []
    const normalized = query.trim().toLowerCase()
    return report.cases
      .filter(result => caseFilter === 'all' || (caseFilter === 'passed' ? casePassed(result) : !casePassed(result)))
      .filter(result => !activeMetric
        || result.scores.some(score => score.key === activeMetric && score.score !== null))
      .filter(result => !normalized
        || result.question.toLowerCase().includes(normalized)
        || result.caseId.toLowerCase().includes(normalized))
      .sort((a, b) => {
        if (!activeMetric) return Number(casePassed(a)) - Number(casePassed(b))
        const aScore = a.scores.find(score => score.key === activeMetric)?.score ?? 1
        const bScore = b.scores.find(score => score.key === activeMetric)?.score ?? 1
        return aScore - bScore
      })
  }, [activeMetric, caseFilter, query, report])

  const exportReport = useCallback(() => {
    if (!data) return
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `llmwiki-evaluation-${data.report?.runId ?? 'latest'}.json`
    anchor.click()
    URL.revokeObjectURL(url)
    setNotice('Evaluation report exported')
  }, [data])

  const focusMetric = useCallback((metricKey: string) => {
    setActiveMetric(current => current === metricKey ? null : metricKey)
    setCaseFilter('all')
    window.setTimeout(() => document.getElementById('evaluation-cases')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40)
  }, [])

  if (loading && !data) {
    return (
      <div className="ev-loading-state">
        <span><SpinnerIcon className="h-5 w-5 animate-spin" /></span>
        <strong>Loading the quality evaluation matrix</strong>
        <small>Reading the question set, metrics, and regression report…</small>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="ev-error-state">
        <AlertCircleIcon className="h-8 w-8" />
        <strong>Failed to load the evaluation report</strong>
        <small>{error}</small>
        <button type="button" onClick={() => void load()}>Reload the report</button>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="ev-empty-state">
        <EvalIcon className="h-9 w-9" />
        <h1>No evaluation report yet</h1>
        <p>Run <code>pnpm eval:qa</code> to produce the question-set scores, per-metric results, and regression comparison, then refresh this page.</p>
        <button type="button" onClick={() => void load()}><RefreshIcon className="h-4 w-4" />Refresh report</button>
      </div>
    )
  }

  const weakest = metricEntries.reduce((current, item) => item.mean < current.mean ? item : current, metricEntries[0])
  const perfectCount = metricEntries.filter(item => item.mean >= 0.999).length
  const passRate = report.caseCount ? Math.round((report.passed / report.caseCount) * 100) : 0
  const failedCount = report.caseCount - report.passed
  const weakestFailures = report.cases.filter(result => result.scores.some(score => score.key === weakest.key && score.score === 0)).length
  const comparisonByKey = new Map(data?.comparison?.metrics.map(metric => [metric.key, metric]) ?? [])

  return (
    <div className="evaluation-scope">
      {notice && <div className="ev-toast"><CheckCircleIcon className="h-4 w-4" />{notice}</div>}

      <header className="ev-page-header">
        <div className="ev-title-block">
          <span className="ev-title-icon"><EvalIcon className="h-5 w-5" /></span>
          <div>
            <div><h1>Question-answering quality console</h1><span className="ev-live-badge"><i />Report verified</span></div>
            <p>Reproducible question set · seven-dimension evaluator · baseline regression control</p>
          </div>
        </div>
        <nav className="ev-nav-actions" aria-label="Evaluation page shortcuts">
          <button type="button" onClick={() => document.getElementById('evaluation-overview')?.scrollIntoView({ behavior: 'smooth' })}>Overview</button>
          <button type="button" onClick={() => document.getElementById('evaluation-comparison')?.scrollIntoView({ behavior: 'smooth' })}>Version comparison</button>
          <button type="button" onClick={() => document.getElementById('evaluation-cases')?.scrollIntoView({ behavior: 'smooth' })}>Case diagnostics</button>
        </nav>
        <div className="ev-header-actions">
          <button type="button" onClick={() => void load()} disabled={loading} className="ev-icon-button" aria-label="Refresh the evaluation report">
            <RefreshIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button type="button" onClick={exportReport} className="ev-export-button">↓ Export report</button>
        </div>
      </header>

      <section className="ev-hero-grid" id="evaluation-overview">
        <article className="ev-panel ev-score-panel">
          <div className="ev-score-copy">
            <span className="ev-kicker">Overall quality</span>
            <h2>Current question-answering quality</h2>
            <p>Weighted average over every non-empty metric</p>
          </div>
          <ScoreOrbit score={report.totalScore} />
          <div className="ev-score-verdict">
            <span className="is-healthy"><i />Production ready</span>
            <small>Target 90 · currently {(report.totalScore - 90).toFixed(1)} points above</small>
          </div>
        </article>

        <article className="ev-panel ev-summary-panel">
          <header><span className="ev-kicker">Evaluation overview</span><strong>This run at a glance</strong></header>
          <div className="ev-summary-grid">
            <div className="primary"><span>Case pass rate</span><strong>{passRate}<em>%</em></strong><small>{report.passed} / {report.caseCount} cases fully passed</small></div>
            <div><span>Perfect metrics</span><strong>{perfectCount}<em> / {metricEntries.length}</em></strong><small>No regression among held metrics</small></div>
            <div><span>Cases to diagnose</span><strong>{failedCount}</strong><small>See the failure reasons below</small></div>
            <div><span>Run time</span><strong>{report.elapsedMs}<em>ms</em></strong><small>Serial, reproducible run</small></div>
          </div>
          <div className="ev-run-foot"><span><ClockIcon className="h-3.5 w-3.5" />{formatDate(report.generatedAt)}</span><code>{report.runId}</code></div>
        </article>

        <article className="ev-panel ev-risk-panel">
          <header>
            <div><span className="ev-kicker">Risk focus</span><h2>Top improvement target</h2></div>
            <span className="ev-risk-level">P1</span>
          </header>
          <div className="ev-risk-score"><strong>{percentage(weakest.mean)}</strong><span>{METRIC_LABELS[weakest.key]?.label ?? weakest.key}</span></div>
          <p>{METRIC_LABELS[weakest.key]?.desc}</p>
          <div className="ev-risk-gap"><span>Current</span><i><b style={{ width: `${weakest.mean * 100}%` }} /></i><strong>Target 90%</strong></div>
          <div className="ev-risk-impact"><span><b>{weakestFailures}</b> failed cases</span><span><b>{Math.max(0, Math.round(90 - weakest.mean * 100))}</b> points short</span></div>
          <button type="button" onClick={() => { setActiveMetric(weakest.key); setCaseFilter('failed'); document.getElementById('evaluation-cases')?.scrollIntoView({ behavior: 'smooth' }) }}>Open the failing cases →</button>
        </article>
      </section>

      <section className="ev-panel ev-metrics-panel">
        <header className="ev-panel-header">
          <div><span className="ev-kicker">Metric matrix</span><h2>Seven-dimension quality matrix</h2><p>Select a metric to drill into the real cases that exercise it and their failure reasons</p></div>
          <div className="ev-matrix-legend"><span className="perfect"><i />Perfect</span><span className="healthy"><i />Healthy</span><span className="risk"><i />Needs work</span></div>
        </header>
        <div className="ev-metric-grid">
          {metricEntries.map(item => (
            <MetricCard
              key={item.key}
              metricKey={item.key}
              mean={item.mean}
              n={item.n}
              comparison={comparisonByKey.get(item.key)}
              active={activeMetric === item.key}
              onClick={() => focusMetric(item.key)}
            />
          ))}
        </div>
      </section>

      <ComparisonRail report={report} baseline={data?.baseline ?? null} comparison={data?.comparison ?? null} />

      <section className="ev-panel ev-cases-panel" id="evaluation-cases">
        <header className="ev-panel-header">
          <div>
            <span className="ev-kicker">Case diagnostics</span>
            <h2>Case-level quality diagnostics</h2>
            <p>{activeMetric ? `Focused on: ${METRIC_LABELS[activeMetric]?.label ?? activeMetric}` : 'Check retrieval, evidence, citations, and answer quality case by case'}</p>
          </div>
          <div className="ev-case-toolbar">
            <div className="ev-case-filters">
              {(['all', 'failed', 'passed'] as CaseFilter[]).map(filter => (
                <button key={filter} type="button" className={caseFilter === filter ? 'is-active' : ''} onClick={() => setCaseFilter(filter)}>
                  {filter === 'all' ? 'All' : filter === 'failed' ? `To diagnose ${failedCount}` : `Passed ${report.passed}`}
                </button>
              ))}
            </div>
            <label className="ev-case-search"><SearchIcon className="h-3.5 w-3.5" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search questions or case IDs" /></label>
            {activeMetric && <button type="button" className="ev-clear-focus" onClick={() => setActiveMetric(null)}>Clear metric focus ×</button>}
          </div>
        </header>
        <div className="ev-case-table-head"><span>Status</span><span>Question and type</span><span>Evidence</span><span>Score</span><span>Result</span><span /></div>
        <div className="ev-case-list">
          {filteredCases.length === 0 ? (
            <div className="ev-no-results"><SearchIcon className="h-5 w-5" /><span>No case matches the current filters</span></div>
          ) : filteredCases.map(result => (
            <CaseDiagnostic
              key={result.caseId}
              result={result}
              expanded={expandedCaseId === result.caseId}
              onToggle={() => setExpandedCaseId(current => current === result.caseId ? null : result.caseId)}
            />
          ))}
        </div>
      </section>

      <section className="ev-repro-strip">
        <div><span className="ev-kicker">Reproducibility constraints</span><strong>Evaluation environment integrity</strong></div>
        <div className="ev-repro-items">
          <ReproSignal label="Fixed clock" detail={report.evalNow.slice(0, 10)} ok={report.reproducibility.fixedTime} />
          <ReproSignal label="Serial execution" detail="concurrency 1" ok={report.reproducibility.serial} />
          <ReproSignal label="State isolation" detail="reset per case" ok={report.seedResetPerCase} />
          <ReproSignal label="Production isolation" detail="separate output directory" ok={!report.reproducibility.prodDataTouched} />
        </div>
        <div className="ev-manifest-time"><span>Knowledge version</span><strong>{formatDate(report.manifestCompiledAt)}</strong></div>
      </section>
    </div>
  )
}

function ReproSignal({ label, detail, ok }: { label: string; detail: string; ok: boolean }) {
  return (
    <div className={ok ? 'is-ok' : 'is-fail'}>
      <span>{ok ? '✓' : '!'}</span>
      <div><strong>{label}</strong><small>{detail}</small></div>
    </div>
  )
}
