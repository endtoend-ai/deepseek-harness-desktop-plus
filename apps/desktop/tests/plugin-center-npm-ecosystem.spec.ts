import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CatalogCache } from '../src/plugin-center/catalog-cache.ts'
import { NpmEcosystemCatalogRepository } from '../src/plugin-center/npm-ecosystem-catalog.ts'

const roots: string[] = []
const NOW = Date.parse('2026-08-15T08:00:00.000Z')
const PACKAGE_NAME = '@deepseek-ai/dsh-plugin-center-fixture'
const VERSION = '0.1.0-rc.5'
const TARBALL_URL = `https://registry.npmjs.org/${PACKAGE_NAME}/-/${VERSION}.tgz`
const QUERY = { catalogKind: 'plugin', scope: 'public', query: 'workspace', limit: 24 } as const

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'dsh-npm-ecosystem-'))
  roots.push(root)
  return root
}

describe('npm DSH ecosystem catalog', () => {
  it('searches tagged Bundles, hydrates exact artifact authority, and reuses it offline', async () => {
    const root = await temporaryRoot()
    const bytes = await readFile(new URL(
      '../resources/plugin-center/fixtures/deepseek-ai-dsh-plugin-center-fixture-0.1.0-rc.5.tgz',
      import.meta.url,
    ))
    const integrity = `sha512-${createHash('sha512').update(bytes).digest('base64')}`
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
      if (url.pathname === '/-/v1/search') {
        return new Response(JSON.stringify({
          total: 571,
          objects: [{
            package: {
              name: PACKAGE_NAME,
              version: VERSION,
              date: '2026-08-15T07:00:00.000Z',
              keywords: ['dsh-plugin', 'workspace'],
              publisher: { username: 'deepseek-ai' },
            },
          }],
        }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      if (url.href === TARBALL_URL) {
        return new Response(bytes, {
          status: 200,
          headers: { 'content-length': String(bytes.byteLength) },
        })
      }
      return new Response(JSON.stringify({
        name: PACKAGE_NAME,
        version: VERSION,
        description: 'Workspace tools for DeepSeek Harness',
        keywords: ['dsh-plugin', 'workspace'],
        author: { name: 'DeepSeek Harness' },
        engines: { node: '>=22.19 <25' },
        dsh: {
          bundle: { patch: './cordis.patch.yml' },
          client: { platform: 'web', inject: [] },
          pluginCenter: {
            expectedEntries: ['fixture.workspace-tools'],
            expectedClientModules: [PACKAGE_NAME],
            expectedSkillIds: [],
          },
        },
        dist: { tarball: TARBALL_URL, integrity },
      }), { status: 200, headers: { 'content-type': 'application/json' } })
    })
    const cache = new CatalogCache(root)
    const repository = new NpmEcosystemCatalogRepository(cache, fetcher, () => NOW)

    const list = await repository.list(QUERY)
    const summary = list.sections.featured[0]
    expect(list).toMatchObject({ source: 'network', freshness: 'fresh' })
    expect(summary).toMatchObject({ displayName: PACKAGE_NAME, verified: false })

    const detail = await repository.detail({ pluginId: summary!.pluginId, version: VERSION })
    expect(detail.detail).toMatchObject({
      summary: { verified: true },
      expectedEntries: ['fixture.workspace-tools'],
      expectedClientModules: [PACKAGE_NAME],
      riskLevel: 'high',
    })
    const selection = await repository.resolvePreflight({
      pluginId: summary!.pluginId,
      version: VERSION,
      action: 'install',
    })
    expect(selection.candidate).toMatchObject({ packageName: PACKAGE_NAME, reviewed: true })
    expect(selection.candidate?.artifacts).toContainEqual(expect.objectContaining({
      url: TARBALL_URL,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    }))

    const offline = new NpmEcosystemCatalogRepository(cache, vi.fn<typeof fetch>(async () => {
      throw new Error('offline')
    }), () => NOW)
    await expect(offline.installedAuthority()).resolves.toMatchObject({
      freshness: 'cached',
      entries: [{ displayName: PACKAGE_NAME, verified: true }],
      preflights: [{ packageName: PACKAGE_NAME }],
    })
  })

  it('excludes tagged npm packages that do not declare a DSH Bundle', async () => {
    const root = await temporaryRoot()
    const fetcher: typeof fetch = async (input) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
      if (url.pathname === '/-/v1/search') {
        return new Response(JSON.stringify({
          objects: [{
            package: {
              name: 'plain-library',
              version: '1.0.0',
              date: '2026-08-15T07:00:00.000Z',
              keywords: ['dsh-plugin'],
              publisher: { username: 'publisher' },
            },
          }],
        }), { status: 200 })
      }
      return new Response(JSON.stringify({
        name: 'plain-library',
        version: '1.0.0',
        keywords: ['dsh-plugin'],
        dist: {},
      }), { status: 200 })
    }
    const repository = new NpmEcosystemCatalogRepository(new CatalogCache(root), fetcher, () => NOW)

    await expect(repository.list({ ...QUERY, query: '' })).resolves.toMatchObject({
      source: 'network',
      sections: { featured: [], popular: [], recent: [] },
    })
  })
})
