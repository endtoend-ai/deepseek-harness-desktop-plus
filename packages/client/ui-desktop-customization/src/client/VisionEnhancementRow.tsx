/** General-settings row and guided Bailian visual capability verification. */

import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, ReactNode } from 'react'
import type { ConnectionHandle } from '@deepseek-ai/dsh-api-remotes/client'
import { Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import css from './VisionEnhancementRow.module.css'

const SETTINGS_NS = 'vision-enhancement'
const DEFAULT_IMAGE = '/dsh-desktop/default-background.webp'
const API_KEY_URL = 'https://help.aliyun.com/zh/model-studio/get-api-key'
const ACCEPTED = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])

export interface VisionEnhancementRowInjected { api: ConnectionHandle['api'] }
export type VisionEnhancementRowProps = PropsRuntime<'settings.general.item'> & VisionEnhancementRowInjected

interface PreparedImage { url: string; data: string; mediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'; name: string }

function messageOf(error: unknown): string { return error instanceof Error ? error.message : String(error) }

async function imageFromBlob(blob: Blob, name: string): Promise<PreparedImage> {
  if (!ACCEPTED.has(blob.type)) throw new Error('仅支持 PNG、JPEG、WebP 或 GIF 图片。')
  if (blob.size > 10 * 1024 * 1024) throw new Error('图片不能超过 10 MB。')
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== 'string') { reject(new Error('图片编码失败。')); return }
      resolve(reader.result)
    }
    reader.onerror = () => { reject(new Error('读取图片失败。')) }
    reader.readAsDataURL(blob)
  })
  const comma = dataUrl.indexOf(',')
  if (comma < 0) throw new Error('图片编码失败。')
  return {
    url: dataUrl,
    data: dataUrl.slice(comma + 1),
    mediaType: blob.type as PreparedImage['mediaType'],
    name,
  }
}

async function defaultImage(): Promise<PreparedImage> {
  const response = await fetch(DEFAULT_IMAGE)
  if (!response.ok) throw new Error('默认小猫图片加载失败。')
  return imageFromBlob(await response.blob(), '默认小猫封面.webp')
}

/** Render the toggle; opening it requires a real Bailian visual probe. */
export function VisionEnhancementRow({ api }: VisionEnhancementRowProps): ReactNode {
  const [enabled, setEnabled] = useState(false)
  const [configured, setConfigured] = useState(false)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string>()
  const [result, setResult] = useState<string>()
  const [image, setImage] = useState<PreparedImage>()

  useEffect(() => {
    let active = true
    void api.vision.status({}).then((response) => {
      if (!active) return
      if (response.result.ok) {
        setEnabled(response.result.value.enabled)
        setConfigured(response.result.value.configured)
      }
      setLoading(false)
    }, () => { if (active) setLoading(false) })
    return () => { active = false }
  }, [api])

  useEffect(() => {
    if (!open || image !== undefined) return
    let active = true
    void defaultImage().then((next) => { if (active) setImage(next) }, (error: unknown) => {
      if (active) setFailure(messageOf(error))
    })
    return () => { active = false }
  }, [image, open])

  const status = useMemo(() => loading ? '读取中' : enabled ? '已开启' : '未开启', [enabled, loading])

  const persistEnabled = async (value: boolean): Promise<void> => {
    const response = await api.settings.update({ ns: SETTINGS_NS, patch: { enabled: value } })
    if (!response.result.ok) throw new Error(response.result.error.message)
    setEnabled(value)
  }

  const disable = async (): Promise<void> => {
    setBusy(true)
    try { await persistEnabled(false) } catch (error) { setFailure(messageOf(error)); setOpen(true) } finally { setBusy(false) }
  }

  const verify = async (): Promise<void> => {
    if (image === undefined) { setFailure('验证图片还没有准备好。'); return }
    if (!configured && apiKey.trim() === '') { setFailure('请输入百炼 API Key。'); return }
    setBusy(true)
    setFailure(undefined)
    setResult(undefined)
    try {
      const tested = await api.vision.enable({
        ...(apiKey.trim() === '' ? {} : { apiKey: apiKey.trim() }),
        mediaType: image.mediaType,
        data: image.data,
        name: image.name,
        question: '请识别这张图片的主体、场景和清晰可见的文字，用中文简洁回答。',
      }, AbortSignal.timeout(70_000))
      if (!tested.result.ok) throw new Error(tested.result.error.message)
      setConfigured(true)
      setEnabled(true)
      setApiKey('')
      setResult(tested.result.value.description)
    } catch (error) {
      setFailure(messageOf(error))
    } finally {
      setBusy(false)
    }
  }

  const pickImage = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0]
    if (file === undefined) return
    setFailure(undefined)
    setResult(undefined)
    void imageFromBlob(file, file.name).then(setImage, (error: unknown) => { setFailure(messageOf(error)) })
    event.target.value = ''
  }

  return (
    <>
      <div className={css.row} data-testid="vision-enhancement-row">
        <div className={css.rowText}>
          <div className={css.titleLine}>
            <span className={css.spark}>视</span>
            <span className={css.title}>视觉能力增强</span>
            <span className={css.model}>Qwen3.8</span>
          </div>
          <div className={css.desc}>让所有 Agent 都能理解截图、照片、图表和图片文字。</div>
        </div>
        <div className={css.control}>
          <span className={enabled ? css.statusOn : css.status}>{status}</span>
          <button
            type="button"
            className={enabled ? css.toggleOn : css.toggle}
            role="switch"
            aria-checked={enabled}
            aria-label="视觉能力增强"
            disabled={loading || busy}
            onClick={() => { if (enabled) void disable(); else setOpen(true) }}
          ><span /></button>
        </div>
      </div>
      <Modal open={open} title="开启视觉能力增强" onClose={() => { if (!busy) setOpen(false) }} className={css['modal'] as string}>
        <div className={css.modalBody}>
          <div className={css.hero}>
            <div className={css.heroIcon}>Q</div>
            <div><strong>百炼 Qwen3.8 视觉能力</strong><span>验证通过后，能力会自动挂载到四个内置 Agent，以及未来新增的 Agent Preset。</span></div>
          </div>
          <label className={css.field}>
            <span>百炼 API Key</span>
            <input
              type="password"
              autoComplete="off"
              value={apiKey}
              placeholder={configured ? '已保存，可留空直接重新验证' : '请输入 DASHSCOPE_API_KEY'}
              onChange={(event) => { setApiKey(event.target.value) }}
              disabled={busy}
            />
          </label>
          <p className={css.help}>还没有 Key？<a href={API_KEY_URL} target="_blank" rel="noreferrer">进入阿里云百炼官网获取 API Key</a></p>
          <div className={css.testCard}>
            <div className={css.imageWrap}>{image === undefined ? <span>正在准备默认小猫图片…</span> : <img src={image.url} alt="视觉验证图片" />}</div>
            <div className={css.testInfo}>
              <strong>用一张图片做真实验证</strong>
              <span>{image?.name ?? '默认小猫封面'}</span>
              <label className={css.upload}>更换验证图片<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={pickImage} disabled={busy} /></label>
            </div>
          </div>
          {result !== undefined && <div className={css.success}><strong>识别成功，视觉能力已开启</strong><p>{result}</p></div>}
          {failure !== undefined && <div className={css.error} role="alert">{failure}</div>}
          <p className={css.privacy}>验证图片会发送至阿里云百炼进行识别；API Key 仅保存在本机受保护的凭证文件中，不会写入对话或项目代码。</p>
          <div className={css.actions}>
            <button type="button" className={css.secondary} disabled={busy} onClick={() => { setOpen(false) }}>{result === undefined ? '取消' : '完成'}</button>
            {result === undefined && <button type="button" className={css.primary} disabled={busy || image === undefined} onClick={() => { void verify() }}>{busy ? '正在调用百炼验证…' : '验证并开启'}</button>}
          </div>
        </div>
      </Modal>
    </>
  )
}
