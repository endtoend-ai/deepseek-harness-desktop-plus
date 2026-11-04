/**
 * Browser-safe vocabulary of the `preset` Remote namespace: the review
 * evidence a Preset square preview returns and the failure codes it can raise.
 *
 * @module @deepseek-ai/dsh-api-preset-controller/types
 */

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface RemoteErrorDetailsMap {
    /** The archive, its manifest, or its Preset composition was refused. */
    'preset/rejected': { readonly operation: string; readonly status?: number }
    /**
     * This deployment cannot install an archive: the 0.2.1 preset model declares
     * presets as profile composition rows, which an imported package cannot
     * become without the preset-format migration.
     */
    'preset/install-unavailable': { readonly targetId: string }
  }
}

/** Review warning detected without rejecting an otherwise valid Preset archive. */
export type PresetArchiveWarning = 'absolute-paths' | 'possible-secrets' | 'version-mismatch'

/** Request one Preset archive preview, or its installation, under a target identity. */
export interface PresetArchiveImportRequest {
  /** Identity to install under; omitted uses the manifest id. */
  readonly targetId?: string
  /** `true` asks the Host to commit the archive after a passing preview. */
  readonly install: boolean
}

/** Renderer-safe preview of one Preset archive and, for a write, its installation evidence. */
export interface PresetArchivePreview {
  /** Identity the archive would be installed under. */
  readonly targetId: string
  /** Identity the archive's manifest declares. */
  readonly sourcePresetId: string
  /** Display name the archive declares, when it declares one. */
  readonly name: string | null
  /** One-sentence description the archive declares, when it declares one. */
  readonly description: string | null
  /** DSH version that produced the archive, when it records one. */
  readonly sourceDshVersion: string | null
  /** Number of payload files beside the manifest. */
  readonly fileCount: number
  /** Warnings a reviewer should read before installing. */
  readonly warnings: readonly PresetArchiveWarning[]
  /** Whether the target identity is already taken. */
  readonly conflict: boolean
  /** Whether this call committed the archive. */
  readonly installed: boolean
}
