/** In-app background chooser over the proven Harness image-skin pipeline. */

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import type { ChangeEvent, ReactNode } from 'react'
import type { AppearanceController } from './appearance-controller.ts'
import { DEFAULT_BACKGROUND_URL } from './appearance-controller.ts'
import { extractPalette, loadImage, renderBackground, validateImageFile } from './background-image.ts'
import css from './DesktopCustomization.module.css'

export interface AppearanceSectionInjected {
  readonly controller: AppearanceController
}

export type AppearanceSectionProps = Partial<AppearanceSectionInjected>

/** Render the background selection, crop focus, glass, save, and reset controls. */
export function AppearanceSection({ controller }: AppearanceSectionProps): ReactNode {
  if (controller === undefined) return null
  return <LoadedAppearance controller={controller} />
}

function LoadedAppearance({ controller }: AppearanceSectionInjected): ReactNode {
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot)
  const [previewUrl, setPreviewUrl] = useState(snapshot.settings.imageDataUrl ?? DEFAULT_BACKGROUND_URL)
  const [selectedUrl, setSelectedUrl] = useState<string | undefined>(undefined)
  const [focusY, setFocusY] = useState(snapshot.settings.focusY)
  const [glassStrength, setGlassStrength] = useState(snapshot.settings.glassStrength)
  const [fileLabel, setFileLabel] = useState('当前使用默认背景')
  const [localMessage, setLocalMessage] = useState<string | undefined>(undefined)
  const busy = snapshot.status === 'saving'

  useEffect(() => {
    if (selectedUrl !== undefined) return
    setPreviewUrl(snapshot.settings.imageDataUrl ?? DEFAULT_BACKGROUND_URL)
    setFocusY(snapshot.settings.focusY)
    setGlassStrength(snapshot.settings.glassStrength)
    setFileLabel(snapshot.settings.imageDataUrl === null ? '当前使用默认背景' : '当前使用自定义背景')
  }, [selectedUrl, snapshot.settings])

  useEffect(() => () => {
    if (selectedUrl !== undefined) URL.revokeObjectURL(selectedUrl)
  }, [selectedUrl])

  const previewStyle = useMemo(() => ({
    backgroundImage: `linear-gradient(90deg, rgba(4, 12, 22, ${String(0.18 + glassStrength / 220)}) 0%, rgba(7, 20, 34, 0.08) 50%, rgba(4, 12, 22, 0.30) 100%), url("${previewUrl}")`,
    backgroundPosition: `center, center ${String(focusY)}%`,
  }), [focusY, glassStrength, previewUrl])

  const selectFile = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file === undefined) return
    const invalid = validateImageFile(file)
    if (invalid !== undefined) { setLocalMessage(invalid); return }
    if (selectedUrl !== undefined) URL.revokeObjectURL(selectedUrl)
    const url = URL.createObjectURL(file)
    setSelectedUrl(url)
    setPreviewUrl(url)
    setFocusY(50)
    setFileLabel(`${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB`)
    setLocalMessage('图片只在本机处理，不会上传。')
  }

  const save = async (): Promise<void> => {
    setLocalMessage('正在处理 1920 × 1080 WebP…')
    try {
      let imageDataUrl = snapshot.settings.imageDataUrl
      let palette = snapshot.settings.palette
      if (selectedUrl !== undefined) {
        const image = await loadImage(selectedUrl)
        const canvas = renderBackground(image, focusY)
        imageDataUrl = canvas.toDataURL('image/webp', 0.86)
        palette = extractPalette(canvas)
      }
      await controller.save({ imageDataUrl, focusY, glassStrength, palette })
      if (selectedUrl !== undefined) URL.revokeObjectURL(selectedUrl)
      setSelectedUrl(undefined)
      setLocalMessage('背景已保存，重新启动应用后仍会保留。')
    } catch (error) {
      setLocalMessage(error instanceof Error ? error.message : String(error))
    }
  }

  const reset = async (): Promise<void> => {
    try {
      await controller.reset()
      if (selectedUrl !== undefined) URL.revokeObjectURL(selectedUrl)
      setSelectedUrl(undefined)
      setPreviewUrl(DEFAULT_BACKGROUND_URL)
      setFocusY(50)
      setGlassStrength(72)
      setLocalMessage('已恢复赋范空间默认背景。')
    } catch (error) {
      setLocalMessage(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <section className={css.section}>
      <div>
        <h2 className={css.title}>背景与界面氛围</h2>
        <p className={css.intro}>选择自己的图片，Harness 会在本机完成裁切和配色，并自动适配浅色、深色界面。</p>
      </div>
      <div className={css.preview} style={previewStyle} role="img" aria-label="当前背景预览">
        <div className={css.previewChrome}>
          <span />
          <strong>DeepSeek Harness</strong>
        </div>
        <div className={css.previewGlass}>
          <span>背景预览</span>
          <small>1920 × 1080 WebP</small>
        </div>
      </div>
      <div className={css.fileRow}>
        <div>
          <strong>{fileLabel}</strong>
          <small>支持 PNG、JPG、WebP，原图不超过 16 MB</small>
        </div>
        <label className={css.secondaryButton}>
          选择图片
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={selectFile} />
        </label>
      </div>
      <label className={css.rangeRow}>
        <span><b>主体焦点</b><output>{focusY}%</output></span>
        <input type="range" min="0" max="100" value={focusY} onChange={event => { setFocusY(Number(event.target.value)) }} />
      </label>
      <label className={css.rangeRow}>
        <span><b>界面玻璃层</b><output>{glassStrength}%</output></span>
        <input type="range" min="35" max="92" value={glassStrength} onChange={event => { setGlassStrength(Number(event.target.value)) }} />
      </label>
      {(localMessage ?? snapshot.message) !== undefined && (
        <p className={snapshot.status === 'error' ? css.error : css.notice}>{localMessage ?? snapshot.message}</p>
      )}
      <div className={css.actions}>
        <button type="button" className={css.primaryButton} disabled={busy} onClick={() => { void save() }}>
          {busy ? '保存中…' : '保存并应用'}
        </button>
        <button type="button" className={css.secondaryButton} disabled={busy} onClick={() => { void reset() }}>
          恢复默认
        </button>
      </div>
    </section>
  )
}

