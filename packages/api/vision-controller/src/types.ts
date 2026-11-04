/**
 * Browser-safe wire vocabulary of the `vision` Remote namespace: the
 * value-free provider roster, the selected image route, and one verified
 * observation. No credential value, base URL of a stored key, or provider
 * response travels in these shapes.
 *
 * @module @deepseek-ai/dsh-api-vision-controller/types
 */

import type { ImageMediaType } from '@deepseek-ai/dsh-attachment/types'

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface RemoteErrorDetailsMap {
    /**
     * The visual provider call, the stored selection, or the image probe
     * refused the request. `message` always names the provider and the reason.
     */
    'vision/rejected': { readonly operation: string }
  }
}

/** Compatible visual providers supported by the Studio bridge. */
export type VisionProvider = 'bailian' | 'openrouter' | 'ollama' | 'vllm' | 'sglang' | 'custom'

/** Value-free provider status exposed to the client. */
export interface VisionProviderView {
  /** Stable provider id selected and persisted by the Host. */
  id: VisionProvider
  /** Display name shown by the configuration row. */
  name: string
  /** Whether the Host resolves a credential for this provider. */
  configured: boolean
  /** Model the Host uses when the stored model is empty. */
  defaultModel: string
  /** Help page a user opens to obtain a key. */
  apiKeyUrl: string
  /** Whether the stored model id may differ from {@link defaultModel}. */
  modelEditable: boolean
  /** OpenAI-compatible base URL this provider defaults to, when it has one. */
  defaultBaseUrl?: string
  /** Whether the base URL is user-editable for this provider. */
  baseUrlEditable?: boolean
  /** Whether this provider refuses to run without a credential. */
  apiKeyRequired?: boolean
}

/** Host-authoritative visual-enhancement status. */
export interface VisionStatusView {
  /** Whether automatic visual enhancement is currently on. */
  enabled: boolean
  /** Whether the selected provider resolves a usable credential and endpoint. */
  configured: boolean
  /** Provider whose selection is persisted. */
  provider: VisionProvider
  /** Model whose selection is persisted. */
  model: string
  /** Help page for the selected provider's key. */
  apiKeyUrl: string
  /** Non-empty configured base URL of a self-hosted provider. */
  baseUrl?: string
  /** Every supported provider with its value-free readiness. */
  providers: readonly VisionProviderView[]
}

/** Verified visual description returned for one image probe. */
export interface VisionTestView {
  /** Provider that produced the description. */
  provider: VisionProvider
  /** Model id that produced the description. */
  model: string
  /** Base URL used for a self-hosted provider. */
  baseUrl?: string
  /** The provider's description of the probe image. */
  description: string
}

/** Automatic image route selected for the exact session model. */
export type VisionRouteMode = 'off' | 'native' | 'compatible' | 'unavailable'

/** Exact path the Host will use for images on one selected LLM route. */
export interface VisionRouteView {
  /** Selected image path for this route. */
  mode: VisionRouteMode
  /** Provider route the client asked about. */
  modelProvider: string
  /** Model id the client asked about. */
  model: string
  /** Visual provider that would describe images, for `compatible`. */
  provider?: VisionProvider
  /** Display name of that visual provider. */
  providerName?: string
  /** Visual model that would describe images. */
  visionModel?: string
}

/** Canonical image probe submitted for real provider verification. */
export interface VisionTestInput {
  /** Validated image media type. */
  mediaType: ImageMediaType
  /** Canonical Base64 image payload. */
  data: string
  /** Task-specific visual question; omitted uses the Host's default. */
  question?: string | undefined
  /** Optional display name for validation diagnostics. */
  name?: string | undefined
}

/** Image probe plus optional provider selection submitted when enabling. */
export interface VisionEnableInput extends VisionTestInput {
  /** Credential stored before verification; omitted keeps the configured one. */
  apiKey?: string | undefined
  /** Provider selected for this verification. */
  provider?: VisionProvider | undefined
  /** Provider model id selected for this verification. */
  model?: string | undefined
  /** OpenAI-compatible base URL for a self-hosted provider. */
  baseUrl?: string | undefined
}
