// @vitest-environment jsdom
import { Context } from '@deepseek-ai/cordis'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { afterEach, describe, expect, it } from 'vitest'
import { apply, inject } from '../../../examples/ff-llm-wiki-plugin/src/client/Plugin.tsx'

afterEach(() => {
  window.localStorage.clear()
  document.documentElement.removeAttribute('data-ff-llm-wiki-sidebar-hidden')
})

describe('FF - LLM Wiki sidebar visibility', () => {
  it('projects persisted visibility to the shared document root', async () => {
    const ctx = new Context()
    await ctx.plugin(SlotRegistry).await()
    ctx.provide('locale', new LocaleRuntime(ctx))
    const slots = ctx.get('slots') as SlotRegistry
    slots.register({
      name: 'root',
      children: { 'sidebar.primary.action': { kind: 'list', scope: 'root' } },
    } as never, () => null)
    await ctx.plugin({ inject: [...inject], apply }).await()

    expect(slots.entries('sidebar.primary.action').map(entry => entry.options.id)).toContain('ff-llm-wiki')
    window.localStorage.setItem('ff-llm-wiki:sidebar-visible', 'false')
    window.dispatchEvent(new CustomEvent('ff-llm-wiki:sidebar-visibility'))
    expect(document.documentElement.hasAttribute('data-ff-llm-wiki-sidebar-hidden')).toBe(true)
    window.localStorage.setItem('ff-llm-wiki:sidebar-visible', 'true')
    window.dispatchEvent(new CustomEvent('ff-llm-wiki:sidebar-visibility'))
    expect(document.documentElement.hasAttribute('data-ff-llm-wiki-sidebar-hidden')).toBe(false)

    await ctx.fiber.dispose()
  })
})
