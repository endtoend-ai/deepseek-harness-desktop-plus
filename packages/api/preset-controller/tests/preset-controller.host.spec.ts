/** The `preset` Remote namespace over a double, and the archive validator it exposes. */

import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { remoteErrorOf, remoteMethods } from '@deepseek-ai/dsh-typert-protocol'
import { strToU8, zipSync } from 'fflate'
import PresetController, {
  PresetArchiveError, parsePresetArchive, previewPresetArchive,
} from '../src/index.ts'
import type { PresetArchiveRoster } from '../src/index.ts'

function archiveBytes(overrides: Record<string, Uint8Array> = {}): Uint8Array {
  return zipSync({
    'manifest.json': strToU8(JSON.stringify({
      format: 'dsh-preset',
      version: 1,
      id: 'fixture-preset',
      name: 'Fixture Preset',
      sourceDshVersion: '0.1.0-rc.5',
    })),
    'preset/agent.cordis.yml': strToU8('- name: fixture.plugin\n'),
    'preset/README.md': strToU8('Fixture preset.'),
    ...overrides,
  })
}

function archive(overrides: Record<string, Uint8Array> = {}): { bytes: Uint8Array; data: string } {
  const bytes = archiveBytes(overrides)
  return { bytes, data: Buffer.from(bytes).toString('base64') }
}

function rosterOf(ids: readonly string[] = []): PresetArchiveRoster {
  return { list: async () => ids.map(id => ({ id })) }
}

function controllerOf(roster: PresetArchiveRoster, currentDshVersion = '0.1.0-rc.5'): PresetController {
  return new PresetController(new Context(), { roster, currentDshVersion })
}

describe('preset archive preview', () => {
  it('reads a valid package without writing anything', async () => {
    const preview = await previewPresetArchive(rosterOf(), archive().bytes, { currentDshVersion: '0.1.0-rc.5' })
    expect(preview).toMatchObject({
      targetId: 'fixture-preset',
      sourcePresetId: 'fixture-preset',
      name: 'Fixture Preset',
      fileCount: 2,
      conflict: false,
      installed: false,
    })
    expect(preview.warnings).toEqual([])
  })

  it('reports executable-content warnings and a version mismatch', async () => {
    const parsed = parsePresetArchive(archiveBytes({
      'preset/config.yml': strToU8('api_key: "sk-12345678901234567890"\npath: /Users/example/work\n'),
    }))
    expect(parsed.warnings).toEqual(['absolute-paths', 'possible-secrets'])
    const preview = await previewPresetArchive(rosterOf(), archive().bytes, { currentDshVersion: '0.1.0-rc.7' })
    expect(preview.warnings).toEqual(['version-mismatch'])
  })

  it('does not mistake an HTTPS URL scheme for a Windows absolute path', () => {
    const parsed = parsePresetArchive(archiveBytes({
      'preset/scripts/search.mjs': strToU8("const registry = 'https://registry.npmjs.org'\n"),
    }))
    const windowsPath = parsePresetArchive(archiveBytes({
      'preset/config.yml': strToU8('workspace: C:\\Users\\example\\work\n'),
    }))
    expect(parsed.warnings).toEqual([])
    expect(windowsPath.warnings).toEqual(['absolute-paths'])
  })

  it('reports a taken target identity as a conflict', async () => {
    const preview = await previewPresetArchive(rosterOf(['fixture-preset']), archive().bytes, { currentDshVersion: '0.1.0-rc.5' })
    expect(preview.conflict).toBe(true)
    const renamed = await previewPresetArchive(rosterOf(['fixture-preset']), archive().bytes, {
      targetId: 'renamed-preset',
      currentDshVersion: '0.1.0-rc.5',
    })
    expect(renamed).toMatchObject({ targetId: 'renamed-preset', sourcePresetId: 'fixture-preset', conflict: false })
  })

  it.each([
    ['missing composition', zipSync({
      'manifest.json': strToU8(JSON.stringify({ format: 'dsh-preset', version: 1, id: 'fixture-preset' })),
    })],
    ['parent traversal', zipSync({ '../escape': strToU8('bad') })],
    ['absolute path', zipSync({ '/escape': strToU8('bad') })],
    ['invalid manifest', zipSync({ 'manifest.json': strToU8('{}'), 'preset/agent.cordis.yml': strToU8('[]') })],
  ])('rejects %s', (_name, data) => {
    expect(() => parsePresetArchive(data)).toThrow(PresetArchiveError)
  })

  it('refuses an unusable target identity', async () => {
    await expect(previewPresetArchive(rosterOf(), archive().bytes, { targetId: 'Not Valid', currentDshVersion: '0.1.0-rc.5' }))
      .rejects.toMatchObject({ status: 400 })
  })
})

describe('preset Remote', () => {
  it('publishes the import endpoint under the preset namespace', () => {
    const controller = controllerOf(rosterOf())
    expect(controller.typertRemote.namespace).toBe('preset')
    expect(remoteMethods(controller).map(method => method.method)).toEqual(['importArchive'])
  })

  it('answers an archive preview through the injected roster and version', async () => {
    const controller = controllerOf(rosterOf())
    await expect(controller.importArchive(archive().data, { install: false }, new AbortController().signal))
      .resolves.toMatchObject({ targetId: 'fixture-preset', installed: false, conflict: false })
  })

  it('refuses an install without claiming the package was installed', async () => {
    const controller = controllerOf(rosterOf())
    const failure = await controller.importArchive(archive().data, { install: true }, new AbortController().signal)
      .catch((error: unknown) => error)
    expect(remoteErrorOf(failure)).toMatchObject({ code: 'preset/install-unavailable' })
    expect(remoteErrorOf(failure)?.message).toContain('composition rows')
  })

  it('maps an archive refusal to preset/rejected with its status', async () => {
    const controller = controllerOf(rosterOf())
    const failure = await controller.importArchive(Buffer.from('not a zip').toString('base64'), { install: false }, new AbortController().signal)
      .catch((error: unknown) => error)
    expect(remoteErrorOf(failure)?.code).toBe('preset/rejected')
    expect(remoteErrorOf(failure)?.details).toMatchObject({ operation: 'preset.importArchive' })
  })

  it('reports a deployment with no preset roster', async () => {
    const controller = new PresetController(new Context(), { currentDshVersion: '0.1.0-rc.5' })
    const failure = await controller.importArchive(archive().data, { install: false }, new AbortController().signal)
      .catch((error: unknown) => error)
    expect(remoteErrorOf(failure)?.code).toBe('preset/rejected')
    expect(remoteErrorOf(failure)?.message).toContain('agent-preset-registry')
  })

  it('reports cancellation as its own outcome', async () => {
    const controller = controllerOf(rosterOf())
    const aborted = new AbortController()
    aborted.abort()
    const failure = await controller.importArchive(archive().data, { install: false }, aborted.signal)
      .catch((error: unknown) => error)
    expect(remoteErrorOf(failure)?.code).toBe('gateway/cancelled')
  })
})
