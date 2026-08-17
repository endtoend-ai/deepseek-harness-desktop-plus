// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PresetSquareItem } from '@deepseek-ai/dsh-plugin-center-contracts'
import {
  PresetSquarePanel, type LocalPresetEntry, type PresetSquareInjected,
} from '../src/client/PresetSquarePanel.tsx'
import { zh, type PluginCenterLocaleKey } from '../src/client/locales.ts'

afterEach(cleanup)

const t = (key: PluginCenterLocaleKey): string => zh[key]

const ITEM = {
  id: '17d84963-a192-4d25-b918-0d454bc3da4e',
  slug: 'web-research-assistant',
  presetId: 'web-research-assistant',
  title: '网页研究助手',
  description: '组合浏览器、检索与信息整理能力。',
  source: 'community',
  publisher: { username: 'dsh-community' },
  artifact: {
    downloadUrl: 'https://www.dshdesktop.com/preset/download/web-research-assistant.dshpreset',
    sha256: 'a'.repeat(64),
    sizeBytes: 48_320,
    formatVersion: 1,
    sourceDshVersion: '0.1.0-rc.5',
  },
  detailUrl: 'https://www.dshdesktop.com/preset/web-research-assistant',
  downloadCount: 2_418,
  visualVariant: 2,
  createdAt: '2026-08-12T08:00:00.000Z',
} as const satisfies PresetSquareItem

const OFFICIAL_ITEM = {
  ...ITEM,
  id: 'fufan-case-01-ai-webapp',
  slug: 'fufan-ai-webapp',
  presetId: 'ai-product-developer',
  title: 'AI WebApp',
  description: '1 套 Agent Preset + 3 个 Skills。',
  source: 'fufan-official',
  publisher: { username: '赋范官方' },
  artifact: {
    ...ITEM.artifact,
    downloadUrl: 'https://www.dshdesktop.com/preset/api/v1/presets/fufan-ai-webapp/download',
  },
  detailUrl: 'https://www.dshdesktop.com/preset/p/fufan-ai-webapp',
} as const satisfies PresetSquareItem

function props(values: Partial<PresetSquareInjected> = {}): PresetSquareInjected {
  return {
    presetAvailable: true,
    presetDevelopment: false,
    presetMutationsEnabled: true,
    listPresetSquare: async () => ({
      items: [ITEM], total: 1, sort: 'downloads', fetchedAt: '2026-08-17T08:00:00.000Z',
    }),
    detailPresetSquare: async () => ({ item: ITEM, fetchedAt: '2026-08-17T08:00:00.000Z' }),
    previewPresetInstall: async request => ({
      slug: request.slug,
      title: ITEM.title,
      targetId: request.targetId ?? ITEM.presetId,
      sourcePresetId: ITEM.presetId,
      name: ITEM.title,
      description: ITEM.description,
      sourceDshVersion: ITEM.artifact.sourceDshVersion,
      fileCount: 3,
      warnings: [],
      conflict: false,
    }),
    installPreset: async request => ({
      slug: request.slug,
      title: ITEM.title,
      targetId: request.targetId,
      sourcePresetId: ITEM.presetId,
      name: ITEM.title,
      description: ITEM.description,
      sourceDshVersion: ITEM.artifact.sourceDshVersion,
      fileCount: 3,
      warnings: [],
      conflict: false,
      installed: true,
    }),
    listLocalPresets: async () => ({ presets: [], authorable: true }),
    removeLocalPreset: async () => {},
    useLocalPreset: async () => 'opened',
    ...values,
  }
}

describe('Preset Square shared surface', () => {
  it('separates 赋范官方 packs from community entries and states their ownership', async () => {
    render(<PresetSquarePanel {...props({
      listPresetSquare: async () => ({
        items: [OFFICIAL_ITEM, ITEM], total: 2, sort: 'downloads', fetchedAt: '2026-08-17T08:00:00.000Z',
      }),
      detailPresetSquare: async query => ({
        item: query.slug === OFFICIAL_ITEM.slug ? OFFICIAL_ITEM : ITEM,
        fetchedAt: '2026-08-17T08:00:00.000Z',
      }),
    })} t={t} />)

    expect(await screen.findByRole('heading', { name: zh.presetFufanOfficialTitle })).toBeTruthy()
    expect(screen.getByRole('heading', { name: zh.presetCommunityTitle })).toBeTruthy()

    const officialCard = screen.getByText(OFFICIAL_ITEM.title).closest('article')
    if (officialCard === null) throw new Error('赋范官方卡片未渲染')
    expect(within(officialCard).getByText(zh.presetFufanOfficialBadge)).toBeTruthy()
    fireEvent.click(within(officialCard).getByRole('button', { name: zh.details }))
    expect(await screen.findByText(zh.presetFufanOfficialDisclaimer)).toBeTruthy()
  })

  it('filters the complete fetched list locally and keeps server sorting explicit', async () => {
    const listPresetSquare = vi.fn<PresetSquareInjected['listPresetSquare']>(async query => ({
      items: [ITEM],
      total: 1,
      sort: query.sort,
      fetchedAt: `2026-08-17T08:00:0${query.sort === 'downloads' ? '0' : '1'}.000Z`,
    }))
    render(<PresetSquarePanel {...props({ listPresetSquare })} t={t} />)

    expect(await screen.findByText(ITEM.title)).toBeTruthy()
    expect(listPresetSquare).toHaveBeenCalledWith({ query: '', sort: 'downloads' })
    fireEvent.change(screen.getByRole('searchbox', { name: zh.presetSearch }), { target: { value: '不存在' } })
    expect(screen.getByText(zh.presetEmpty)).toBeTruthy()
    expect(listPresetSquare).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: zh.presetSortNewest }))
    await waitFor(() => { expect(listPresetSquare).toHaveBeenLastCalledWith({ query: '', sort: 'newest' }) })
  })

  it('previews, confirms, installs, and refreshes the local roster without leaving the page', async () => {
    let installed = false
    const previewPresetInstall = vi.fn<PresetSquareInjected['previewPresetInstall']>(async request => ({
      slug: request.slug,
      title: ITEM.title,
      targetId: request.targetId ?? ITEM.presetId,
      sourcePresetId: ITEM.presetId,
      name: ITEM.title,
      description: ITEM.description,
      sourceDshVersion: ITEM.artifact.sourceDshVersion,
      fileCount: 3,
      warnings: ['version-mismatch'],
      conflict: false,
    }))
    const installPreset = vi.fn<PresetSquareInjected['installPreset']>(async (request) => {
      installed = true
      return {
        slug: request.slug,
        title: ITEM.title,
        targetId: request.targetId,
        sourcePresetId: ITEM.presetId,
        name: ITEM.title,
        description: ITEM.description,
        sourceDshVersion: ITEM.artifact.sourceDshVersion,
        fileCount: 3,
        warnings: ['version-mismatch'],
        conflict: false,
        installed: true,
      }
    })
    const listLocalPresets = vi.fn(async () => ({
      presets: installed ? [{ id: ITEM.presetId, trust: 'user' as const, isDefault: false }] : [],
      authorable: true,
    }))
    render(<PresetSquarePanel
      {...props({ previewPresetInstall, installPreset, listLocalPresets })}
      t={t}
    />)

    fireEvent.click(await screen.findByRole('button', { name: zh.install }))
    const dialog = await screen.findByRole('dialog', { name: ITEM.title })
    expect(await within(dialog).findByText(zh.presetWarningVersion)).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('checkbox', { name: zh.presetTrustAcknowledge }))
    fireEvent.click(within(dialog).getByRole('button', { name: zh.confirmInstall }))

    await waitFor(() => { expect(installPreset).toHaveBeenCalledWith({ slug: ITEM.slug, targetId: ITEM.presetId }) })
    expect(await screen.findByText(zh.presetInstallSuccess)).toBeTruthy()
    expect(screen.getByRole('heading', { name: zh.presetTitle })).toBeTruthy()
    expect(listLocalPresets.mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('deletes only a user preset and refreshes just the local roster', async () => {
    const entries: LocalPresetEntry[] = [
      { id: 'standard', trust: 'system', isDefault: true },
      { id: 'my-preset', trust: 'user', isDefault: false, name: '我的 Preset' },
    ]
    const removeLocalPreset = vi.fn<PresetSquareInjected['removeLocalPreset']>(async (id) => {
      entries.splice(entries.findIndex(item => item.id === id), 1)
    })
    const listLocalPresets = vi.fn(async () => ({ presets: [...entries], authorable: true }))
    const listPresetSquare = vi.fn<PresetSquareInjected['listPresetSquare']>(async () => ({
      items: [ITEM], total: 1, sort: 'downloads', fetchedAt: '2026-08-17T08:00:00.000Z',
    }))
    render(<PresetSquarePanel
      {...props({ removeLocalPreset, listLocalPresets, listPresetSquare })}
      t={t}
    />)

    fireEvent.click(await screen.findByRole('tab', { name: new RegExp(zh.presetInstalledTab) }))
    expect(await screen.findByText('我的 Preset')).toBeTruthy()
    expect(screen.getAllByText(zh.presetProtected)).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: zh.presetRemove }))
    const dialog = screen.getByRole('dialog', { name: '我的 Preset' })
    fireEvent.click(within(dialog).getByRole('button', { name: zh.presetRemove }))

    await waitFor(() => { expect(removeLocalPreset).toHaveBeenCalledWith('my-preset') })
    await waitFor(() => { expect(screen.queryByText('我的 Preset')).toBeNull() })
    expect(listPresetSquare).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('heading', { name: zh.presetTitle })).toBeTruthy()
  })
})
