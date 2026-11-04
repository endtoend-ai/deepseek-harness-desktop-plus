'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import type { QaConnectionTestResponse, QaModelConfigResponse } from '@llmwiki/contracts'
import { getQaModelConfig, testQaModelConnection } from '../lib/qa'
import {
  DEFAULT_MODEL_PREFERENCES,
  loadModelPreferences,
  saveModelPreferences,
  type ModelPreferences,
} from '../lib/model-settings'
import {
  CheckCircleIcon,
  LayersIcon,
  QaIcon,
  SettingsIcon,
  SpinnerIcon,
} from './Icons'

const FALLBACK_MODELS: QaModelConfigResponse['models'] = [
  {
    id: 'deepseek-v4-flash',
    label: 'V4 Flash',
    description: 'Low latency and high throughput for everyday knowledge Q&A and summarization',
  },
  {
    id: 'deepseek-v4-pro',
    label: 'V4 Pro',
    description: 'Stronger reasoning for complex policy analysis and multi-step judgement',
  },
]

function sourceLabel(source: QaModelConfigResponse['credentialSource'] | undefined) {
  if (source === 'credentials-file') return 'Credential file'
  if (source === 'environment') return 'Environment variable'
  return 'Not configured'
}

export function SettingsView() {
  const [config, setConfig] = useState<QaModelConfigResponse | null>(null)
  const [preferences, setPreferences] = useState<ModelPreferences>(DEFAULT_MODEL_PREFERENCES)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<QaConnectionTestResponse | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const localPreferences = loadModelPreferences()
    setPreferences(localPreferences)

    void getQaModelConfig()
      .then((remoteConfig) => {
        setConfig(remoteConfig)
        setError(null)
        if (!localStorage.getItem('llmwiki-qa-model-preferences')) {
          setPreferences(current => ({ ...current, model: remoteConfig.defaultModel }))
        }
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : 'Failed to read the model configuration')
      })
      .finally(() => setLoading(false))
  }, [])

  const models = config?.models ?? FALLBACK_MODELS
  const selectedModel = useMemo(
    () => models.find(model => model.id === preferences.model) ?? models[0],
    [models, preferences.model],
  )

  const update = <Key extends keyof ModelPreferences>(
    key: Key,
    value: ModelPreferences[Key],
  ) => {
    setSaved(false)
    setTestResult(null)
    setPreferences(current => ({ ...current, [key]: value }))
  }

  const save = () => {
    try {
      setPreferences(saveModelPreferences(preferences))
      setSaved(true)
      window.setTimeout(() => setSaved(false), 2200)
    } catch {
      setError('The browser could not save settings. Check local storage permissions.')
    }
  }

  const testConnection = async () => {
    setTesting(true)
    setTestResult(null)
    setError(null)
    try {
      const normalized = saveModelPreferences(preferences)
      setPreferences(normalized)
      setTestResult(await testQaModelConnection(normalized.model))
    } catch (cause) {
      setTestResult({
        ok: false,
        provider: 'deepseek',
        model: preferences.model,
        latencyMs: 0,
        message: cause instanceof Error ? cause.message : 'Model verification failed',
      })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="settings-scope">
      <header className="settings-heading">
        <div className="settings-title-row">
          <span className="settings-title-icon"><SettingsIcon /></span>
          <div>
            <h1>Settings</h1>
            <p>Manage the model service and generation parameters used by agent question answering</p>
          </div>
        </div>
        <Link href="/ask" className="settings-ask-link">
          <QaIcon />Open question answering<span>→</span>
        </Link>
      </header>

      <section className="settings-provider-card">
        <div className="settings-provider-main">
          <span className="settings-provider-mark">DS</span>
          <div>
            <div className="settings-provider-title">
              <h2>DeepSeek model service</h2>
              <span className={config?.configured ? 'is-online' : ''}>
                <i />{loading ? 'Checking' : config?.configured ? 'Ready' : 'Awaiting credentials'}
              </span>
            </div>
            <p>{config?.endpoint ?? 'Reading the service endpoint…'}</p>
          </div>
        </div>
        <div className="settings-provider-facts">
          <div><small>Credential</small><strong>{config?.credentialLabel ?? 'Checking'}</strong><em>{sourceLabel(config?.credentialSource)}</em></div>
          <div><small>Current model</small><strong>{selectedModel?.label ?? 'General chat'}</strong><em>{preferences.model}</em></div>
          <div><small>Knowledge data</small><strong>{config?.knowledgeStore.engine ?? 'SQLite'}</strong><em>{config ? `${config.knowledgeStore.pages} pages · ${config.knowledgeStore.chunks} segments` : 'Syncing'}</em></div>
        </div>
      </section>

      <main className="settings-grid">
        <section className="settings-panel settings-model-panel">
          <div className="settings-section-head">
            <div><span>01</span><h2>Choose a model</h2></div>
            <small>Applies to agent question answering after selection</small>
          </div>

          <div className="settings-model-list">
            {models.map((model, index) => {
              const active = preferences.model === model.id
              return (
                <button
                  key={model.id}
                  type="button"
                  className={active ? 'is-active' : ''}
                  onClick={() => update('model', model.id)}
                >
                  <span className="settings-model-index">0{index + 1}</span>
                  <span className="settings-model-copy">
                    <strong>{model.label}</strong>
                    <code>{model.id}</code>
                    <small>{model.description}</small>
                  </span>
                  <span className="settings-model-radio">{active ? '✓' : ''}</span>
                </button>
              )
            })}
          </div>

          <div className="settings-mode-row">
            <div><strong>Answer mode</strong><small>Local retrieval stays available when the model is down</small></div>
            <div className="settings-switcher">
              <button
                type="button"
                className={preferences.generationMode === 'deepseek' ? 'is-active' : ''}
                onClick={() => update('generationMode', 'deepseek')}
              >Model-assisted</button>
              <button
                type="button"
                className={preferences.generationMode === 'local' ? 'is-active' : ''}
                onClick={() => update('generationMode', 'local')}
              >Local retrieval only</button>
            </div>
          </div>
        </section>

        <section className="settings-panel settings-parameters-panel">
          <div className="settings-section-head">
            <div><span>02</span><h2>Generation parameters</h2></div>
            <small>Sent with every question request</small>
          </div>

          <label>
            <div><strong>Temperature</strong><small>Lower values make answers more stable</small></div>
            <div className="settings-range-row">
              <input
                type="range"
                min="0"
                max="1.5"
                step="0.1"
                value={preferences.temperature}
                onChange={event => update('temperature', Number(event.target.value))}
              />
              <output>{preferences.temperature.toFixed(1)}</output>
            </div>
          </label>

          <label>
            <div><strong>Maximum output length</strong><small>Caps how much a single answer may generate</small></div>
            <div className="settings-range-row">
              <input
                type="range"
                min="256"
                max="4096"
                step="128"
                value={preferences.maxTokens}
                onChange={event => update('maxTokens', Number(event.target.value))}
              />
              <output>{preferences.maxTokens}</output>
            </div>
          </label>

          <div className="settings-security-note">
            <span>⌾</span>
            <div><strong>The key is held server-side</strong><small>The browser reads redacted status only; no request or page ever returns the plaintext key.</small></div>
          </div>
        </section>
      </main>

      <section className="settings-verification">
        <div className="settings-verification-copy">
          <span className="settings-verify-icon"><LayersIcon /></span>
          <div>
            <h2>Model availability check</h2>
            <p>The check runs one minimal real inference with the selected model instead of only validating the endpoint or key format.</p>
          </div>
        </div>

        <div className="settings-checks" aria-label="Model verification steps">
          <span className={config ? 'is-done' : ''}><i>1</i>Read config</span>
          <b />
          <span className={config?.configured ? 'is-done' : ''}><i>2</i>Load credentials</span>
          <b />
          <span className={testResult?.ok ? 'is-done' : testing ? 'is-running' : ''}><i>3</i>Call model</span>
          <b />
          <span className={testResult?.ok ? 'is-done' : ''}><i>4</i>Return result</span>
        </div>

        {(error || testResult) && (
          <div className={`settings-result ${testResult?.ok ? 'is-ok' : 'is-error'}`} role="status">
            {testResult?.ok ? <CheckCircleIcon /> : <span>!</span>}
            <div>
              <strong>{testResult?.message ?? error}</strong>
              <small>{testResult ? `${testResult.model} · ${testResult.latencyMs} ms · real inference` : 'Check whether the API service is running'}</small>
            </div>
          </div>
        )}

        <div className="settings-actions">
          <span>{saved ? '✓ Saved and synced to question answering' : 'Parameters stay in this browser; the key remains server-side'}</span>
          <div>
            <button type="button" className="settings-save-button" onClick={save}>Save</button>
            <button type="button" className="settings-test-button" onClick={testConnection} disabled={testing || !config?.configured}>
              {testing ? <><SpinnerIcon />Calling the model</> : 'Verify current model'}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
