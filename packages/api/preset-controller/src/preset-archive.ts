/**
 * Safe preview of binary `.dshpreset` archives: bounded unzip, manifest
 * validation, path containment, and the review warnings a Preset square shows
 * before a reviewer confirms one.
 *
 * @module @deepseek-ai/dsh-api-preset-controller/src/preset-archive
 */

import { extname } from 'node:path'
import { strFromU8, unzipSync } from 'fflate'
import type { PresetArchivePreview, PresetArchiveWarning } from './types.ts'

/** Media type accepted by the Preset archive endpoint. */
export const PRESET_ARCHIVE_MIME = 'application/vnd.dsh.preset+zip'
/** Maximum compressed Preset archive size accepted by Desktop and Host. */
export const PRESET_ARCHIVE_MAX_COMPRESSED = 16 * 1024 * 1024
/** Maximum aggregate expanded size accepted from one Preset archive. */
export const PRESET_ARCHIVE_MAX_UNCOMPRESSED = 32 * 1024 * 1024
/** Maximum expanded size accepted for one Preset archive file. */
export const PRESET_ARCHIVE_MAX_FILE = 12 * 1024 * 1024
/** Maximum number of Preset payload files accepted beside the manifest. */
export const PRESET_ARCHIVE_MAX_FILES = 512

/**
 * Composition file every Preset package must carry. The archive format names
 * it, so the constant travels with the format rather than with the preset
 * loader that happens to consume it.
 */
export const PRESET_ARCHIVE_COMPOSITION_FILE = 'agent.cordis.yml'

const PRESET_ARCHIVE_ID = /^[a-z0-9][a-z0-9-]*$/u
const PRESET_ARCHIVE_IGNORED_FILES = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini'])
const PRESET_TEXT_EXTENSIONS = new Set([
  '.json', '.jsonc', '.md', '.txt', '.yaml', '.yml', '.toml', '.js', '.jsx', '.ts', '.tsx',
  '.mjs', '.cjs', '.py', '.sh', '.ps1', '.html', '.css',
])

/** Versioned package identity read from `manifest.json`. */
export interface PresetArchiveManifest {
  readonly format: 'dsh-preset'
  readonly version: 1
  readonly id: string
  readonly name?: string
  readonly description?: string
  readonly sourceDshVersion?: string
}

/** Validated in-memory Preset payload before any consumer writes it. */
export interface ParsedPresetArchive {
  readonly manifest: PresetArchiveManifest
  readonly files: Readonly<Record<string, Uint8Array>>
  readonly warnings: readonly Exclude<PresetArchiveWarning, 'version-mismatch'>[]
}

/** The roster facts a preview needs: which preset identities are already taken. */
export interface PresetArchiveRoster {
  list(): Promise<readonly { readonly id: string }[]>
}

/** Stable import failure carrying the status the caller should report. */
export class PresetArchiveError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message)
    this.name = 'PresetArchiveError'
  }
}

function safeArchivePath(name: string): boolean {
  if (name === '' || name.includes('\0') || name.includes('\\') || name.startsWith('/') || /^[a-zA-Z]:/u.test(name)) {
    return false
  }
  return name.split('/').every(segment => segment !== '' && segment !== '.' && segment !== '..')
}

function archiveWarnings(files: Readonly<Record<string, Uint8Array>>): readonly Exclude<PresetArchiveWarning, 'version-mismatch'>[] {
  let hasAbsolutePath = false
  let hasPossibleSecret = false
  for (const [name, data] of Object.entries(files)) {
    if (!PRESET_TEXT_EXTENSIONS.has(extname(name).toLowerCase()) || data.length > 1024 * 1024 || data.includes(0)) {
      continue
    }
    const text = strFromU8(data)
    if (/(?:^|[\s"'(:=])(?:\/Users\/|\/home\/)/mu.test(text)
      || /(?:^|[^A-Za-z0-9])[A-Za-z]:[\\/]/u.test(text)
      || /\\\\[^\\\s]+[\\/]/u.test(text)) {
      hasAbsolutePath = true
    }
    if (/(?:api[_-]?key|secret|token)\s*[:=]\s*["']?[^\s"']{12,}|\bsk-[a-z0-9_-]{16,}/iu.test(text)) {
      hasPossibleSecret = true
    }
  }
  return [
    ...hasAbsolutePath ? ['absolute-paths' as const] : [],
    ...hasPossibleSecret ? ['possible-secrets' as const] : [],
  ]
}

/**
 * Parse one bounded archive without writing to disk.
 * @param data - Compressed `.dshpreset` bytes received from Desktop.
 * @returns Validated manifest, payload files, and review warnings.
 * @throws PresetArchiveError when the archive is oversized, unsafe, or malformed.
 */
export function parsePresetArchive(data: Uint8Array): ParsedPresetArchive {
  if (data.length === 0) throw new PresetArchiveError('Preset package is empty.')
  if (data.length > PRESET_ARCHIVE_MAX_COMPRESSED) {
    throw new PresetArchiveError('Preset package is larger than 16 MB.', 413)
  }
  let count = 0
  let total = 0
  let archive: Record<string, Uint8Array>
  try {
    archive = unzipSync(data, {
      filter(file) {
        const isDirectory = file.name.endsWith('/')
        const path = isDirectory ? file.name.slice(0, -1) : file.name
        if (!safeArchivePath(path)) throw new PresetArchiveError(`Preset package contains an unsafe path: ${file.name}`)
        if (isDirectory) return false
        count += 1
        if (count > PRESET_ARCHIVE_MAX_FILES + 1) {
          throw new PresetArchiveError(`Preset package contains more than ${String(PRESET_ARCHIVE_MAX_FILES)} files.`)
        }
        if (file.originalSize > PRESET_ARCHIVE_MAX_FILE) {
          throw new PresetArchiveError(`Preset package contains an oversized file: ${file.name}`)
        }
        total += file.originalSize
        if (total > PRESET_ARCHIVE_MAX_UNCOMPRESSED) {
          throw new PresetArchiveError('Expanded preset package is larger than 32 MB.', 413)
        }
        return true
      },
    })
  } catch (error: unknown) {
    if (error instanceof PresetArchiveError) throw error
    throw new PresetArchiveError(`Preset package is not a valid ZIP archive: ${String(error)}`)
  }
  const manifestBytes = archive['manifest.json']
  if (manifestBytes === undefined) throw new PresetArchiveError('Preset package has no manifest.json.')
  let rawManifest: unknown
  try {
    rawManifest = JSON.parse(strFromU8(manifestBytes))
  } catch {
    throw new PresetArchiveError('Preset package manifest is not valid JSON.')
  }
  if (typeof rawManifest !== 'object' || rawManifest === null || Array.isArray(rawManifest)) {
    throw new PresetArchiveError('Preset package manifest is unsupported or invalid.')
  }
  const source = rawManifest as Record<string, unknown>
  if (source['format'] !== 'dsh-preset' || source['version'] !== 1
    || typeof source['id'] !== 'string' || !PRESET_ARCHIVE_ID.test(source['id'])) {
    throw new PresetArchiveError('Preset package manifest is unsupported or invalid.')
  }
  if (source['name'] !== undefined && (typeof source['name'] !== 'string' || source['name'].length > 160)) {
    throw new PresetArchiveError('Preset package manifest has an invalid name.')
  }
  if (source['description'] !== undefined
    && (typeof source['description'] !== 'string' || source['description'].length > 4_000)) {
    throw new PresetArchiveError('Preset package manifest has an invalid description.')
  }
  if (source['sourceDshVersion'] !== undefined
    && (typeof source['sourceDshVersion'] !== 'string' || source['sourceDshVersion'].length > 64)) {
    throw new PresetArchiveError('Preset package manifest has an invalid DSH version.')
  }
  const manifest: PresetArchiveManifest = {
    format: 'dsh-preset',
    version: 1,
    id: source['id'],
    ...typeof source['name'] === 'string' ? { name: source['name'] } : {},
    ...typeof source['description'] === 'string' ? { description: source['description'] } : {},
    ...typeof source['sourceDshVersion'] === 'string' ? { sourceDshVersion: source['sourceDshVersion'] } : {},
  }
  const files: Record<string, Uint8Array> = Object.create(null) as Record<string, Uint8Array>
  for (const [name, bytes] of Object.entries(archive)) {
    if (name === 'manifest.json') continue
    if (!name.startsWith('preset/') || name === 'preset/') {
      throw new PresetArchiveError(`Unexpected file outside the preset directory: ${name}`)
    }
    const relative = name.slice('preset/'.length)
    if (!safeArchivePath(relative)) throw new PresetArchiveError(`Preset package contains an unsafe path: ${relative}`)
    if (PRESET_ARCHIVE_IGNORED_FILES.has(relative.split('/').at(-1) ?? '')) continue
    files[relative] = bytes
  }
  if (files[PRESET_ARCHIVE_COMPOSITION_FILE] === undefined) {
    throw new PresetArchiveError(`Preset package is missing preset/${PRESET_ARCHIVE_COMPOSITION_FILE}.`)
  }
  return { manifest, files, warnings: archiveWarnings(files) }
}

/** Options every preview call takes from the Host, not from the caller. */
export interface PresetArchivePreviewOptions {
  /** Identity to install under; omitted uses the manifest id. */
  readonly targetId?: string
  /** DSH version the running Host reports, compared with the archive's record. */
  readonly currentDshVersion: string
}

/**
 * Validate one archive against the live roster and answer its review evidence.
 * @param roster - authoritative preset identities already present.
 * @param data - Compressed archive bytes verified by Desktop.
 * @param options - Target identity and the running DSH version.
 * @param signal - Optional caller cancellation.
 * @returns The validated preview; nothing is written.
 * @throws PresetArchiveError when the archive or the target identity is refused.
 */
export async function previewPresetArchive(
  roster: PresetArchiveRoster,
  data: Uint8Array,
  options: PresetArchivePreviewOptions,
  signal?: AbortSignal,
): Promise<PresetArchivePreview> {
  signal?.throwIfAborted()
  const parsed = parsePresetArchive(data)
  const targetId = options.targetId ?? parsed.manifest.id
  if (!PRESET_ARCHIVE_ID.test(targetId)) {
    throw new PresetArchiveError('Use lowercase letters, digits, and hyphens, starting with a letter or digit.')
  }
  const rows = await roster.list()
  signal?.throwIfAborted()
  const warnings: PresetArchiveWarning[] = [
    ...parsed.warnings,
    ...parsed.manifest.sourceDshVersion !== undefined
      && parsed.manifest.sourceDshVersion !== options.currentDshVersion
      ? ['version-mismatch' as const]
      : [],
  ]
  return {
    targetId,
    sourcePresetId: parsed.manifest.id,
    name: parsed.manifest.name ?? null,
    description: parsed.manifest.description ?? null,
    sourceDshVersion: parsed.manifest.sourceDshVersion ?? null,
    fileCount: Object.keys(parsed.files).length,
    warnings,
    conflict: rows.some(row => row.id === targetId),
    installed: false,
  }
}
