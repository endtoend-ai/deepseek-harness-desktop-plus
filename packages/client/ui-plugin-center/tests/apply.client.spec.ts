// @vitest-environment jsdom
import { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import { resolveSlotLabel } from '@deepseek-ai/dsh-client-ui-slots'
import { usePinnedBrowserLanguages } from '@deepseek-ai/dsh-client-test-runtime'
import { apply, inject, NS } from '../src/client/index.ts'
import { PluginCenterIcon } from '../src/client/PluginCenterIcon.tsx'
import { PluginCenterTab } from '../src/client/PluginCenterTab.tsx'
import { PluginDiscoveryIcon } from '../src/client/PluginDiscoveryIcon.tsx'
import { PluginDiscoveryPage, type PluginDiscoveryInjected } from '../src/client/PluginDiscoveryPage.tsx'
import { PresetSquareIcon } from '../src/client/PresetSquareIcon.tsx'
import { PresetSquarePage, type PresetSquarePageInjected } from '../src/client/PresetSquarePage.tsx'
import { ApplicationCenterIcon } from '../src/client/ApplicationCenterIcon.tsx'
import { ApplicationCenterPage, type ApplicationCenterInjected } from '../src/client/ApplicationCenterPage.tsx'
import { zh } from '../src/client/locales.ts'

usePinnedBrowserLanguages('zh-CN')

afterEach(() => {
  delete (window as unknown as { dshDesktop?: unknown }).dshDesktop
  delete (window as unknown as { __DSH_PLUGIN_CENTER_DEV__?: unknown }).__DSH_PLUGIN_CENTER_DEV__
  window.localStorage.clear()
})

/**
 * Boot the plugin over the smallest 0.2.1 surface it consumes: the slots
 * registry, the layout service's panel selection, the settings navigation
 * service, the Workspace navigation service, and the Remote namespaces.
 */
async function bench() {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const locale = new LocaleRuntime(ctx)
  const state = { activePanelId: null as string | null }
  const panelInfo = {
    getSnapshot: () => ({ activePanelId: state.activePanelId }),
    subscribe: vi.fn(() => () => {}),
  }
  const layout = { selectPanel: vi.fn(), panelInfo }
  const settingsNavigation = { open: vi.fn(), subscribe: vi.fn(() => () => {}) }
  let workspaceItems: readonly { readonly workspaceId: string }[] = [{ workspaceId: 'workspace-1' }]
  const workspaces = { list: { getSnapshot: () => ({ items: workspaceItems }) } }
  const uiWorkspace = { startSession: vi.fn() }
  const remote = {
    agentPresets: { list: vi.fn(async () => ({ ok: true as const, value: { presets: [] } })) },
    credentials: {
      describe: vi.fn(async (refs: string[]) => ({
        ok: true as const,
        value: Object.fromEntries(refs.map(ref => [ref, { configured: true, writable: true }])),
      })),
      set: vi.fn(async () => ({ ok: true as const, value: undefined })),
    },
  }
  ctx.provide('locale', locale)
  ctx.provide('layout', layout as never)
  ctx.provide('settingsNavigation', settingsNavigation as never)
  ctx.provide('workspaces', workspaces as never)
  ctx.provide('uiWorkspace', uiWorkspace as never)
  ctx.provide('remote', remote as never)
  return {
    ctx,
    slots: ctx.get('slots') as SlotRegistry,
    state,
    layout,
    settingsNavigation,
    uiWorkspace,
    remote,
    setWorkspaces: (items: readonly { readonly workspaceId: string }[]) => { workspaceItems = items },
  }
}

/** Declare the two seats the plugin registers into, as ui-layout and ui-sidebar do. */
function declare(slots: SlotRegistry): () => void {
  return slots.register({
    name: 'root',
    children: {
      'main': { kind: 'keyed', scope: 'root' },
      'sidebar.panellist': { kind: 'list', scope: 'root' },
    },
  } as never, () => null)
}

describe('ui-plugin-center browser plugin', () => {
  it('registers four global panels and one sidebar launcher for each', async () => {
    const b = await bench()
    declare(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()

    const pages = b.slots.entries('main')
    expect(pages.map(entry => entry.options.key))
      .toEqual(['plugin-center', 'plugin-discovery', 'preset-square', 'application-center'])
    expect(pages.map(entry => entry.component))
      .toEqual([PluginCenterTab, PluginDiscoveryPage, PresetSquarePage, ApplicationCenterPage])

    const panels = b.slots.entries('sidebar.panellist')
    expect(panels.map(entry => entry.options.id))
      .toEqual(['plugin-center', 'plugin-discovery', 'preset-square', 'application-center'])
    expect(panels.map(entry => entry.component))
      .toEqual([PluginCenterIcon, PluginDiscoveryIcon, PresetSquareIcon, ApplicationCenterIcon])
    expect(panels.map(entry => resolveSlotLabel(entry.options.label)))
      .toEqual([zh.nav, zh.discoveryNav, zh.presetTitle, zh.applicationTitle])
    expect(panels.map(entry => entry.locale)).toEqual(Array(4).fill(NS) as string[])
  })

  it('opens a Session under the chosen local preset instead of the deleted primary page', async () => {
    const b = await bench()
    declare(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    const preset = (b.slots.entries('main')[2]!.inject as unknown as () => PresetSquarePageInjected)()

    await expect(preset.useLocalPreset('minimal')).resolves.toBe('opened')
    expect(b.uiWorkspace.startSession).toHaveBeenCalledWith(undefined, {
      agentPreset: 'minimal', clearPreviousDraft: false,
    })
    expect(b.layout.selectPanel).toHaveBeenCalledWith(null)

    b.setWorkspaces([])
    await expect(preset.useLocalPreset('minimal')).resolves.toBe('workspace-needed')
    expect(b.uiWorkspace.startSession).toHaveBeenCalledTimes(1)
  })

  it('lists the Host preset roster without advertising authoring it cannot do', async () => {
    const b = await bench()
    declare(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    const preset = (b.slots.entries('main')[2]!.inject as unknown as () => PresetSquarePageInjected)()

    await expect(preset.listLocalPresets()).resolves.toEqual({ presets: [], authorable: false })
    await expect(preset.removeLocalPreset('minimal')).rejects.toThrow(/not available/)

    const credentials = await preset.describePresetCredentials(['DEEPSEEK_API_KEY'])
    expect(credentials['DEEPSEEK_API_KEY']).toEqual({ configured: true, writable: true })
  })

  it('addresses the Settings shell through the navigation service', async () => {
    const b = await bench()
    declare(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    const application = (b.slots.entries('main')[3]!.inject as unknown as () => ApplicationCenterInjected)()
    const pluginCenter = (b.slots.entries('main')[0]!.inject as unknown as () => {
      openPluginSettings: (tabId: string) => void
    })()

    application.openModelSettings()
    expect(b.settingsNavigation.open).toHaveBeenCalledWith({ sectionId: 'models' })
    pluginCenter.openPluginSettings('installed')
    expect(b.settingsNavigation.open).toHaveBeenCalledWith({ sectionId: 'plugins', tabId: 'installed' })
  })

  it('hands a discovery requirement to a Session through the navigation service', async () => {
    const b = await bench()
    declare(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    const discovery = (b.slots.entries('main')[1]!.inject as unknown as () => PluginDiscoveryInjected)()

    await expect(discovery.findWithAgent('PDF')).resolves.toBe('sent')
    expect(b.uiWorkspace.startSession).toHaveBeenCalledWith(undefined, {
      prompt: '/find-plugins PDF', whenDraftExists: 'append',
    })
    expect(b.layout.selectPanel).toHaveBeenCalledWith(null)
  })

  it('returns the main column to the Conversation only when one of its pages is showing', async () => {
    const b = await bench()
    declare(b.slots)
    const fiber = b.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()

    b.state.activePanelId = 'preset-square'
    await fiber.dispose()
    expect(b.layout.selectPanel).toHaveBeenCalledWith(null)

    b.layout.selectPanel.mockClear()
    const second = await bench()
    declare(second.slots)
    const other = second.ctx.plugin({ inject: [...inject], apply })
    await other.await()
    second.state.activePanelId = 'conversation'
    await other.dispose()
    expect(second.layout.selectPanel).not.toHaveBeenCalled()
  })
})
