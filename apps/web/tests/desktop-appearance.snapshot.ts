// @vitest-environment jsdom
/** Keyless assembled Desktop appearance journey over the built client bundles. */

import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { installAssembledBootEnv, mountAssembledApp } from './assembled-boot.ts'

const DEFAULT_APPEARANCE = {
  builtinTheme: 'whale-maid',
  imageDataUrl: null,
  focusY: 50,
  glassStrength: 72,
  palette: ['#587ac2', '#253555', '#d9e5f7', '#8ba5d6'] as const,
}

const save = vi.fn(async (settings: typeof DEFAULT_APPEARANCE) => settings)

// Registered before the shared environment so it runs after that teardown:
// Vitest executes afterEach hooks in reverse registration order, and the
// unmounting graph still reads this bridge.
afterEach(() => {
  delete (window as unknown as { dshDesktop?: unknown }).dshDesktop
})

installAssembledBootEnv()

// The appearance journey reads the Studio Desktop bridge through
// `window.dshDesktop`; the assembled Web fixture serves no such bridge, so
// each test installs its own before the graph mounts.
beforeEach(() => {
  save.mockClear()
  Object.defineProperty(window, 'dshDesktop', {
    configurable: true,
    value: {
      platform: 'darwin',
      appearance: {
        get: async () => DEFAULT_APPEARANCE,
        save,
        reset: async () => DEFAULT_APPEARANCE,
      },
      updates: {
        getState: async () => ({ phase: 'idle', currentVersion: '0.1.0-rc.10' }),
        check: async () => ({ phase: 'up-to-date', currentVersion: '0.1.0-rc.10' }),
        download: async () => ({ phase: 'ready', currentVersion: '0.1.0-rc.10' }),
        install: async () => {},
        onState: () => () => {},
      },
    },
  })
})

it('assembled Desktop settings lists and persists the three Jiutian themes', async () => {
  mountAssembledApp()

  fireEvent.click(await screen.findByRole('button', { name: 'Settings' }, { timeout: 10_000 }))
  const dialog = await screen.findByRole('dialog', { name: 'Settings' })
  fireEvent.click(await within(dialog).findByRole('button', { name: 'Background' }))

  expect(await within(dialog).findByRole('button', { name: /九天·深空算力穹顶/ })).toBeTruthy()
  expect(within(dialog).getByRole('button', { name: /九天·量子玻璃实验室/ })).toBeTruthy()
  const dawn = within(dialog).getByRole('button', { name: /九天·晨曦算力网络/ })
  fireEvent.click(dawn)
  expect(dawn.getAttribute('aria-pressed')).toBe('true')
  fireEvent.click(within(dialog).getByRole('button', { name: '保存并应用' }))

  await waitFor(() => {
    expect(save).toHaveBeenCalledWith({
      builtinTheme: 'jiutian-dawn-horizon',
      imageDataUrl: null,
      focusY: 50,
      glassStrength: 72,
      palette: ['#4f90bd', '#46566a', '#dce7f1', '#c8a968'],
    })
  })
  expect(document.body.style.getPropertyValue('--dsh-desktop-background-image'))
    .toContain('/dsh-desktop/jiutian-dawn-compute-horizon.webp')
})
