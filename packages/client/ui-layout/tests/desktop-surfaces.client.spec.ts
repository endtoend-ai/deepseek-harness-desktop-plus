/**
 * Desktop surface selectors: native material stops at the sidebar boundary.
 *
 * The 0.2.1 shell targets the desktop with `[data-platform='darwin']` plus the
 * Windows `data-windows-titlebar` clearance variables; the retired
 * `data-dsh-desktop-platform` surface and its Linux title-bar inset are gone,
 * so these assertions pin what the current frame actually declares.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(fileURLToPath(new URL('../src/client/AppFrame.module.css', import.meta.url)), 'utf8')

/** Retired desktop surface markers the 0.2.1 frame no longer has. */
const RETIRED_DESKTOP_MARKERS = [
  "data-dsh-desktop-platform='darwin'",
  "data-dsh-desktop-platform='win32'",
  "data-dsh-desktop-platform='linux'",
] as const

describe('AppFrame desktop surfaces', () => {
  it('places the three columns through the inline template and spans the bottom row', () => {
    // Column widths come from the layout solve (inline grid-template-columns),
    // so the stylesheet must not hardcode track positions; only the bottom row
    // spans every track and the overlay covers the frame.
    for (const column of ['.sidebarCol', '.centerCol', '.rightbarCol']) {
      expect(css).not.toMatch(new RegExp(`${column.replace('.', '\\.')}\\s*\\{[^}]*grid-column:`, 's'))
    }
    expect(css).toMatch(/\.bottomRow\s*\{[^}]*grid-column: 1 \/ -1;/s)
    expect(css).toMatch(/\.overlayLayer\s*\{[^}]*position: absolute;[^}]*inset: 0;/s)
  })

  it.each([
    ['darwin', "data-platform='darwin'"],
    ['win32', "data-platform='win32'"],
  ] as const)('admits %s material only through the macOS marker', (platform, marker) => {
    if (platform === 'darwin') {
      expect(css).toContain(`:global([${marker}]) .frame`)
      expect(css).toContain(`:global([${marker}]) .sidebarCol`)
      expect(css).toContain(`:global([${marker}]) .centerCol`)
      expect(css).toContain(`:global([${marker}]) .rightbarCol`)
      return
    }
    // Windows keeps the opaque web surfaces; its only desktop hint is the
    // caption-row clearance variables below.
    expect(css).not.toContain(`[${marker}]`)
  })

  it('keeps non-macOS platforms opaque with no retired desktop inset', () => {
    for (const marker of RETIRED_DESKTOP_MARKERS) expect(css).not.toContain(marker)
    // The Linux title-bar reservation went away with the retired shell; the frame
    // owns no window inset variable today.
    expect(css).not.toContain('--dsh-desktop-titlebar-inset')
    expect(css).not.toContain('data-dsh-desktop')
  })

  it('moves the Windows overlay and chrome tops without insetting work columns', () => {
    expect(css).toContain(":global(html[data-windows-titlebar]) {")
    expect(css).toMatch(/--dsh-frame-overlay-top: calc\(var\(--dsh-frame-top-clearance\) \+ 20px\);/)
    expect(css).toMatch(/html\[data-windows-titlebar\]\[data-fullscreen\]\)[\s\S]*?--dsh-frame-chrome-top: 0px;/)
    expect(css).not.toMatch(new RegExp("data-windows-titlebar[^{]*\\\\{[^}]*padding-top", 's'))
  })

  it.each(['darwin', 'win32'])('does not inset %s work columns', (platform) => {
    expect(css).not.toMatch(new RegExp(`data-platform='${platform}'\\]\\) \\.centerCol[^{]*\\{[^}]*padding-top`, 's'))
  })

  it('uses theme tokens for the macOS tint and the opaque work columns', () => {
    // The sidebar keeps only a translucent tint so window vibrancy shows.
    expect(css).toMatch(/color-mix\(in srgb, color-mix\(in srgb, var\(--dsw-specific-sidebar-fill\) 97%, rgb\(122 155 240\)\) 40%, transparent\)/)
    // Reduce Transparency flattens the tint to a near-opaque token fill.
    expect(css).toContain('background: color-mix(in srgb, var(--dsw-specific-sidebar-fill) 90%, transparent);')
    // The work columns paint the base surface, never a literal colour.
    expect(css).toContain('background: var(--dsw-alias-bg-base);')
    expect(css).toContain('background: var(--dsw-specific-sidebar-fill);')
  })
})
