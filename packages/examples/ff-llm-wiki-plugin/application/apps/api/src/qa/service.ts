import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type {
  QaAnswer,
  QaModelConfigResponse,
  QaModelId,
  QaRequest,
  QaResponse,
} from '@llmwiki/contracts'
import type { WikiManifest } from '../wiki/compiler.js'
import { ensureWikiCompiled } from '../wiki/service.js'
import { WIKI_DIR } from '../wiki/paths.js'
import { DeepSeekClient, type DeepSeekRuntimeConfig } from './deepseek.js'
import { retrieve } from './retriever.js'
import { SqliteKnowledgeRepository } from '../data/knowledge-sqlite.js'

const MANIFEST_PATH = join(WIKI_DIR, 'manifest.json')
const VALID_MODELS = new Set<QaModelId>(['deepseek-v4-flash', 'deepseek-v4-pro'])

function readManifest(): WikiManifest {
  ensureWikiCompiled()
  return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as WikiManifest
}

function safeEndpoint(baseUrl: string) {
  try {
    const url = new URL(baseUrl)
    return `${url.origin}${url.pathname.replace(/\/$/, '')}`
  } catch {
    return 'DeepSeek API'
  }
}

function modelOf(request: QaRequest, fallback: QaModelId): QaModelId {
  return request.model && VALID_MODELS.has(request.model) ? request.model : fallback
}

function temperatureOf(value: number | undefined) {
  if (!Number.isFinite(value)) return 0.2
  return Math.min(1.5, Math.max(0, Number(value)))
}

function maxTokensOf(value: number | undefined) {
  if (!Number.isFinite(value)) return 1200
  return Math.round(Math.min(4096, Math.max(256, Number(value))))
}

function generatedAnswers(text: string, validCitationIds: Set<number>): QaAnswer[] {
  const mentioned = Array.from(text.matchAll(/\[(\d+)\]/g)).map(match => Number(match[1]))
  if (mentioned.some(id => !validCitationIds.has(id))) {
    throw new Error('The model returned citation numbers that do not reconcile')
  }
  if (!mentioned.some(id => validCitationIds.has(id))) {
    throw new Error('The model answer carries no verifiable citations')
  }

  return [
    {
      text: text.trim(),
      citations: Array.from(new Set(mentioned.filter(id => validCitationIds.has(id)))),
    },
  ]
}

function fallbackReason(error: unknown) {
  if (error instanceof Error) return error.message.slice(0, 180)
  return 'DeepSeek generation failed'
}

function normalizedCasualText(question: string): string {
  return question.trim().toLowerCase().replace(/[\s，。！？、,.!?~～]+/g, '')
}

/** 只覆盖明确的短问候，避免把业务问题误判成闲聊。 */
export function isCasualQuestion(question: string): boolean {
  return /^(hello|hi|hey|good morning|good afternoon|good evening|thanks|thank you|you are welcome|bye|goodbye)$/i.test(
    normalizedCasualText(question),
  )
}

function localCasualAnswer(question: string): string {
  const normalized = normalizedCasualText(question)
  if (/^(thanks|thank you|you are welcome)$/i.test(normalized)) {
    return 'You are welcome. Ask me anything about enterprise documents, Wiki knowledge, or business processes.'
  }
  if (/^(bye|goodbye)$/i.test(normalized)) {
    return 'Goodbye. Come back whenever you need enterprise knowledge.'
  }
  return 'Hello. I am the enterprise knowledge assistant; I can help you look up documents, Wiki knowledge, and related business information.'
}

export class QaService {
  private readonly deepseek: DeepSeekClient

  constructor(
    private readonly config: DeepSeekRuntimeConfig,
    private readonly knowledgeRepository: SqliteKnowledgeRepository,
  ) {
    this.deepseek = new DeepSeekClient(config)
  }

  syncKnowledge(): void {
    this.knowledgeRepository.sync(readManifest())
  }

  getModelConfig(): QaModelConfigResponse {
    const store = this.knowledgeRepository.getStats()
    return {
      provider: 'deepseek',
      configured: this.deepseek.configured,
      endpoint: safeEndpoint(this.config.baseUrl),
      credentialLabel: this.deepseek.configured ? 'sk-****' : 'not-configured',
      credentialSource: this.config.credentialSource,
      defaultModel: this.config.defaultModel,
      models: [
        {
          id: 'deepseek-v4-flash',
          label: 'DeepSeek V4 Flash',
          description: 'Low latency and high throughput for everyday enterprise knowledge Q&A',
        },
        {
          id: 'deepseek-v4-pro',
          label: 'DeepSeek V4 Pro',
          description: 'Stronger reasoning for complex tasks and deep policy analysis',
        },
      ],
      knowledgeStore: {
        engine: 'SQLite',
        pages: store.pages,
        chunks: store.chunks,
        persistent: store.persistent,
      },
    }
  }

  retrieve(question: string): QaResponse {
    const manifest = this.knowledgeRepository.loadManifest()
    if (isCasualQuestion(question)) {
      return {
        status: 'no_evidence',
        answers: [],
        citations: [],
        fallback: [],
        metrics: { searched: 0, matched: 0, adopted: 0 },
        compiledAt: manifest.compiledAt,
        confidence: 'low',
        mode: 'local-weighted-retrieval',
      }
    }
    return retrieve(manifest, question.trim())
  }

  async answer(
    request: QaRequest,
    base?: QaResponse,
    onDelta?: (text: string) => void,
  ): Promise<QaResponse> {
    const retrieval = base ?? this.retrieve(request.question)
    const model = modelOf(request, this.config.defaultModel)
    const localOnly = request.generationMode === 'local'

    if (isCasualQuestion(request.question)) {
      const fallback = localCasualAnswer(request.question)
      if (localOnly || !this.deepseek.configured) {
        return {
          ...retrieval,
          status: 'answered',
          answers: [{ text: fallback, citations: [] }],
          fallback: [],
          confidence: 'high',
          mode: localOnly ? 'local-weighted-retrieval' : 'local-fallback',
          generation: {
            provider: 'local',
            model: localOnly ? null : model,
            latencyMs: 0,
            promptTokens: null,
            completionTokens: null,
            totalTokens: null,
            fallbackReason: !localOnly && !this.deepseek.configured ? 'DeepSeek API key is not configured' : null,
          },
        }
      }
      try {
        const options = {
          model,
          temperature: temperatureOf(request.temperature),
          maxTokens: maxTokensOf(request.maxTokens),
        }
        const generated = onDelta
          ? await this.deepseek.generateCasualStream(request.question, options, onDelta)
          : await this.deepseek.generateCasual(request.question, options)
        return {
          ...retrieval,
          status: 'answered',
          answers: [{ text: generated.text, citations: [] }],
          fallback: [],
          confidence: 'high',
          mode: 'deepseek-chat',
          generation: {
            provider: 'deepseek',
            model,
            latencyMs: generated.latencyMs,
            promptTokens: generated.usage.promptTokens,
            completionTokens: generated.usage.completionTokens,
            totalTokens: generated.usage.totalTokens,
            fallbackReason: null,
          },
        }
      } catch (error) {
        return {
          ...retrieval,
          status: 'answered',
          answers: [{ text: fallback, citations: [] }],
          fallback: [],
          confidence: 'high',
          mode: 'local-fallback',
          generation: {
            provider: 'local',
            model,
            latencyMs: 0,
            promptTokens: null,
            completionTokens: null,
            totalTokens: null,
            fallbackReason: fallbackReason(error),
          },
        }
      }
    }

    if (localOnly) {
      return {
        ...retrieval,
        generation: {
          provider: 'local',
          model: null,
          latencyMs: 0,
          promptTokens: null,
          completionTokens: null,
          totalTokens: null,
          fallbackReason: null,
        },
      }
    }

    if (retrieval.status === 'no_evidence') {
      if (this.deepseek.configured) {
        try {
          const options = {
            model,
            temperature: temperatureOf(request.temperature),
            maxTokens: maxTokensOf(request.maxTokens),
          }
          const generated = onDelta
            ? await this.deepseek.generateClarificationStream(
              request.question,
              options,
              onDelta,
            )
            : await this.deepseek.generateClarification(request.question, options)
          return {
            ...retrieval,
            status: 'answered',
            answers: [{ text: generated.text, citations: [] }],
            fallback: [],
            mode: 'deepseek-chat',
            generation: {
              provider: 'deepseek',
              model,
              latencyMs: generated.latencyMs,
              promptTokens: generated.usage.promptTokens,
              completionTokens: generated.usage.completionTokens,
              totalTokens: generated.usage.totalTokens,
              fallbackReason: null,
            },
          }
        } catch (error) {
          return {
            ...retrieval,
            mode: 'local-fallback',
            generation: {
              provider: 'local',
              model,
              latencyMs: 0,
              promptTokens: null,
              completionTokens: null,
              totalTokens: null,
              fallbackReason: fallbackReason(error),
            },
          }
        }
      }
      return {
        ...retrieval,
        generation: {
          provider: 'local',
          model,
          latencyMs: 0,
          promptTokens: null,
          completionTokens: null,
          totalTokens: null,
          fallbackReason: 'No evidence crossed the threshold, so the model was not called',
        },
      }
    }

    if (!this.deepseek.configured) {
      return {
        ...retrieval,
        mode: 'local-fallback',
        generation: {
          provider: 'local',
          model,
          latencyMs: 0,
          promptTokens: null,
          completionTokens: null,
          totalTokens: null,
          fallbackReason: 'DeepSeek API key is not configured',
        },
      }
    }

    try {
      const options = {
        model,
        temperature: temperatureOf(request.temperature),
        maxTokens: maxTokensOf(request.maxTokens),
      }
      const generated = onDelta
        ? await this.deepseek.generateStream(
          request.question,
          retrieval.citations,
          options,
          onDelta,
        )
        : await this.deepseek.generate(request.question, retrieval.citations, options)
      const answers = generatedAnswers(
        generated.text,
        new Set(retrieval.citations.map(citation => citation.id)),
      )

      return {
        ...retrieval,
        answers,
        mode: 'deepseek-rag',
        generation: {
          provider: 'deepseek',
          model,
          latencyMs: generated.latencyMs,
          promptTokens: generated.usage.promptTokens,
          completionTokens: generated.usage.completionTokens,
          totalTokens: generated.usage.totalTokens,
          fallbackReason: null,
        },
      }
    } catch (error) {
      return {
        ...retrieval,
        mode: 'local-fallback',
        generation: {
          provider: 'local',
          model,
          latencyMs: 0,
          promptTokens: null,
          completionTokens: null,
          totalTokens: null,
          fallbackReason: fallbackReason(error),
        },
      }
    }
  }

  async testConnection(model: QaModelId) {
    return this.deepseek.test(VALID_MODELS.has(model) ? model : this.config.defaultModel)
  }
}
