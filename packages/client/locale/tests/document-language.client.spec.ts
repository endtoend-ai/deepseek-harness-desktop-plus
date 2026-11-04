// @vitest-environment jsdom
/**
 * `<html lang>` tracks the active locale.
 *
 * The product opens in English, a stored Host preference may replace that
 * after activation, and the attribute moves again whenever the user switches. Assistive technology and
 * browser features read this attribute, so a stale value misreports the
 * document language rather than merely looking untidy.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import { apply as settingsApply, inject as settingsInject } from '@deepseek-ai/dsh-client-ui-settings/client'
import { TestRemote } from '@deepseek-ai/dsh-client-test-runtime'
import { apply, inject } from '@deepseek-ai/dsh-client-locale/client'
import type { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { LOCALE_SETTINGS_NAMESPACE, LocaleSettingsSchema } from '../src/locale-settings.ts'

/** Boot the plugin over a stub Host settings document. */
async function bench(preference?: string) {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  let stored = preference
  let revision = 0
  const namespace = () => ({
    ns: LOCALE_SETTINGS_NAMESPACE,
    schema: LocaleSettingsSchema.toJSON(),
    value: stored === undefined ? {} : { preference: stored },
    autoGenerate: true, applies: 'live' as const,
    secrets: [],
    revision,
  })
  const describeRpc = vi.fn(async () => ({
    ok: true as const,
    value: { writable: true, hasDocument: true, namespaces: [namespace()] },
  }))
  const mutate = vi.fn(async (_ns: string, ops: { value: string }[]) => {
    stored = ops[0]!.value
    revision += 1
    return { ok: true as const, value: namespace() }
  })
  // The settings transport and the forwarded-event port the plugin injects.
  new TestRemote(ctx, { settings: { describe: describeRpc, mutate } })
  await ctx.plugin({ inject: [...settingsInject], apply: settingsApply }).await()
  await ctx.plugin({ inject: [...inject], apply }).await()
  return { ctx, locale: ctx.get('locale') as LocaleRuntime }
}

const langOf = (): string => document.documentElement.lang

describe('document language', () => {
  beforeEach(() => {
    // The served markup declares the product default; the plugin must not
    // depend on that value already being correct.
    document.documentElement.lang = 'en'
    Object.defineProperty(navigator, 'languages', { value: ['zh-CN'], configurable: true })
    Object.defineProperty(navigator, 'language', { value: 'zh-CN', configurable: true })
  })

  afterEach(() => {
    // navigator properties are installed with defineProperty above, so they
    // are removed the same way; nothing here goes through vi.stubGlobal.
    const own = navigator as unknown as Record<string, unknown>
    delete own.languages
    delete own.language
  })

  it('states the English default at activation, not the value the markup shipped', async () => {
    document.documentElement.lang = 'zh-CN'
    // A Chinese browser neither picks nor keeps the locale: English does.
    const { locale } = await bench()
    expect(locale.getLocale().active).toBe('en')
    expect(langOf()).toBe('en')
  })

  it('follows a locale switch in both directions with BCP 47 tags', async () => {
    const { locale } = await bench()
    expect(langOf()).toBe('en')
    // `zh` names its script variant, which bare `zh` leaves ambiguous for
    // pronunciation and font selection; `en` needs no region.
    locale.setLocale('zh')
    expect(langOf()).toBe('zh-CN')
    locale.setLocale('en')
    expect(langOf()).toBe('en')
  })

  it('follows an explicit Host preference that overrides the English default', async () => {
    // Stored preference wins over the default.
    const { locale } = await bench('zh')
    await vi.waitFor(() => { expect(locale.getLocale().active).toBe('zh') })
    await vi.waitFor(() => { expect(langOf()).toBe('zh-CN') })
  })

  it('uses an external locale definition for the document language', async () => {
    const { locale } = await bench()
    locale.addLanguage({ id: 'pt-BR', label: 'Português', fallback: 'en' })
    locale.setLocale('pt-BR')
    expect(langOf()).toBe('pt-BR')
  })

  it('does not rewrite the document language for catalog changes with the same active locale', async () => {
    const { locale } = await bench()
    const observer = new MutationObserver(() => {})
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] })
    try {
      const remove = locale.addLanguage({ id: 'ja', label: '日本語', fallback: 'en' })
      expect(observer.takeRecords()).toHaveLength(0)
      remove()
      expect(observer.takeRecords()).toHaveLength(0)
      locale.setLocale('zh')
      expect(observer.takeRecords()).toHaveLength(1)
      expect(langOf()).toBe('zh-CN')
    } finally {
      observer.disconnect()
    }
  })
})
