/**
 * Host owner of the `vision` Remote namespace: the five calls the Desktop
 * visual-enhancement controls make, over the installed host service.
 *
 * The plugin's own profile entry is the settings row the controls read and
 * write (`enabled`, `provider`, `model`, `baseUrl`), so the entry id named in
 * the profile composition is the namespace a client passes to
 * `settings.update`. Every remote call is owner-only: no non-owner principal
 * policy grants `vision/*`, and the Gateway refuses a call whose resources no
 * binding covers.
 *
 * @module @deepseek-ai/dsh-api-vision-controller
 */

import { Context } from '@deepseek-ai/cordis'
import type { Volatile } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/cordis-plugin-loader'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-attachment'
import type {} from '@deepseek-ai/dsh-credentials'
import type {} from '@deepseek-ai/dsh-fs'
import type {} from '@deepseek-ai/dsh-llm'
import type {} from '@deepseek-ai/dsh-session-projection'
import type {} from '@deepseek-ai/dsh-settings'
import type {} from '@deepseek-ai/dsh-skill'
import type {} from '@deepseek-ai/dsh-system-prompt'
import type {} from '@deepseek-ai/dsh-tools'
import { Remote, RemoteError, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import z from '@deepseek-ai/schemastery'
import { z as zod } from 'zod'
import { visionObservationProjection } from './observations.ts'
import {
  BAILIAN_VISION_MODEL,
  installVisionEnhancement,
  type VisionEnhancementRuntime,
  type VisionSettings,
  type VisionSettingsStore,
} from './vision-enhancement.ts'
import type {
  VisionEnableInput, VisionProvider, VisionRouteView, VisionStatusView, VisionTestInput, VisionTestView,
} from './types.ts'

export type * from './types.ts'
export {
  BAILIAN_API_KEY_REF, BAILIAN_API_KEY_URL, BAILIAN_VISION_MODEL, OPENROUTER_API_KEY_REF, OPENROUTER_API_KEY_URL,
  OPENROUTER_VISION_MODEL, installVisionEnhancement, resolveRequestedSelection, resolveVisionSelection,
} from './vision-enhancement.ts'
export type {
  VisionEnhancementRuntime, VisionRoute, VisionSettings, VisionSettingsStore, VisionStatus, VisionTestResult,
} from './vision-enhancement.ts'
export {
  VISION_OBSERVATION_PROJECTION_KEY, ensureLoggedVisionObservation, observationIdentity, visionObservationProjection,
} from './observations.ts'
export type { VisionObservationEventData, VisionObservationState } from './observations.ts'

/** Profile entry id the shipped composition gives this plugin. */
export const VISION_SETTINGS_ENTRY_ID = 'vision-enhancement'

/** Live settings of this plugin's profile entry. */
export interface Config {
  /** Whether automatic visual enhancement is on. */
  enabled: Volatile<boolean>
  /** Selected visual provider. */
  provider: Volatile<VisionProvider>
  /** Selected visual model; empty selects the provider default. */
  model: Volatile<string>
  /** Self-hosted base URL; empty selects the provider default. */
  baseUrl: Volatile<string>
}

/** Validated live settings schema shown by the configuration page. */
const VisionConfigSchema = z.object({
  enabled: z.boolean().default(false).volatile(),
  provider: z.union(['bailian', 'openrouter', 'ollama', 'vllm', 'sglang', 'custom']).default('bailian').volatile(),
  model: z.string().default(BAILIAN_VISION_MODEL).volatile(),
  baseUrl: z.string().default('').volatile(),
})

const imageMediaTypeSchema = zod.enum(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
const visionProviderSchema = zod.enum(['bailian', 'openrouter', 'ollama', 'vllm', 'sglang', 'custom'])
const routeRequestSchema = zod.object({
  modelProvider: zod.string().trim().min(1).max(255),
  model: zod.string().trim().min(1).max(255),
})
const testRequestSchema = zod.object({
  mediaType: imageMediaTypeSchema,
  data: zod.string().min(1).max(14_000_000),
  question: zod.string().max(2_000).optional(),
  name: zod.string().max(255).optional(),
})
const enableRequestSchema = testRequestSchema.extend({
  apiKey: zod.string().min(1).max(16_384).optional(),
  provider: visionProviderSchema.optional(),
  model: zod.string().trim().min(1).max(255).optional(),
  baseUrl: zod.url().max(2_048).optional(),
})

/** Host integrations replaceable by direct unit tests. */
export interface VisionControllerInternals {
  /** Installed runtime; tests supply a double instead of the real host service. */
  readonly runtime?: VisionEnhancementRuntime
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Host owner of the `vision` Remote namespace. */
    visionController: VisionController
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Read abort state afresh after an awaited provider or settings call. */
function isAborted(signal: AbortSignal): boolean {
  return signal.aborted
}

/**
 * Parse the domain constraints the generated TypeScript codecs do not state.
 * @param method - endpoint name used in the diagnostic.
 * @param schema - request schema carrying the remaining bounds.
 * @param value - decoded arguments.
 * @returns the validated request.
 * @throws RemoteError when the request breaks a stated bound.
 */
function parseRequest<T>(method: string, schema: zod.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value)
  if (!parsed.success) {
    throw new RemoteError('gateway/bad-request', `invalid payload for ${method}`, { issues: parsed.error.issues })
  }
  return parsed.data
}

/**
 * Classify one runtime or settings refusal. A cancelled probe is its own
 * outcome, not a rejected request.
 * @param operation - endpoint the caller invoked.
 * @param error - whatever the runtime threw.
 * @param signal - caller lifetime of the call, when it has one.
 * @returns the failure to raise.
 */
function rejected(operation: string, error: unknown, signal?: AbortSignal): RemoteError {
  if (signal !== undefined && signal.aborted) return new RemoteError('gateway/cancelled', `${operation} was aborted`, {})
  return new RemoteError('vision/rejected', messageOf(error), { operation }, { cause: error })
}

/**
 * Host service backing the generated `ctx.remote.vision` namespace. It adds
 * the wire obligations the visual-enhancement runtime does not carry: request
 * bounds, cancellation classification, and refusal mapping.
 */
export class VisionController extends TypertRemoteService {
  static inject = [
    'settings', 'credentials', 'llm', 'agents', 'attachments', 'fs', 'skills', 'systemPrompt', 'tools', 'sessionProjections',
  ]

  static Config = VisionConfigSchema

  /** Profile entry whose volatile fields are the live settings. */
  readonly entryId: string | undefined
  private readonly runtime: VisionEnhancementRuntime

  /**
   * Install the host service over this plugin's settings entry.
   * @param ctx - Host context carrying the services the runtime consumes.
   * @param config - live settings of the plugin's profile entry.
   * @param internals - test-only replacements for the installed runtime.
   */
  constructor(ctx: Context, config: Config, internals: VisionControllerInternals = {}) {
    super(ctx, 'visionController', { namespace: 'vision' })
    this.entryId = ctx.fiber.entry?.options.id
    if (internals.runtime !== undefined) {
      this.runtime = internals.runtime
      return
    }
    if (this.entryId === undefined) {
      throw new Error('vision-controller: the plugin needs a Loader entry to own its settings')
    }
    ctx.sessionProjections.register(visionObservationProjection)
    this.runtime = installVisionEnhancement(ctx, this.store(config))
    ctx.on('loader/volatile-update', () => { this.runtime.refresh() })
  }

  /**
   * Read the Host-authoritative status, including every provider's value-free
   * readiness and the persisted selection.
   * @returns the current enabled state, selection, and provider roster.
   * @throws RemoteError when the stored selection cannot be resolved.
   */
  @Remote
  async status(): Promise<VisionStatusView> {
    try {
      return await this.runtime.status()
    } catch (error: unknown) {
      throw rejected('vision.status', error)
    }
  }

  /**
   * Resolve the exact image path the Host would use for one session route.
   * @param modelProvider - provider route the client selected.
   * @param model - exact model id the client selected.
   * @returns `off`, `native`, `compatible`, or `unavailable` for that route.
   * @throws RemoteError when the route or the stored selection cannot be resolved.
   */
  @Remote
  async route(modelProvider: string, model: string): Promise<VisionRouteView> {
    const request = parseRequest('vision.route', routeRequestSchema, { modelProvider, model })
    try {
      return await this.runtime.route(request.modelProvider, request.model)
    } catch (error: unknown) {
      throw rejected('vision.route', error)
    }
  }

  /**
   * Turn automatic enhancement on for one session route after verifying that a
   * compatible provider can serve it.
   * @param modelProvider - provider route the client selected.
   * @param model - exact model id the client selected.
   * @returns the route the Host will now use for images.
   * @throws RemoteError when no compatible provider is ready for a text-only route.
   */
  @Remote
  async activate(modelProvider: string, model: string): Promise<VisionRouteView> {
    const request = parseRequest('vision.activate', routeRequestSchema, { modelProvider, model })
    try {
      return await this.runtime.activate(request.modelProvider, request.model)
    } catch (error: unknown) {
      throw rejected('vision.activate', error)
    }
  }

  /**
   * Verify the stored provider with one image probe.
   * @param input - validated image, optional question, and optional display name.
   * @param signal - caller lifetime; abort cancels the provider request.
   * @returns the provider's description of the probe image.
   * @throws RemoteError when the probe is invalid, refused, or cancelled.
   */
  @Remote
  async test(input: VisionTestInput, signal: AbortSignal): Promise<VisionTestView> {
    const request = parseRequest('vision.test', testRequestSchema, input)
    if (isAborted(signal)) throw new RemoteError('gateway/cancelled', 'vision.test was aborted', {})
    try {
      return await this.runtime.test(request, signal)
    } catch (error: unknown) {
      throw rejected('vision.test', error, signal)
    }
  }

  /**
   * Persist a provider selection and credential, verify them with one image
   * probe, then enable automatic enhancement.
   * @param input - image probe plus optional credential and provider selection.
   * @param signal - caller lifetime; abort cancels the provider request.
   * @returns the verifying provider's description of the probe image.
   * @throws RemoteError when the selection, credential, or probe is refused or cancelled.
   */
  @Remote
  async enable(input: VisionEnableInput, signal: AbortSignal): Promise<VisionTestView> {
    const request = parseRequest('vision.enable', enableRequestSchema, input)
    if (isAborted(signal)) throw new RemoteError('gateway/cancelled', 'vision.enable was aborted', {})
    try {
      return await this.runtime.enable(request, signal)
    } catch (error: unknown) {
      throw rejected('vision.enable', error, signal)
    }
  }

  /** Bind the entry's volatile fields to the runtime's read/write half. */
  private store(config: Config): VisionSettingsStore {
    return {
      read: (): VisionSettings => ({
        enabled: config.enabled.get(),
        provider: config.provider.get(),
        model: config.model.get(),
        baseUrl: config.baseUrl.get(),
      }),
      update: async (patch) => {
        if (this.entryId === undefined) throw new Error('vision-controller: settings entry is unavailable')
        await this.ctx.settings.update(this.entryId, patch)
      },
    }
  }
}

export default VisionController
