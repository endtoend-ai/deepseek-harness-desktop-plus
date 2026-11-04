/** Desktop Plugin Center first-level navigation and independent main page. */

import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only: the ctx.slots service merge this plugin registers through.
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: ctx.uiWorkspace, the Workspace UI navigation service.
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import { resolveCatalogBridge } from './bridge.ts'
import { PluginCenterIcon } from './PluginCenterIcon.tsx'
import { PluginCenterTab, type PluginCenterTabInjected } from './PluginCenterTab.tsx'
import { PluginDiscoveryIcon } from './PluginDiscoveryIcon.tsx'
import { PluginDiscoveryPage, type PluginDiscoveryInjected } from './PluginDiscoveryPage.tsx'
import { PresetSquareIcon } from './PresetSquareIcon.tsx'
import { PresetSquarePage, type PresetSquarePageInjected } from './PresetSquarePage.tsx'
import { ApplicationCenterIcon } from './ApplicationCenterIcon.tsx'
import {
  ApplicationCenterPage, type ApplicationCenterInjected, type ApplicationRuntimeStatus,
} from './ApplicationCenterPage.tsx'
import { en, zh, type PluginCenterLocaleKey } from './locales.ts'

export type { DesktopCatalogBridge } from './bridge.ts'
export type { PluginCenterTabInjected, PluginCenterTabProps } from './PluginCenterTab.tsx'
export type { PresetSquarePageInjected, PresetSquarePageProps } from './PresetSquarePage.tsx'
export type {
  ApplicationCenterInjected, ApplicationCenterPageProps, ApplicationRuntimeStatus,
} from './ApplicationCenterPage.tsx'
export type { PluginCenterLocaleKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Desktop Plugin and Skill Bundle catalog copy. */
    pluginCenter: PluginCenterLocaleKey
  }
}

/** Dictionary namespace owned by this plugin. */
export const NS = 'pluginCenter'
/** Services used by the slot contribution. */
export const inject = [
  'slots', 'layout', 'locale', 'settingsNavigation', 'workspaces', 'uiWorkspace',
  'remote', 'remote.credentials',
]

const PLUGIN_CENTER_PAGE_ID = 'plugin-center' as MainPanelId
const PLUGIN_DISCOVERY_PAGE_ID = 'plugin-discovery' as MainPanelId
const PRESET_SQUARE_PAGE_ID = 'preset-square' as MainPanelId
const APPLICATION_CENTER_PAGE_ID = 'application-center' as MainPanelId
const LLM_WIKI_STATUS_PATH = '/api/ff-llm-wiki/status'
const LLM_WIKI_OPEN_PATH = '/api/ff-llm-wiki/open'
const LLM_WIKI_SIDEBAR_VISIBILITY_KEY = 'ff-llm-wiki:sidebar-visible'
const LLM_WIKI_SIDEBAR_VISIBILITY_EVENT = 'ff-llm-wiki:sidebar-visibility'

/** Add the Desktop-only catalog as a first-level page without replacing Settings. */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-plugin-center: dictionaries')
  const t = ctx.locale.bind(NS)
  const resolved = resolveCatalogBridge()
  const bridge = resolved.bridge
  const unavailable = (): Promise<never> => Promise.reject(new Error('Desktop catalog bridge unavailable'))
  const presetInjected = (): PresetSquarePageInjected => ({
    presetAvailable: bridge?.presetSquare !== undefined,
    presetDevelopment: resolved.development,
    presetMutationsEnabled: bridge?.presetSquare?.mutationsEnabled ?? false,
    listPresetSquare: query => bridge?.presetSquare?.list(query) ?? unavailable(),
    detailPresetSquare: query => bridge?.presetSquare?.detail(query) ?? unavailable(),
    previewPresetInstall: request => bridge?.presetSquare?.previewInstall(request) ?? unavailable(),
    installPreset: request => bridge?.presetSquare?.install(request) ?? unavailable(),
    checkPresetRuntime: presetId => bridge?.presetSquare?.checkRuntime({ presetId }) ?? unavailable(),
    installPresetRuntime: presetId => bridge?.presetSquare?.installRuntime({ presetId }) ?? unavailable(),
    listLocalPresets: async () => {
      const response = await ctx.remote.agentPresets.list()
      if (!response.ok) throw new Error(response.error.message)
      // 0.2.1 declares presets as profile composition rows: the browser can
      // read and select them, and it has no authoring surface to advertise.
      return {
        presets: response.value.presets.map(row => ({ ...row, trust: 'system' as const })),
        authorable: false,
      }
    },
    removeLocalPreset: async () => {
      throw new Error('Removing a preset is not available in this deployment')
    },
    describePresetCredentials: async (refs) => {
      const response = await ctx.remote.credentials.describe([...refs])
      if (!response.ok) throw new Error(response.error.message)
      return response.value
    },
    setPresetCredential: async (ref, value) => {
      const response = await ctx.remote.credentials.set(ref, value)
      if (!response.ok) throw new Error(response.error.message)
    },
    useLocalPreset: async (id) => {
      // The Workspace navigation service owns the target: the current
      // Session's Workspace, then the recent one, and the preset rides the
      // creation so the Host composes the Session under it.
      if (ctx.workspaces.list.getSnapshot().items.length === 0) return 'workspace-needed'
      ctx.uiWorkspace.startSession(undefined, { agentPreset: id, clearPreviousDraft: false })
      ctx.layout.selectPanel(null)
      return 'opened'
    },
  })
  const applicationInjected = (): ApplicationCenterInjected => ({
    inspectLlmWiki: async (): Promise<ApplicationRuntimeStatus> => {
      const response = await fetch(LLM_WIKI_STATUS_PATH, { credentials: 'same-origin' })
      if (response.status === 404) return { available: false, credentialConfigured: false }
      if (!response.ok) throw new Error(`LLM Wiki status request failed: ${String(response.status)}`)
      const value = await response.json() as { readonly installed?: unknown; readonly credentialConfigured?: unknown }
      return {
        available: value.installed === true,
        credentialConfigured: value.credentialConfigured === true,
      }
    },
    openLlmWiki: () => {
      const opened = window.open(LLM_WIKI_OPEN_PATH, '_blank')
      if (opened !== null) opened.opener = null
    },
    openModelSettings: () => { ctx.settingsNavigation.open({ sectionId: 'models' }) },
    getLlmWikiSidebarVisible: () => {
      try {
        return window.localStorage.getItem(LLM_WIKI_SIDEBAR_VISIBILITY_KEY) === 'true'
      } catch {
        return false
      }
    },
    setLlmWikiSidebarVisible: (visible) => {
      window.localStorage.setItem(LLM_WIKI_SIDEBAR_VISIBILITY_KEY, String(visible))
      window.dispatchEvent(new CustomEvent(LLM_WIKI_SIDEBAR_VISIBILITY_EVENT, { detail: { visible } }))
    },
  })
  const injected = (): PluginCenterTabInjected => ({
    available: bridge !== undefined,
    development: resolved.development,
    list: query => bridge === undefined ? unavailable() : bridge.catalog.list(query),
    refresh: query => bridge === undefined ? unavailable() : bridge.catalog.refresh(query),
    detail: query => bridge === undefined ? unavailable() : bridge.catalog.detail(query),
    checkCompatibility: request => bridge === undefined ? unavailable() : bridge.catalog.checkCompatibility(request),
    listInstalled: () => bridge === undefined ? unavailable() : bridge.installedPlugins.list(),
    openPluginSettings: (tabId) => { ctx.settingsNavigation.open({ sectionId: 'plugins', tabId }) },
    mutationsEnabled: bridge?.pluginOperations.mutationsEnabled ?? false,
    install: request => bridge === undefined ? unavailable() : bridge.pluginOperations.install(request),
    manage: request => bridge === undefined ? unavailable() : bridge.pluginOperations.manage(request),
    getOwnedDataOffer: () => bridge === undefined ? Promise.resolve(null) : bridge.pluginOwnedData.getOffer(),
    removeOwnedData: request => bridge === undefined ? unavailable() : bridge.pluginOwnedData.remove(request),
    retainOwnedData: request => bridge === undefined ? unavailable() : bridge.pluginOwnedData.retain(request),
    getOperation: () => bridge === undefined ? Promise.resolve(null) : bridge.pluginOperations.getOperation(),
    onOperationState: listener => bridge === undefined ? () => {} : bridge.pluginOperations.onState(listener),
    getRecovery: () => bridge?.pluginRecovery?.getState() ?? Promise.resolve(null),
    retryRecovery: request => bridge?.pluginRecovery === undefined
      ? unavailable()
      : bridge.pluginRecovery.retry(request),
    exportRecoveryDiagnostics: request => bridge?.pluginRecovery === undefined
      ? unavailable()
      : bridge.pluginRecovery.exportDiagnostics(request),
    onRecoveryState: listener => bridge?.pluginRecovery?.onState(listener) ?? (() => {}),
  })

  const discoveryInjected = (): PluginDiscoveryInjected => ({
    available: bridge !== undefined,
    development: resolved.development,
    list: query => bridge === undefined ? unavailable() : bridge.catalog.list(query),
    refresh: query => bridge === undefined ? unavailable() : bridge.catalog.refresh(query),
    detail: query => bridge === undefined ? unavailable() : bridge.catalog.detail(query),
    checkCompatibility: request => bridge === undefined ? unavailable() : bridge.catalog.checkCompatibility(request),
    listInstalled: () => bridge === undefined ? unavailable() : bridge.installedPlugins.list(),
    mutationsEnabled: bridge?.pluginOperations.mutationsEnabled ?? false,
    install: request => bridge === undefined ? unavailable() : bridge.pluginOperations.install(request),
    getOperation: () => bridge === undefined ? Promise.resolve(null) : bridge.pluginOperations.getOperation(),
    onOperationState: listener => bridge === undefined ? () => {} : bridge.pluginOperations.onState(listener),
    openPluginCenter: () => { ctx.layout.selectPanel(PLUGIN_CENTER_PAGE_ID) },
    findWithAgent: async (requirement) => {
      const described = await ctx.remote.credentials.describe(['DEEPSEEK_API_KEY'])
      if (!described.ok) throw new Error(described.error.message)
      if (described.value['DEEPSEEK_API_KEY']?.configured !== true) {
        ctx.settingsNavigation.open({ sectionId: 'models' })
        return 'needs-model'
      }
      if (ctx.workspaces.list.getSnapshot().items.length === 0) return 'needs-workspace'
      // No client-wide "current Session" exists in 0.2.1: the navigation
      // service reuses the blank Session when there is one and otherwise
      // starts a Session, which is what the discovery handoff needs.
      ctx.uiWorkspace.startSession(undefined, {
        prompt: `/find-plugins ${requirement}`,
        whenDraftExists: 'append',
      })
      ctx.layout.selectPanel(null)
      return 'sent'
    },
  })

  // The sidebar's panel list owns the row chrome and the accessible label, so
  // each entrance contributes only its glyph and its resolved title.
  const panels = [
    { id: PLUGIN_CENTER_PAGE_ID, order: 20, label: 'nav' as const, icon: PluginCenterIcon },
    { id: PLUGIN_DISCOVERY_PAGE_ID, order: 21, label: 'discoveryNav' as const, icon: PluginDiscoveryIcon },
    { id: PRESET_SQUARE_PAGE_ID, order: 22, label: 'presetTitle' as const, icon: PresetSquareIcon },
    { id: APPLICATION_CENTER_PAGE_ID, order: 23, label: 'applicationTitle' as const, icon: ApplicationCenterIcon },
  ] as const
  for (const panel of panels) {
    ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
      name: 'sidebar.panellist',
      id: panel.id,
      order: panel.order,
      locale: NS,
      label: () => t(panel.label),
    }, panel.icon))
  }
  ctx.slots.inject('main', () => ctx.slots.register({
    name: 'main',
    key: PLUGIN_CENTER_PAGE_ID,
    locale: NS,
    inject: injected,
  }, PluginCenterTab))
  ctx.slots.inject('main', () => ctx.slots.register({
    name: 'main',
    key: PLUGIN_DISCOVERY_PAGE_ID,
    locale: NS,
    inject: discoveryInjected,
  }, PluginDiscoveryPage))
  ctx.slots.inject('main', () => ctx.slots.register({
    name: 'main',
    key: PRESET_SQUARE_PAGE_ID,
    locale: NS,
    inject: presetInjected,
  }, PresetSquarePage))
  ctx.slots.inject('main', () => ctx.slots.register({
    name: 'main',
    key: APPLICATION_CENTER_PAGE_ID,
    locale: NS,
    inject: applicationInjected,
  }, ApplicationCenterPage))
  // The main column is one selection: tearing the plugin down returns it to
  // the Conversation only when one of these pages is the one showing.
  ctx.effect(
    () => () => {
      const active = ctx.layout.panelInfo.getSnapshot().activePanelId
      if (panels.some(panel => panel.id === active)) ctx.layout.selectPanel(null)
    },
    'ui-plugin-center: release its main panel on teardown',
  )
}
