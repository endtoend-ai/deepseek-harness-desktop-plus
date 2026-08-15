/** Live npm-backed discovery for packages following the official dsh-plugin convention. */

import { createHash } from 'node:crypto'
import { Parser, type ReadEntry } from 'tar'
import {
  decodeCatalogSnapshot,
  decodeCatalogVersionPreflight,
  type CatalogCapability,
  type CatalogDetail,
  type CatalogDetailQuery,
  type CatalogDetailResult,
  type CatalogFreshness,
  type CatalogKind,
  type CatalogListQuery,
  type CatalogListResult,
  type CatalogSnapshot,
  type CatalogSource,
  type CatalogSummary,
  type CatalogVersionPreflight,
  type CompatibilityRequest,
} from '@deepseek-ai/dsh-plugin-center-contracts'
import { verifyPluginArtifact } from './artifact-verifier.ts'
import { CatalogCache } from './catalog-cache.ts'
import type {
  CatalogInstalledAuthority,
  CatalogPreflightSelection,
  PluginCatalogRepository,
} from './catalog-client.ts'

const NPM_REGISTRY_ORIGIN = 'https://registry.npmjs.org'
const NPM_SEARCH_URL = `${NPM_REGISTRY_ORIGIN}/-/v1/search`
const MAX_JSON_BYTES = 2 * 1024 * 1024
const MAX_ARTIFACT_BYTES = 64 * 1024 * 1024
const MAX_UNPACKED_BYTES = 256 * 1024 * 1024
const MAX_ARCHIVE_ENTRIES = 10_000
const MAX_CAPTURE_BYTES = 4 * 1024 * 1024
const REQUEST_TIMEOUT_MS = 15_000
const SEARCH_CACHE_MS = 60_000
const PACKAGE_NAME = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/u
const EXACT_VERSION = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/u
const STABLE_ID = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/u
const SHA512_INTEGRITY = /^sha512-[A-Za-z0-9+/]{86}==$/u

interface NpmSearchSeed {
  readonly name: string
  readonly version: string
  readonly updatedAt: string
  readonly publisher: string
}

interface NpmPackageReference {
  readonly pluginId: string
  readonly packageName: string
  readonly version: string
  readonly bundlePatch: string
  readonly hasClient: boolean
  readonly nodeRange: string
  readonly tarballUrl: string
  readonly integrity: string
  readonly summary: CatalogSummary
}

interface ArchiveInspection {
  readonly manifest: Record<string, unknown>
  readonly patch: string
  readonly entryCount: number
  readonly unpackedBytes: number
}

interface AuthorityState {
  readonly snapshot: CatalogSnapshot
  readonly source: CatalogSource
  readonly freshness: CatalogFreshness
}

interface AuthorityEntry {
  readonly detail: CatalogDetail
  readonly preflight: CatalogVersionPreflight
}

interface SearchCacheEntry {
  readonly expiresAt: number
  readonly result: CatalogListResult
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`)
  }
  return value as Record<string, unknown>
}

function optionalRecord(value: unknown, label: string): Record<string, unknown> | undefined {
  return value === undefined || value === null ? undefined : record(value, label)
}

function trimmedString(value: unknown, maximum: number): string | undefined {
  return typeof value === 'string' && value !== '' && value.trim() === value && value.length <= maximum
    ? value
    : undefined
}

function packageName(value: unknown): string {
  const decoded = trimmedString(value, 214)
  if (decoded === undefined || !PACKAGE_NAME.test(decoded)) throw new Error('npm package name is invalid')
  return decoded
}

function exactVersion(value: unknown): string {
  const decoded = trimmedString(value, 64)
  if (decoded === undefined || !EXACT_VERSION.test(decoded)) throw new Error('npm package version is invalid')
  return decoded
}

function canonicalInstant(value: unknown): string {
  const decoded = trimmedString(value, 80)
  if (decoded === undefined || !Number.isFinite(Date.parse(decoded))) throw new Error('npm publication date is invalid')
  return new Date(decoded).toISOString()
}

function stringList(value: unknown, maximum: number, itemMaximum: number): readonly string[] {
  if (!Array.isArray(value)) return []
  const result: string[] = []
  for (const item of value) {
    const decoded = trimmedString(item, itemMaximum)
    if (decoded === undefined || result.includes(decoded)) continue
    result.push(decoded)
    if (result.length === maximum) break
  }
  return result
}

function portableBundlePatch(value: unknown): string {
  const decoded = trimmedString(value, 256)
  if (decoded === undefined || decoded.startsWith('/') || decoded.startsWith('\\')
    || /^[A-Za-z]:/u.test(decoded) || decoded.includes('\\')) {
    throw new Error('dsh.bundle.patch must be a portable relative path')
  }
  const normalized = decoded.startsWith('./') ? decoded.slice(2) : decoded
  if (normalized === '' || normalized.split('/').some(segment => segment === '' || segment === '.' || segment === '..')) {
    throw new Error('dsh.bundle.patch must be a portable relative path')
  }
  return decoded
}

function npmPluginId(name: string): string {
  const normalized = name.replace(/^@/u, '').replace('/', '.').replace(/[^a-z0-9._-]+/gu, '-')
    .replace(/^[._-]+|[._-]+$/gu, '').slice(0, 90) || 'package'
  const digest = createHash('sha256').update(name).digest('hex').slice(0, 12)
  return `npm.${normalized}.${digest}`
}

function authorName(metadata: Record<string, unknown>, fallback: string): string {
  const author = metadata['author']
  if (typeof author === 'string') return trimmedString(author, 120) ?? fallback
  const authorRecord = optionalRecord(author, 'npm author')
  const namedAuthor = trimmedString(authorRecord?.['name'], 120)
  if (namedAuthor !== undefined) return namedAuthor
  const maintainers = metadata['maintainers']
  if (Array.isArray(maintainers) && maintainers.length > 0) {
    const maintainer = optionalRecord(maintainers[0], 'npm maintainer')
    return trimmedString(maintainer?.['name'], 120) ?? fallback
  }
  return fallback
}

function catalogKind(keywords: readonly string[], dsh: Record<string, unknown>): CatalogKind {
  const pluginCenter = optionalRecord(dsh['pluginCenter'], 'npm dsh.pluginCenter')
  const skillIds = stringList(pluginCenter?.['expectedSkillIds'], 64, 128)
  return skillIds.length > 0 || keywords.includes('dsh-skill-pack') ? 'skill-pack' : 'plugin'
}

function capabilities(keywords: readonly string[], hasClient: boolean): readonly CatalogCapability[] {
  const result: CatalogCapability[] = ['host']
  if (hasClient) result.push('client')
  if (keywords.some(keyword => ['skill', 'skills', 'agent-skill', 'dsh-skill-pack'].includes(keyword))) {
    result.push('skill')
  }
  return result
}

function summaryFor(reference: Omit<NpmPackageReference, 'summary'>, values: {
  readonly description: string
  readonly keywords: readonly string[]
  readonly publisher: string
  readonly updatedAt: string
}): CatalogSummary {
  const packageCapabilities = capabilities(values.keywords, reference.hasClient)
  return {
    pluginId: reference.pluginId,
    version: reference.version,
    catalogKind: catalogKind(values.keywords, { pluginCenter: undefined }),
    scope: 'public',
    displayName: reference.packageName,
    summary: values.description,
    publisher: values.publisher,
    verified: false,
    keywords: values.keywords,
    capabilities: packageCapabilities,
    icon: null,
    brandColor: null,
    compatibility: {
      status: 'unknown',
      reason: '安装前会下载确定版本并完成兼容性与产物校验。',
      platforms: ['darwin-arm64', 'win32-x64'],
    },
    updatedAt: values.updatedAt,
    installed: false,
  }
}

function searchMatches(entry: CatalogSummary, query: string): boolean {
  if (query === '') return true
  const needle = query.toLocaleLowerCase()
  return [entry.displayName, entry.summary, entry.publisher, ...entry.keywords]
    .some(value => value.toLocaleLowerCase().includes(needle))
}

async function fetchJson(fetcher: typeof fetch, url: URL, label: string): Promise<unknown> {
  const controller = new AbortController()
  const timeout = setTimeout(() => { controller.abort() }, REQUEST_TIMEOUT_MS)
  try {
    const response = await fetcher(url, {
      headers: { accept: 'application/json' },
      redirect: 'error',
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`${label} returned HTTP ${String(response.status)}`)
    const declared = Number(response.headers.get('content-length'))
    if (Number.isFinite(declared) && declared > MAX_JSON_BYTES) throw new Error(`${label} exceeds 2 MiB`)
    const text = await response.text()
    if (Buffer.byteLength(text, 'utf8') > MAX_JSON_BYTES) throw new Error(`${label} exceeds 2 MiB`)
    return JSON.parse(text) as unknown
  } finally {
    clearTimeout(timeout)
  }
}

async function fetchArtifact(fetcher: typeof fetch, rawUrl: string): Promise<Uint8Array> {
  const url = new URL(rawUrl)
  if (url.origin !== NPM_REGISTRY_ORIGIN || url.protocol !== 'https:' || url.username !== ''
    || url.password !== '' || url.hash !== '') {
    throw new Error('npm artifact URL is outside the fixed registry origin')
  }
  const controller = new AbortController()
  const timeout = setTimeout(() => { controller.abort() }, REQUEST_TIMEOUT_MS)
  try {
    const response = await fetcher(url, {
      headers: { accept: 'application/octet-stream' },
      redirect: 'error',
      signal: controller.signal,
    })
    if (!response.ok || response.body === null) throw new Error(`npm artifact returned HTTP ${String(response.status)}`)
    const declared = Number(response.headers.get('content-length'))
    if (Number.isFinite(declared) && declared > MAX_ARTIFACT_BYTES) throw new Error('npm artifact exceeds 64 MiB')
    const chunks: Uint8Array[] = []
    let length = 0
    const reader = response.body.getReader()
    try {
      for (;;) {
        const next = await reader.read()
        if (next.done) break
        length += next.value.byteLength
        if (length > MAX_ARTIFACT_BYTES) {
          await reader.cancel('artifact size limit exceeded')
          throw new Error('npm artifact exceeds 64 MiB')
        }
        chunks.push(next.value)
      }
    } finally {
      reader.releaseLock()
    }
    const bytes = new Uint8Array(length)
    let offset = 0
    for (const chunk of chunks) {
      bytes.set(chunk, offset)
      offset += chunk.byteLength
    }
    return bytes
  } finally {
    clearTimeout(timeout)
  }
}

function archiveMember(path: string): string {
  return `package/${path.startsWith('./') ? path.slice(2) : path}`
}

function inspectArchive(bytes: Uint8Array, bundlePatch: string): Promise<ArchiveInspection> {
  const manifestPath = 'package/package.json'
  const patchPath = archiveMember(bundlePatch)
  let manifestBytes: Buffer | undefined
  let patchBytes: Buffer | undefined
  let entryCount = 0
  let unpackedBytes = 0

  return new Promise((resolve, reject) => {
    const parser = new Parser({ strict: true, maxMetaEntrySize: 1024 * 1024, maxDecompressionRatio: 200 })
    parser.on('entry', (entry: ReadEntry) => {
      entryCount += 1
      unpackedBytes += entry.size
      if (entryCount > MAX_ARCHIVE_ENTRIES || unpackedBytes > MAX_UNPACKED_BYTES) {
        entry.resume()
        parser.abort(new Error('npm artifact exceeds archive inspection bounds'))
        return
      }
      const rawPath = entry.header.path ?? entry.path
      const normalized = rawPath.startsWith('./') ? rawPath.slice(2) : rawPath
      const limit = normalized === manifestPath ? 1024 * 1024 : normalized === patchPath ? MAX_CAPTURE_BYTES : 0
      if (limit === 0 || entry.type === 'Directory') {
        entry.resume()
        return
      }
      const chunks: Buffer[] = []
      let length = 0
      entry.on('data', (chunk: Buffer) => {
        length += chunk.length
        if (length <= limit) chunks.push(Buffer.from(chunk))
      })
      entry.on('end', () => {
        if (length > limit) {
          parser.abort(new Error('npm artifact metadata exceeds inspection bounds'))
          return
        }
        if (normalized === manifestPath) manifestBytes = Buffer.concat(chunks)
        else patchBytes = Buffer.concat(chunks)
      })
      entry.resume()
    })
    parser.once('error', (error: unknown) => { reject(error instanceof Error ? error : new Error(String(error))) })
    parser.once('end', () => {
      if (manifestBytes === undefined || patchBytes === undefined) {
        reject(new Error('npm artifact is missing its package manifest or Bundle patch'))
        return
      }
      try {
        resolve({
          manifest: record(JSON.parse(manifestBytes.toString('utf8')) as unknown, 'npm artifact package.json'),
          patch: patchBytes.toString('utf8'),
          entryCount,
          unpackedBytes,
        })
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    })
    parser.end(Buffer.from(bytes))
  })
}

function patchValues(patch: string, key: 'id' | 'name'): readonly string[] {
  const values = new Set<string>()
  const expression = key === 'id' ? /^\s*-\s+id:\s+(.+?)\s*$/u : /^\s+name:\s+(.+?)\s*$/u
  for (const line of patch.split(/\r?\n/u)) {
    const matched = line.match(expression)?.[1]?.trim()
    if (matched === undefined) continue
    const unquoted = ((matched.startsWith("'") && matched.endsWith("'"))
      || (matched.startsWith('"') && matched.endsWith('"'))) ? matched.slice(1, -1) : matched
    values.add(unquoted)
  }
  return [...values]
}

function searchSeeds(value: unknown): readonly NpmSearchSeed[] {
  const source = record(value, 'npm search response')
  const objects = source['objects']
  if (!Array.isArray(objects) || objects.length > 60) throw new Error('npm search response has invalid objects')
  return objects.flatMap((item, index) => {
    try {
      const packageValue = record(record(item, `npm search object ${String(index)}`)['package'], 'npm search package')
      const keywords = stringList(packageValue['keywords'], 64, 80)
      if (!keywords.includes('dsh-plugin')) return []
      const publisherValue = optionalRecord(packageValue['publisher'], 'npm search publisher')
      return [{
        name: packageName(packageValue['name']),
        version: exactVersion(packageValue['version']),
        updatedAt: canonicalInstant(packageValue['date']),
        publisher: trimmedString(publisherValue?.['username'], 120) ?? 'npm publisher',
      }]
    } catch {
      return []
    }
  })
}

async function mapConcurrent<T, U>(
  values: readonly T[],
  concurrency: number,
  project: (value: T) => Promise<U>,
): Promise<readonly U[]> {
  const output: U[] = new Array(values.length)
  let cursor = 0
  const workers = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    for (;;) {
      const index = cursor
      cursor += 1
      if (index >= values.length) return
      output[index] = await project(values[index] as T)
    }
  })
  await Promise.all(workers)
  return output
}

function sectioned(entries: readonly CatalogSummary[], query: string): CatalogListResult['sections'] {
  if (query !== '') return { featured: entries, popular: [], recent: [] }
  return {
    featured: entries.slice(0, 6),
    popular: entries.slice(6, 18),
    recent: entries.slice(18),
  }
}

function snapshotEntries(snapshot: CatalogSnapshot): readonly AuthorityEntry[] {
  return snapshot.preflights.flatMap((preflight) => {
    const detail = snapshot.details.find(value => value.summary.pluginId === preflight.pluginId
      && value.summary.version === preflight.version)
    return detail === undefined ? [] : [{ detail, preflight }]
  })
}

function createSnapshot(entries: readonly AuthorityEntry[], generatedAt: string): CatalogSnapshot {
  const exact = new Map(entries.map(entry => [
    `${entry.preflight.pluginId}@${entry.preflight.version}`,
    entry,
  ]))
  const retained = [...exact.values()].sort((left, right) =>
    right.detail.summary.updatedAt.localeCompare(left.detail.summary.updatedAt)).slice(0, 100)
  const identity = retained.map(entry => ({
    pluginId: entry.preflight.pluginId,
    version: entry.preflight.version,
    packageName: entry.preflight.packageName,
    integrity: entry.preflight.artifacts[0]?.integrity ?? '',
  }))
  const etag = `npm-ecosystem-${createHash('sha256').update(JSON.stringify(identity)).digest('hex').slice(0, 32)}`
  const preflights = retained.map(entry => ({ ...entry.preflight, catalogEtag: etag }))
  const summaries = retained.map(entry => entry.detail.summary)
  const ids = [...new Set(summaries.map(summary => summary.pluginId))]
  return decodeCatalogSnapshot({
    schemaVersion: 1,
    etag,
    generatedAt,
    maxAgeSeconds: 86_400,
    sections: {
      featured: ids.slice(0, 6),
      popular: ids.slice(6, 66),
      recent: ids.slice(66),
    },
    entries: summaries,
    details: retained.map(entry => entry.detail),
    preflights,
  })
}

/** Search npm's public dsh-plugin index and publish only exact validated DSH Bundles. */
export class NpmEcosystemCatalogRepository implements PluginCatalogRepository {
  private authorityState: AuthorityState | undefined
  private authorityLoading: Promise<AuthorityState> | undefined
  private readonly packageReferences = new Map<string, NpmPackageReference>()
  private readonly searchCache = new Map<string, SearchCacheEntry>()
  private readonly searches = new Map<string, Promise<CatalogListResult>>()
  private readonly hydrations = new Map<string, Promise<AuthorityEntry>>()
  private publicationGate: Promise<void> = Promise.resolve()

  constructor(
    private readonly cache: CatalogCache,
    private readonly fetcher: typeof fetch = fetch,
    private readonly now: () => number = Date.now,
  ) {}

  private currentAuthority(): Promise<AuthorityState> {
    this.authorityLoading ??= this.cache.read().catch(() => undefined).then((cached) => {
      const validEntries = cached === undefined ? [] : snapshotEntries(cached).filter(entry =>
        entry.preflight.pluginId.startsWith('npm.')
        && entry.preflight.artifacts.length > 0
        && entry.preflight.artifacts.every(artifact => new URL(artifact.url).origin === NPM_REGISTRY_ORIGIN))
      const snapshot = createSnapshot(validEntries, new Date(this.now()).toISOString())
      const state: AuthorityState = {
        snapshot,
        source: validEntries.length === 0 ? 'bundled' : 'cache',
        freshness: validEntries.length === 0 ? 'stale' : 'cached',
      }
      this.authorityState = state
      return state
    })
    return this.authorityState === undefined ? this.authorityLoading : Promise.resolve(this.authorityState)
  }

  private async decodeReference(seed: NpmSearchSeed): Promise<NpmPackageReference> {
    const url = new URL(`${NPM_REGISTRY_ORIGIN}/${encodeURIComponent(seed.name)}/${encodeURIComponent(seed.version)}`)
    const metadata = record(await fetchJson(this.fetcher, url, `${seed.name}@${seed.version}`), 'npm version metadata')
    const decodedName = packageName(metadata['name'])
    const decodedVersion = exactVersion(metadata['version'])
    if (decodedName !== seed.name || decodedVersion !== seed.version) throw new Error('npm exact metadata identity changed')
    const keywords = stringList(metadata['keywords'], 24, 48)
    if (!keywords.includes('dsh-plugin')) throw new Error('npm exact version is not tagged dsh-plugin')
    const dsh = record(metadata['dsh'], 'npm dsh manifest')
    const bundle = record(dsh['bundle'], 'npm dsh.bundle manifest')
    const bundlePatch = portableBundlePatch(bundle['patch'])
    const client = optionalRecord(dsh['client'], 'npm dsh.client manifest')
    const dist = record(metadata['dist'], 'npm dist metadata')
    const tarballUrl = trimmedString(dist['tarball'], 2048)
    const integrity = trimmedString(dist['integrity'], 96)
    if (tarballUrl === undefined || integrity === undefined || !SHA512_INTEGRITY.test(integrity)) {
      throw new Error('npm exact version lacks immutable distribution evidence')
    }
    const parsedTarball = new URL(tarballUrl)
    if (parsedTarball.origin !== NPM_REGISTRY_ORIGIN || parsedTarball.protocol !== 'https:') {
      throw new Error('npm tarball is outside the fixed registry origin')
    }
    const description = trimmedString(metadata['description'], 280) ?? `DeepSeek Harness Bundle ${decodedName}`
    const engines = optionalRecord(metadata['engines'], 'npm engines')
    const nodeRange = trimmedString(engines?.['node'], 160) ?? '>=22.19 <25'
    const base = {
      pluginId: npmPluginId(decodedName),
      packageName: decodedName,
      version: decodedVersion,
      bundlePatch,
      hasClient: client !== undefined,
      nodeRange,
      tarballUrl,
      integrity,
    } as const
    return {
      ...base,
      summary: {
        ...summaryFor(base, {
          description,
          keywords,
          publisher: authorName(metadata, seed.publisher),
          updatedAt: seed.updatedAt,
        }),
        catalogKind: catalogKind(keywords, dsh),
      },
    }
  }

  private async searchNetwork(query: CatalogListQuery): Promise<CatalogListResult> {
    const url = new URL(NPM_SEARCH_URL)
    url.searchParams.set('text', query.query.trim() === ''
      ? 'keywords:dsh-plugin'
      : `keywords:dsh-plugin ${query.query.trim()}`)
    url.searchParams.set('size', String(Math.min(60, Math.max(query.limit * 2, 24))))
    const seeds = searchSeeds(await fetchJson(this.fetcher, url, 'npm dsh-plugin search'))
    const references = (await mapConcurrent(seeds, 8, async (seed) => {
      try {
        return await this.decodeReference(seed)
      } catch {
        return null
      }
    })).filter((value): value is NpmPackageReference => value !== null)
    const authority = await this.currentAuthority()
    const verified = new Map(authority.snapshot.entries.map(entry => [
      `${entry.pluginId}@${entry.version}`,
      entry,
    ]))
    for (const reference of references) {
      this.packageReferences.set(`${reference.pluginId}@${reference.version}`, reference)
    }
    const entries = references.map(reference =>
      verified.get(`${reference.pluginId}@${reference.version}`) ?? reference.summary)
      .filter(entry => entry.catalogKind === query.catalogKind && searchMatches(entry, query.query.trim()))
      .slice(0, query.limit)
    const generatedAt = new Date(this.now()).toISOString()
    const etag = `npm-search-${createHash('sha256').update(JSON.stringify(entries.map(entry =>
      [entry.pluginId, entry.version]))).digest('hex').slice(0, 24)}`
    return {
      etag,
      generatedAt,
      freshness: 'fresh',
      source: 'network',
      sections: sectioned(entries, query.query.trim()),
    }
  }

  private async fallback(query: CatalogListQuery): Promise<CatalogListResult> {
    const state = await this.currentAuthority()
    const entries = state.snapshot.entries.filter(entry =>
      entry.catalogKind === query.catalogKind
      && entry.scope === query.scope
      && searchMatches(entry, query.query.trim())).slice(0, query.limit)
    return {
      etag: state.snapshot.etag,
      generatedAt: state.snapshot.generatedAt,
      freshness: 'stale',
      source: state.source,
      sections: sectioned(entries, query.query.trim()),
    }
  }

  async list(query: CatalogListQuery): Promise<CatalogListResult> {
    if (query.scope === 'local') return await this.fallback(query)
    const key = JSON.stringify(query)
    const cached = this.searchCache.get(key)
    if (cached !== undefined && cached.expiresAt > this.now()) return cached.result
    const running = this.searches.get(key)
    if (running !== undefined) return await running
    const search = this.searchNetwork(query).catch(() => this.fallback(query)).then((result) => {
      this.searchCache.set(key, { expiresAt: this.now() + SEARCH_CACHE_MS, result })
      return result
    }).finally(() => { this.searches.delete(key) })
    this.searches.set(key, search)
    return await search
  }

  async refresh(query: CatalogListQuery): Promise<CatalogListResult> {
    this.searchCache.delete(JSON.stringify(query))
    return await this.list(query)
  }

  private async hydrate(reference: NpmPackageReference): Promise<AuthorityEntry> {
    const key = `${reference.pluginId}@${reference.version}`
    const state = await this.currentAuthority()
    const retained = snapshotEntries(state.snapshot).find(entry =>
      entry.preflight.pluginId === reference.pluginId && entry.preflight.version === reference.version)
    if (retained !== undefined) return retained
    const running = this.hydrations.get(key)
    if (running !== undefined) return await running
    const hydration = this.createAuthority(reference).finally(() => { this.hydrations.delete(key) })
    this.hydrations.set(key, hydration)
    return await hydration
  }

  private async createAuthority(reference: NpmPackageReference): Promise<AuthorityEntry> {
    const bytes = await fetchArtifact(this.fetcher, reference.tarballUrl)
    const integrity = `sha512-${createHash('sha512').update(bytes).digest('base64')}`
    if (integrity !== reference.integrity) throw new Error('npm tarball does not match its registry integrity')
    const inspection = await inspectArchive(bytes, reference.bundlePatch)
    if (inspection.manifest['name'] !== reference.packageName
      || inspection.manifest['version'] !== reference.version) {
      throw new Error('npm tarball package identity differs from exact metadata')
    }
    const dsh = record(inspection.manifest['dsh'], 'npm artifact dsh manifest')
    const bundle = record(dsh['bundle'], 'npm artifact dsh.bundle manifest')
    if (bundle['patch'] !== reference.bundlePatch) throw new Error('npm tarball Bundle declaration changed')
    const entryIds = patchValues(inspection.patch, 'id')
    if (entryIds.length === 0 || entryIds.some(entryId => !STABLE_ID.test(entryId))) {
      throw new Error('npm Bundle has no stable Loader entry evidence')
    }
    const moduleNames = patchValues(inspection.patch, 'name')
    const client = optionalRecord(dsh['client'], 'npm artifact dsh.client manifest')
    if ((client !== undefined) !== reference.hasClient) throw new Error('npm tarball client declaration changed')
    const expectedClientModules = reference.hasClient ? [reference.packageName] : []
    if (expectedClientModules.some(moduleName => !moduleNames.includes(moduleName))) {
      throw new Error('npm Bundle does not mount its declared client module')
    }
    const pluginCenter = optionalRecord(dsh['pluginCenter'], 'npm artifact dsh.pluginCenter manifest')
    const expectedSkillIds = stringList(pluginCenter?.['expectedSkillIds'], 64, 128)
    if (expectedSkillIds.some(skillId => !STABLE_ID.test(skillId))) {
      throw new Error('npm Bundle declares an invalid Skill identity')
    }
    const verifiedSummary: CatalogSummary = {
      ...reference.summary,
      verified: true,
      compatibility: {
        ...reference.summary.compatibility,
        reason: '确定版本的 npm 完整性、包身份与 Bundle 激活声明已校验；安装前仍会核对本机环境。',
      },
    }
    const riskSummary = '这是社区发布的 DSH Bundle，产物身份已经校验，但代码未经过 DeepSeek 官方安全审计，运行时拥有应用进程权限。'
    const candidate = decodeCatalogVersionPreflight({
      pluginId: reference.pluginId,
      version: reference.version,
      packageName: reference.packageName,
      catalogEtag: 'npm-pending',
      reviewed: true,
      eligible: true,
      withdrawn: false,
      desktopRange: '>=0.1.0-rc.1 <0.2.0',
      dshRange: '>=0.1.0-rc.1 <0.2.0',
      nodeRange: reference.nodeRange,
      artifacts: (['darwin-arm64', 'win32-x64'] as const).map(platform => ({
        platform,
        url: reference.tarballUrl,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        integrity,
        packedBytes: bytes.byteLength,
        unpackedBytes: inspection.unpackedBytes,
        fileCount: inspection.entryCount,
      })),
      bundlePatch: reference.bundlePatch,
      capabilities: verifiedSummary.capabilities,
      riskLevel: 'high',
      riskSummary,
      executionAuthority: 'broad-application-authority',
      conflicts: { pluginIds: [], packageNames: [], entryIds: [] },
      expectedEntries: entryIds,
      expectedClientModules,
      expectedSkillIds,
      supportedActions: ['install', 'update', 'enable', 'disable', 'uninstall'],
      restartRequired: true,
    })
    const verification = await verifyPluginArtifact({ bytes, candidate, platform: 'darwin-arm64' })
    if (!verification.verified) throw new Error('npm Bundle failed non-executing artifact verification')
    const detail: CatalogDetail = {
      summary: verifiedSummary,
      description: reference.summary.summary,
      screenshots: [],
      permissions: [
        '安装后向当前 DeepSeek Harness Profile 注册 Bundle 条目。',
        '插件代码会随 Harness Host 运行，并可获得应用进程权限。',
      ],
      riskLevel: 'high',
      riskSummary,
      changelog: `npm 确定版本 ${reference.version}。`,
      publishedAt: reference.summary.updatedAt,
      expectedEntries: entryIds,
      expectedClientModules,
      expectedSkillIds,
      eligible: true,
      withdrawn: false,
    }
    let release!: () => void
    const previous = this.publicationGate
    this.publicationGate = new Promise<void>((resolve) => { release = resolve })
    await previous
    try {
      const current = await this.currentAuthority()
      const nextSnapshot = createSnapshot([
        ...snapshotEntries(current.snapshot),
        { detail, preflight: candidate },
      ], new Date(this.now()).toISOString())
      await this.cache.save(nextSnapshot)
      const next: AuthorityState = { snapshot: nextSnapshot, source: 'network', freshness: 'fresh' }
      this.authorityState = next
      const retainedPreflight = nextSnapshot.preflights.find(value => value.pluginId === reference.pluginId
        && value.version === reference.version)
      if (retainedPreflight === undefined) throw new Error('validated npm Bundle was not retained in catalog authority')
      return { detail, preflight: retainedPreflight }
    } finally {
      release()
    }
  }

  async detail(query: CatalogDetailQuery): Promise<CatalogDetailResult> {
    const current = await this.currentAuthority()
    const cached = current.snapshot.details.find(item => item.summary.pluginId === query.pluginId
      && item.summary.version === query.version)
    if (cached !== undefined) {
      return {
        etag: current.snapshot.etag,
        generatedAt: current.snapshot.generatedAt,
        freshness: current.freshness,
        source: current.source,
        detail: cached,
      }
    }
    const reference = this.packageReferences.get(`${query.pluginId}@${query.version}`)
    if (reference === undefined) {
      return {
        etag: current.snapshot.etag,
        generatedAt: current.snapshot.generatedAt,
        freshness: current.freshness,
        source: current.source,
        detail: null,
      }
    }
    const entry = await this.hydrate(reference)
    const state = await this.currentAuthority()
    return {
      etag: state.snapshot.etag,
      generatedAt: state.snapshot.generatedAt,
      freshness: state.freshness,
      source: state.source,
      detail: entry.detail,
    }
  }

  async resolvePreflight(request: CompatibilityRequest): Promise<CatalogPreflightSelection> {
    let state = await this.currentAuthority()
    let candidate = state.snapshot.preflights.find(item => item.pluginId === request.pluginId
      && item.version === request.version) ?? null
    if (candidate === null) {
      const reference = this.packageReferences.get(`${request.pluginId}@${request.version}`)
      if (reference !== undefined) {
        try {
          await this.hydrate(reference)
          state = await this.currentAuthority()
          candidate = state.snapshot.preflights.find(item => item.pluginId === request.pluginId
            && item.version === request.version) ?? null
        } catch {
          candidate = null
        }
      }
    }
    return {
      candidate,
      candidates: state.snapshot.preflights,
      etag: state.snapshot.etag,
      freshness: state.freshness,
    }
  }

  async installedAuthority(): Promise<CatalogInstalledAuthority> {
    const state = await this.currentAuthority()
    return {
      etag: state.snapshot.etag,
      freshness: state.freshness,
      entries: state.snapshot.entries,
      details: state.snapshot.details,
      preflights: state.snapshot.preflights,
    }
  }
}
