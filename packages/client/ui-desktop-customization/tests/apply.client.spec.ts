// @vitest-environment jsdom

import { Context } from '@deepseek-ai/cordis'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { resolveSlotLabel } from '@deepseek-ai/dsh-client-ui-slots'
import { describe, expect, it, vi } from 'vitest'
import { apply, inject } from '@deepseek-ai/dsh-client-ui-desktop-customization/client'
import { AppearanceSection } from '../src/client/AppearanceSection.tsx'
import { BrandBadge } from '../src/client/BrandBadge.tsx'
import { validateImageFile } from '../src/client/background-image.ts'
import { UpdateSection } from '../src/client/UpdateSection.tsx'
import { VisionEnhancementRow } from '../src/client/VisionEnhancementRow.tsx'

async function bench() {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const locale = new LocaleRuntime(ctx)
  locale.setLocale('zh')
  ctx.provide('locale', locale)
  const disposeTokens = vi.fn()
  const overrideTokens = vi.fn(() => disposeTokens)
  ctx.provide('theme', { overrideTokens } as never)
  ctx.provide('connection', {
    api: {
      vision: {
        status: () => Promise.resolve({ result: { ok: true, value: { enabled: false, configured: false, model: 'qwen3.8-max', apiKeyUrl: 'https://help.aliyun.com/zh/model-studio/get-api-key' } } }),
        test: () => Promise.resolve({ result: { ok: true, value: { model: 'qwen3.8-max', description: 'fixture image' } } }),
        enable: () => Promise.resolve({ result: { ok: true, value: { model: 'qwen3.8-max', description: 'fixture image' } } }),
      },
    },
  } as never)
  const slots = ctx.get('slots') as SlotRegistry
  slots.register({
    name: 'root',
    children: {
      'settings.section': { kind: 'list', scope: 'root' },
      'settings.general.item': { kind: 'list', scope: 'root' },
      'shell.overlay': { kind: 'list', scope: 'root' },
    },
  } as never, () => null)
  return { ctx, slots, overrideTokens, disposeTokens }
}

describe('Desktop customization client plugin', () => {
  it('registers both settings sections and the frame-wide brand badge', async () => {
    const b = await bench()
    const fiber = b.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    const sections = b.slots.entries('settings.section')
    expect(sections.map(entry => entry.component)).toEqual([AppearanceSection, UpdateSection])
    expect(sections.map(entry => resolveSlotLabel(entry.options.label))).toEqual(['背景', '软件更新'])
    expect(b.slots.entries('shell.overlay')[0]?.component).toBe(BrandBadge)
    expect(b.slots.entries('settings.general.item')[0]?.component).toBe(VisionEnhancementRow)
    expect(document.body.getAttribute('data-dsh-desktop-skin')).toBe('active')
    expect(b.overrideTokens).toHaveBeenCalledOnce()
    await fiber.dispose()
    expect(b.slots.entries('settings.section')).toHaveLength(0)
    expect(b.slots.entries('shell.overlay')).toHaveLength(0)
    expect(b.slots.entries('settings.general.item')).toHaveLength(0)
    expect(document.body.hasAttribute('data-dsh-desktop-skin')).toBe(false)
    expect(b.disposeTokens).toHaveBeenCalledOnce()
  })

  it('declares only the services it uses', () => {
    expect(inject).toEqual(['slots', 'locale', 'theme', 'connection'])
  })

  it('accepts the three supported image formats and rejects unsafe inputs', () => {
    expect(validateImageFile(new File(['x'], 'a.png', { type: 'image/png' }))).toBeUndefined()
    expect(validateImageFile(new File(['x'], 'a.jpg', { type: 'image/jpeg' }))).toBeUndefined()
    expect(validateImageFile(new File(['x'], 'a.webp', { type: 'image/webp' }))).toBeUndefined()
    expect(validateImageFile(new File(['x'], 'a.svg', { type: 'image/svg+xml' }))).toContain('PNG')
  })
})
