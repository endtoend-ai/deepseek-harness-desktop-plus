/**
 * Frameless window chrome: each platform keeps its native window controls
 * clear and exposes the same draggable band height the native title bar
 * already reserves.
 */

import { describe, expect, it } from 'vitest'
import { desktopChromeCss, desktopChromeScript } from '../src/desktop-chrome.ts'

describe('desktop window chrome', () => {
  it('reserves the macOS traffic-light area on the left', () => {
    const css = desktopChromeCss('darwin')
    expect(css).toContain('left: 90px;')
    expect(css).toContain('right: 0px;')
    expect(css).toContain('height: 27px;')
    expect(css).toContain('-webkit-app-region: drag;')
  })

  it('reserves the Windows caption-button area on the right', () => {
    const css = desktopChromeCss('win32')
    expect(css).toContain('left: 0px;')
    expect(css).toContain('right: 138px;')
    expect(css).toContain('height: 32px;')
  })

  it('leaves both edges to the page on Linux', () => {
    const css = desktopChromeCss('linux')
    expect(css).toContain('left: 0px;')
    expect(css).toContain('right: 0px;')
  })

  it('marks the document with the hosting platform', () => {
    expect(desktopChromeScript('win32'))
      .toBe("document.documentElement.setAttribute('data-dsh-desktop', \"win32\")")
  })
})
