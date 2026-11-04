/** The `vision` Remote namespace over a double, and the observation fold over a real Session. */

import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { Session, SessionId } from '@deepseek-ai/dsh-session'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import { remoteErrorOf, remoteMethods } from '@deepseek-ai/dsh-typert-protocol'
import VisionController, {
  BAILIAN_API_KEY_URL, BAILIAN_VISION_MODEL, OPENROUTER_VISION_MODEL,
  ensureLoggedVisionObservation, observationIdentity, resolveRequestedSelection, resolveVisionSelection,
  visionObservationProjection,
} from '../src/index.ts'
import type { Config } from '../src/index.ts'
import type { VisionEnhancementRuntime, VisionSettings } from '../src/vision-enhancement.ts'

function configOf(overrides: Partial<VisionSettings> = {}): Config {
  const settings: VisionSettings = { enabled: false, provider: 'bailian', model: BAILIAN_VISION_MODEL, baseUrl: '', ...overrides }
  return {
    enabled: { get: () => settings.enabled },
    provider: { get: () => settings.provider },
    model: { get: () => settings.model },
    baseUrl: { get: () => settings.baseUrl },
  }
}

function runtimeOf(overrides: Partial<VisionEnhancementRuntime> = {}): VisionEnhancementRuntime {
  return {
    status: async () => ({
      enabled: true,
      configured: true,
      provider: 'bailian',
      model: BAILIAN_VISION_MODEL,
      apiKeyUrl: BAILIAN_API_KEY_URL,
      providers: [],
    }),
    route: async (modelProvider, model) => ({ mode: 'native', modelProvider, model }),
    activate: async (modelProvider, model) => ({ mode: 'compatible', modelProvider, model }),
    test: async () => ({ provider: 'bailian', model: BAILIAN_VISION_MODEL, description: 'a cat' }),
    enable: async () => ({ provider: 'bailian', model: BAILIAN_VISION_MODEL, description: 'a cat' }),
    isEnabled: () => true,
    refresh: () => {},
    ...overrides,
  }
}

function controllerOf(runtime: VisionEnhancementRuntime, config: Config = configOf()): VisionController {
  return new VisionController(new Context(), config, { runtime })
}

describe('vision Remote', () => {
  it('publishes the five endpoints under the vision namespace', () => {
    const controller = controllerOf(runtimeOf())
    expect(controller.typertRemote.namespace).toBe('vision')
    expect(remoteMethods(controller).map(method => method.method)).toEqual([
      'status', 'route', 'activate', 'test', 'enable',
    ])
  })

  it('answers status and route from the installed runtime', async () => {
    const controller = controllerOf(runtimeOf())
    await expect(controller.status()).resolves.toMatchObject({ enabled: true, model: BAILIAN_VISION_MODEL })
    await expect(controller.route('deepseek-official', 'deepseek-v4-flash'))
      .resolves.toEqual({ mode: 'native', modelProvider: 'deepseek-official', model: 'deepseek-v4-flash' })
    await expect(controller.activate('deepseek-official', 'deepseek-v4-flash'))
      .resolves.toMatchObject({ mode: 'compatible' })
  })

  it('rejects a route request that names no model', async () => {
    const controller = controllerOf(runtimeOf())
    const failure = await controller.route('deepseek-official', '  ').catch((error: unknown) => error)
    expect(remoteErrorOf(failure)?.code).toBe('gateway/bad-request')
  })

  it('classifies a runtime refusal and keeps the endpoint it came from', async () => {
    const controller = controllerOf(runtimeOf({ status: async () => { throw new Error('尚未配置 阿里云百炼 API Key。') } }))
    const failure = await controller.status().catch((error: unknown) => error)
    expect(remoteErrorOf(failure)).toMatchObject({ code: 'vision/rejected', details: { operation: 'vision.status' } })
    expect(remoteErrorOf(failure)?.message).toContain('API Key')
  })

  it('reports cancellation as its own outcome and validates the probe first', async () => {
    const controller = controllerOf(runtimeOf())
    const aborted = new AbortController()
    aborted.abort()
    const cancelled = await controller.test({
      mediaType: 'image/png', data: 'AAAA',
    }, aborted.signal).catch((error: unknown) => error)
    expect(remoteErrorOf(cancelled)?.code).toBe('gateway/cancelled')

    const invalid = await controller.test({ mediaType: 'image/png', data: '' }, new AbortController().signal)
      .catch((error: unknown) => error)
    expect(remoteErrorOf(invalid)?.code).toBe('gateway/bad-request')
  })

  it('passes a validated probe through to the runtime', async () => {
    const seen: { data?: string } = {}
    const controller = controllerOf(runtimeOf({
      enable: async (input) => {
        seen.data = input.data
        return { provider: input.provider ?? 'bailian', model: BAILIAN_VISION_MODEL, description: 'a cat' }
      },
    }))
    const result = await controller.enable({
      mediaType: 'image/png', data: 'AAAA', provider: 'openrouter', model: OPENROUTER_VISION_MODEL,
    }, new AbortController().signal)
    expect(result).toMatchObject({ provider: 'openrouter', description: 'a cat' })
    expect(seen.data).toBe('AAAA')
  })
})

describe('stored selection', () => {
  it('falls back to the provider default model and base URL', () => {
    expect(resolveVisionSelection({ enabled: true, provider: 'bailian', model: '', baseUrl: '' }))
      .toMatchObject({ provider: 'bailian', model: BAILIAN_VISION_MODEL })
    expect(resolveVisionSelection({ enabled: true, provider: 'ollama', model: '', baseUrl: '' }))
      .toMatchObject({ model: '', baseUrl: 'http://127.0.0.1:11434/v1' })
  })

  it('refuses a model a fixed-model provider does not accept', () => {
    expect(() => resolveRequestedSelection('bailian', 'qwen-vl-max', undefined))
      .toThrow('视觉模型固定为')
    expect(() => resolveRequestedSelection('custom', '  ', undefined)).toThrow('请输入 自定义 OpenAI-compatible 视觉模型 ID。')
  })

  it('normalizes an editable base URL and rejects credentials, query parameters, and fragments', () => {
    expect(resolveRequestedSelection('vllm', 'qwen2-vl', 'http://127.0.0.1:9000/v1///'))
      .toMatchObject({ baseUrl: 'http://127.0.0.1:9000/v1' })
    expect(() => resolveRequestedSelection('vllm', 'qwen2-vl', 'http://user:pass@127.0.0.1:9000/v1'))
      .toThrow('必须是无账号')
    expect(() => resolveRequestedSelection('vllm', 'qwen2-vl', 'not-a-url')).toThrow('不是有效 URL')
  })
})

describe('vision observation log', () => {
  function boot() {
    const ctx = new Context()
    const registry = new SessionProjectionRegistry(ctx)
    registry.register(visionObservationProjection)
    const session = Session.create(SessionId('vision-observation'))
    ctx.emit('session/created', session)
    return { ctx, registry, session }
  }

  function emitLast(ctx: Context, session: Session): void {
    const events = session.snapshotEvents()
    const last = events.at(-1)
    if (last !== undefined) ctx.emit('session/event', session, last)
  }

  it('records one observation per attachment, question, and model', async () => {
    const { ctx, registry, session } = boot()
    let calls = 0
    const analyze = async (): Promise<string> => {
      calls += 1
      return '一只白猫'
    }
    const input = { attachmentId: 'sha256:aaa', question: '主体是什么？', model: BAILIAN_VISION_MODEL }
    await expect(ensureLoggedVisionObservation(registry, session, input, analyze)).resolves.toBe('一只白猫')
    emitLast(ctx, session)
    await expect(ensureLoggedVisionObservation(registry, session, input, analyze)).resolves.toBe('一只白猫')
    expect(calls).toBe(1)

    const recorded = session.snapshotEvents().filter(event => event.type === 'vision/observation')
    expect(recorded).toHaveLength(1)
    expect(observationIdentity(input)).toContain('sha256:aaa')
  })

  it('keeps a different question separate', async () => {
    const { ctx, registry, session } = boot()
    const first = { attachmentId: 'sha256:aaa', question: '主体是什么？', model: BAILIAN_VISION_MODEL }
    await ensureLoggedVisionObservation(registry, session, first, async () => '一只白猫')
    emitLast(ctx, session)
    let calls = 0
    await ensureLoggedVisionObservation(registry, session, { ...first, question: '背景是什么？' }, async () => {
      calls += 1
      return '蓝天与云朵'
    })
    expect(calls).toBe(1)
    expect(session.snapshotEvents().filter(event => event.type === 'vision/observation')).toHaveLength(2)
  })
})
