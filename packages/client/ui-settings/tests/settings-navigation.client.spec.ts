/** Cross-feature links into the Settings shell, asserted through the real provide. */
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { TestRemote } from '@deepseek-ai/dsh-client-test-runtime'
import { apply, inject } from '../src/client/index.ts'
import type { SettingsNavigationTarget } from '../src/client/settings-navigation.ts'

function bench() {
  const describeCall = vi.fn().mockResolvedValue({
    ok: true as const, value: { writable: true, hasDocument: true, namespaces: [] },
  })
  const ctx = new Context()
  onTestFinished(() => ctx.fiber.dispose())
  const remote = new TestRemote(ctx, { settings: { describe: describeCall } })
  remote.$host = { home: undefined, isLoopback: false }
  return { ctx, fiber: ctx.plugin({ inject: [...inject], apply }) }
}

describe('settings navigation service', () => {
  it('provides the service and delivers a target to its current subscribers', async () => {
    const { ctx, fiber } = bench()
    await fiber.await()
    const seen: SettingsNavigationTarget[] = []
    const dispose = ctx.settingsNavigation.subscribe(target => seen.push(target))
    ctx.settingsNavigation.open({ sectionId: 'models' })
    expect(seen).toEqual([{ sectionId: 'models' }])
    dispose()
    ctx.settingsNavigation.open({ sectionId: 'plugins', tabId: 'installed' })
    expect(seen).toHaveLength(1)
  })

  it('replays the latest target to a subscriber that arrives after the request', async () => {
    const { ctx, fiber } = bench()
    await fiber.await()
    ctx.settingsNavigation.open({ sectionId: 'models' })
    const seen: SettingsNavigationTarget[] = []
    ctx.settingsNavigation.subscribe(target => seen.push(target))
    expect(seen).toEqual([{ sectionId: 'models' }])
  })

  it('refuses a target that names no section', async () => {
    const { ctx, fiber } = bench()
    await fiber.await()
    expect(() => { ctx.settingsNavigation.open({ sectionId: '' }) }).toThrow(/section id/)
  })
})
