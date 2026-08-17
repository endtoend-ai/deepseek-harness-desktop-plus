import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { strFromU8, unzipSync } from 'fflate'
import { ResourcePresetSquareCatalog } from '../src/preset-square/bundled-catalog.ts'

const resources = fileURLToPath(new URL('../resources/preset-square/presets/', import.meta.url))

describe('bundled Preset Square catalog', () => {
  it('materializes six compact first-party archives with eight Skills and no install-machine placeholders', async () => {
    const catalog = new ResourcePresetSquareCatalog(resources)
    const items = await catalog.list()
    expect(items).toHaveLength(6)
    expect(items.map(item => item.source)).toEqual(Array(6).fill('fufan-official'))
    expect(items.map(item => item.publisher.username)).toEqual(Array(6).fill('赋范官方'))

    let archiveBytes = 0
    let skills = 0
    for (const item of items) {
      const archive = await catalog.archive(item.slug)
      expect(archive).toBeDefined()
      if (archive === undefined) continue
      archiveBytes += archive.length
      expect(createHash('sha256').update(archive).digest('hex')).toBe(item.artifact.sha256)
      const files = unzipSync(archive)
      expect(files['manifest.json']).toBeDefined()
      expect(files['preset/agent.cordis.yml']).toBeDefined()
      const composition = strFromU8(files['preset/agent.cordis.yml'] ?? new Uint8Array())
      expect(composition).not.toContain('__CASE_')
      expect(composition).not.toContain('__FEISHU_')
      skills += Object.keys(files).filter(path => /^preset\/skills\/[^/]+\/SKILL\.md$/u.test(path)).length
    }
    expect(skills).toBe(8)
    expect(archiveBytes).toBeLessThan(2 * 1024 * 1024)
  })
})
