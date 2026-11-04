/**
 * Host owner of the `preset` Remote namespace: the review half of the Desktop
 * Preset square's archive import.
 *
 * A Preset package is a 0.1.1-shaped directory payload (`preset/agent.cordis.yml`
 * plus files it addresses relative to the payload root). The 0.2.1 preset model
 * declares presets as inline composition rows in a profile patch layer, so an
 * imported package cannot become one without the preset-format migration; the
 * install step therefore fails loud instead of writing a directory no loader
 * reads. Preview, archive validation, and the roster conflict check are
 * unaffected.
 *
 * @module @deepseek-ai/dsh-api-preset-controller
 */

import { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-agent-preset-registry'
import { getDshRuntimeVersion } from '@deepseek-ai/dsh-app-boot'
import { Remote, RemoteError, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { z as zod } from 'zod'
import { PresetArchiveError, previewPresetArchive, type PresetArchiveRoster } from './preset-archive.ts'
import type { PresetArchiveImportRequest, PresetArchivePreview } from './types.ts'

export type * from './types.ts'
export {
  PRESET_ARCHIVE_COMPOSITION_FILE, PRESET_ARCHIVE_MAX_COMPRESSED, PRESET_ARCHIVE_MAX_FILES,
  PRESET_ARCHIVE_MAX_FILE, PRESET_ARCHIVE_MAX_UNCOMPRESSED, PRESET_ARCHIVE_MIME,
  PresetArchiveError, parsePresetArchive, previewPresetArchive,
} from './preset-archive.ts'
export type {
  ParsedPresetArchive, PresetArchiveManifest, PresetArchivePreviewOptions, PresetArchiveRoster,
} from './preset-archive.ts'

/** Host integrations replaceable by direct unit tests. */
export interface PresetControllerInternals {
  /** Authoritative preset identities; tests supply one instead of the registry. */
  readonly roster?: PresetArchiveRoster
  /** Running DSH version compared against the archive's record; tests pin it. */
  readonly currentDshVersion?: string
}

const importRequestSchema = zod.object({
  targetId: zod.string().min(1).max(64).optional(),
  install: zod.boolean(),
})

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Host owner of the `preset` Remote namespace. */
    presetController: PresetController
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Host service backing the generated `ctx.remote.preset` namespace. It adds the
 * request bounds, the roster lookup, and the refusal mapping the archive
 * validator does not carry.
 */
export class PresetController extends TypertRemoteService {
  private readonly roster: PresetArchiveRoster | undefined
  private readonly currentDshVersion: string

  /**
   * Bind the archive preview to the deployment's preset roster and version.
   * @param ctx - Host context that may carry the preset registry.
   * @param internals - test-only replacements for the roster and version.
   */
  constructor(ctx: Context, internals: PresetControllerInternals = {}) {
    super(ctx, 'presetController', { namespace: 'preset' })
    this.roster = internals.roster ?? ctx.get('agentPresets')
    this.currentDshVersion = internals.currentDshVersion ?? getDshRuntimeVersion()
  }

  /**
   * Validate one `.dshpreset` archive and answer the evidence its reviewer
   * needs. A write request is refused because this deployment's preset model
   * cannot host an imported package.
   * @param data - canonical Base64 of the compressed archive Desktop downloaded and verified.
   * @param request - target identity and whether to commit the archive.
   * @param signal - caller lifetime; abort cancels before any read completes.
   * @returns the validated preview, with `installed` false.
   * @throws RemoteError when the archive is refused, the roster is unavailable, or a write was requested.
   */
  @Remote
  async importArchive(
    data: string,
    request: PresetArchiveImportRequest,
    signal: AbortSignal,
  ): Promise<PresetArchivePreview> {
    const parsed = importRequestSchema.safeParse(request)
    if (!parsed.success) {
      throw new RemoteError('gateway/bad-request', 'invalid payload for preset.importArchive', { issues: parsed.error.issues })
    }
    if (parsed.data.install) {
      throw new RemoteError(
        'preset/install-unavailable',
        'This deployment cannot install an imported Preset package: DSH 0.2.1 declares presets as profile composition rows,'
        + ' so the 0.1.1 directory payload has nowhere to be registered. Preview only.',
        { targetId: parsed.data.targetId ?? 'archive-manifest' },
      )
    }
    const roster = this.roster
    if (roster === undefined) {
      throw new RemoteError(
        'preset/rejected',
        'This deployment has no agent presets: mount @deepseek-ai/dsh-agent-preset-registry in the profile composition',
        { operation: 'preset.importArchive' },
      )
    }
    const bytes = Buffer.from(data, 'base64')
    if (bytes.byteLength === 0) {
      throw new RemoteError('preset/rejected', 'Preset package is empty.', { operation: 'preset.importArchive' })
    }
    try {
      return await previewPresetArchive(roster, new Uint8Array(bytes), {
        ...parsed.data.targetId === undefined ? {} : { targetId: parsed.data.targetId },
        currentDshVersion: this.currentDshVersion,
      }, signal)
    } catch (error: unknown) {
      if (signal.aborted) throw new RemoteError('gateway/cancelled', 'preset.importArchive was aborted', {})
      const status = error instanceof PresetArchiveError ? error.status : undefined
      throw new RemoteError(
        'preset/rejected',
        messageOf(error),
        { operation: 'preset.importArchive', ...status === undefined ? {} : { status } },
        { cause: error },
      )
    }
  }
}

export default PresetController
