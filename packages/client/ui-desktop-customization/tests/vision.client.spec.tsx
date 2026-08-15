// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { VisionEnhancementRow } from '../src/client/VisionEnhancementRow.tsx'

afterEach(() => { vi.restoreAllMocks() })

describe('Vision enhancement settings', () => {
  it('uses the atomic Bailian enable gate with DASHSCOPE_API_KEY and a real-shaped image probe', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
      ok: true,
      blob: () => Promise.resolve(new Blob(['image'], { type: 'image/webp' })),
    })))
    const enableVision = vi.fn(() => Promise.resolve({
      result: { ok: true, value: { model: 'qwen3.8-max', description: '一只小猫站在蓝色背景前。' } },
    }))
    const updateSettings = vi.fn(() => Promise.resolve({
      result: { ok: true, value: { ns: 'vision-enhancement', schema: {}, value: { enabled: true }, applies: 'live', secrets: [], revision: 1 } },
    }))
    const api = {
      vision: {
        status: () => Promise.resolve({ result: { ok: true, value: { enabled: false, configured: false, model: 'qwen3.8-max', apiKeyUrl: 'https://help.aliyun.com/zh/model-studio/get-api-key' } } }),
        enable: enableVision,
      },
      settings: { update: updateSettings },
    }

    render(<VisionEnhancementRow
      api={api as never}
      useSessions={vi.fn() as never}
      useWorkspaces={vi.fn() as never}
    />)
    await waitFor(() => { expect(screen.getByRole('switch').hasAttribute('disabled')).toBe(false) })
    fireEvent.click(screen.getByRole('switch'))
    expect(await screen.findByText('百炼 Qwen3.8 视觉能力')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('百炼 API Key'), { target: { value: 'bailian-test-key' } })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '验证并开启' }).hasAttribute('disabled')).toBe(false)
    })
    fireEvent.click(screen.getByRole('button', { name: '验证并开启' }))

    await screen.findByText('识别成功，视觉能力已开启')
    expect(enableVision).toHaveBeenCalledWith(expect.objectContaining({
      apiKey: 'bailian-test-key', mediaType: 'image/webp',
    }), expect.any(AbortSignal))
    expect(updateSettings).not.toHaveBeenCalledWith({ ns: 'vision-enhancement', patch: { enabled: true } })
  })
})
