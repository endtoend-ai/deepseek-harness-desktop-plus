// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { BrandBadge } from '../src/client/BrandBadge.tsx'

afterEach(cleanup)

const unusedHook = (() => { throw new Error('unused') }) as never
const allow = (): boolean => true
/** Global seats this badge never reads; every access seat allows, so rendering stays observable. */
const seats = {
  useSessions: unusedHook,
  useWorkspaces: unusedHook,
  usePanelInfo: unusedHook,
  useSessionStatus: unusedHook,
  useSessionRetainInfo: unusedHook,
  useSessionAccess: allow,
  useRemoteAccess: allow,
  useResource: unusedHook,
  useWorkspaceAccess: allow,
} as const

describe('Beyondata sidebar attribution', () => {
  it('shows the attribution text in the wide sidebar', () => {
    render(<BrandBadge wide {...seats} />)

    const link = screen.getByRole('link', { name: '访问赋范空间官网' })
    expect(link.getAttribute('href')).toBe('https://www.beyondata.com/')
    expect(screen.getByText('赋范空间出品')).not.toBeNull()
  })

  it('keeps only the tooltip-backed logo in the collapsed rail', () => {
    render(<BrandBadge wide={false} {...seats} />)

    expect(screen.getByRole('link', { name: '访问赋范空间官网' })).not.toBeNull()
    expect(screen.queryByText('赋范空间出品')).toBeNull()
  })
})
