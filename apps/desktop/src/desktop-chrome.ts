/**
 * Frameless window chrome for the Desktop shell.
 *
 * The Host serves the ordinary Web application, whose shell knows nothing
 * about a native window. The Desktop therefore owns the draggable title band
 * itself: it marks the document with `data-dsh-desktop` and installs a fixed
 * strip along the window's top edge. Native window buttons keep their own
 * reserved areas — macOS traffic lights on the left, Windows overlay controls
 * on the right — so the strip never covers them, and its height matches the
 * native title band the platform already reserves.
 */

/** Desktop platforms with distinct window chrome. */
export type DesktopChromePlatform = 'darwin' | 'win32' | 'linux'

/** Draggable band height in CSS pixels, per platform. */
const DRAG_HEIGHT: Record<DesktopChromePlatform, number> = {
  darwin: 27,
  win32: 32,
  linux: 32,
}

/** Insets keeping the draggable band clear of native window controls. */
const DRAG_BAND_INSETS: Record<DesktopChromePlatform, { readonly left: number; readonly right: number }> = {
  darwin: { left: 90, right: 0 },
  win32: { left: 0, right: 138 },
  linux: { left: 0, right: 0 },
}

/**
 * Stylesheet giving the page a draggable window band.
 * @param platform - Native platform the window belongs to.
 * @returns CSS text applied to the Host page on every load.
 */
export function desktopChromeCss(platform: DesktopChromePlatform): string {
  const { left, right } = DRAG_BAND_INSETS[platform]
  return [
    'html[data-dsh-desktop]::before {',
    "  content: '';",
    '  position: fixed;',
    '  top: 0;',
    `  left: ${left}px;`,
    `  right: ${right}px;`,
    `  height: ${DRAG_HEIGHT[platform]}px;`,
    '  -webkit-app-region: drag;',
    '  z-index: 2147483647;',
    '}',
  ].join('\n')
}

/**
 * Page script marking the document as a Desktop-hosted Web surface.
 * @param platform - Native platform the window belongs to.
 * @returns JavaScript evaluated in the Host page on every load.
 */
export function desktopChromeScript(platform: DesktopChromePlatform): string {
  return `document.documentElement.setAttribute('data-dsh-desktop', ${JSON.stringify(platform)})`
}
