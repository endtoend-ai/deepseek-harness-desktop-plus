/** Guided visual-provider configuration shared by the Settings row and composer shortcut. */

import { useEffect, useState } from 'react'
import type { ChangeEvent, ReactNode } from 'react'
import { Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import type {
  VisionEnableProbe, VisionEnhancementState,
} from './vision-enhancement-controller.ts'
import css from './VisionEnhancementRow.module.css'

const DEFAULT_IMAGE = '/dsh-desktop/default-background.webp'
const ACCEPTED = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])

interface PreparedImage {
  url: string
  data: string
  mediaType: VisionEnableProbe['mediaType']
  name: string
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function imageFromBlob(blob: Blob, name: string): Promise<PreparedImage> {
  if (!ACCEPTED.has(blob.type)) throw new Error('Only PNG, JPEG, WebP or GIF images are supported.')
  if (blob.size > 10 * 1024 * 1024) throw new Error('Images must be 10 MB or smaller.')
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== 'string') { reject(new Error('Image encoding failed.')); return }
      resolve(reader.result)
    }
    reader.onerror = () => { reject(new Error('Reading the image failed.')) }
    reader.readAsDataURL(blob)
  })
  const comma = dataUrl.indexOf(',')
  if (comma < 0) throw new Error('Image encoding failed.')
  return {
    url: dataUrl,
    data: dataUrl.slice(comma + 1),
    mediaType: blob.type as PreparedImage['mediaType'],
    name,
  }
}

async function defaultImage(): Promise<PreparedImage> {
  const response = await fetch(DEFAULT_IMAGE)
  if (!response.ok) throw new Error('Loading the sample image failed.')
  return imageFromBlob(await response.blob(), 'sample-cover.webp')
}

/** Props for the shared atomic enable dialog. */
interface VisionEnhancementDialogProps {
  open: boolean
  provider: VisionEnhancementState['provider']
  providers: VisionEnhancementState['providers']
  model: string
  baseUrl: string
  failure?: string | undefined
  onClose: () => void
  enable: (input: VisionEnableProbe, signal?: AbortSignal) => Promise<string>
}

/** Verify a real image before enabling the shared visual capability. */
export function VisionEnhancementDialog({
  open, provider: activeProvider, providers, model: activeModel, baseUrl: activeBaseUrl,
  failure: outerFailure, onClose, enable,
}: VisionEnhancementDialogProps): ReactNode {
  const [apiKey, setApiKey] = useState('')
  const [provider, setProvider] = useState(activeProvider)
  const [model, setModel] = useState(activeModel)
  const [baseUrl, setBaseUrl] = useState(activeBaseUrl)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string>()
  const [result, setResult] = useState<string>()
  const [image, setImage] = useState<PreparedImage>()

  const selectedProvider = providers.find(candidate => candidate.id === provider) ?? providers[0]

  useEffect(() => {
    if (open) return
    setProvider(activeProvider)
    setModel(activeModel)
    setBaseUrl(activeBaseUrl)
    setApiKey('')
    setFailure(undefined)
    setResult(undefined)
  }, [activeBaseUrl, activeModel, activeProvider, open])

  useEffect(() => {
    if (!open || image !== undefined) return
    let active = true
    void defaultImage().then((next) => { if (active) setImage(next) }, (error: unknown) => {
      if (active) setFailure(messageOf(error))
    })
    return () => { active = false }
  }, [image, open])

  const verify = async (): Promise<void> => {
    if (image === undefined) { setFailure('The verification image is not ready yet.'); return }
    if (selectedProvider === undefined) { setFailure('No vision provider is available.'); return }
    if (model.trim() === '') { setFailure('Enter a vision model.'); return }
    if (selectedProvider.baseUrlEditable === true && baseUrl.trim() === '') {
      setFailure(`Enter the ${selectedProvider.name} service address.`)
      return
    }
    if (selectedProvider.apiKeyRequired !== false && !selectedProvider.configured && apiKey.trim() === '') {
      setFailure(`Enter the ${selectedProvider.name} API key.`)
      return
    }
    setBusy(true)
    setFailure(undefined)
    setResult(undefined)
    try {
      const description = await enable({
        ...(apiKey.trim() === '' ? {} : { apiKey: apiKey.trim() }),
        provider,
        model: model.trim(),
        ...(selectedProvider.baseUrlEditable === true ? { baseUrl: baseUrl.trim() } : {}),
        mediaType: image.mediaType,
        data: image.data,
        name: image.name,
        question: 'Describe the subject, the scene and any clearly visible text in this image. Answer concisely.',
      }, AbortSignal.timeout(70_000))
      setApiKey('')
      setResult(description)
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

  const pickProvider = (event: ChangeEvent<HTMLSelectElement>): void => {
    const next = event.target.value as VisionEnhancementState['provider']
    const nextProvider = providers.find(candidate => candidate.id === next)
    if (nextProvider === undefined) return
    setProvider(next)
    setModel(next === activeProvider ? activeModel : nextProvider.defaultModel)
    setBaseUrl(next === activeProvider ? activeBaseUrl : nextProvider.defaultBaseUrl ?? '')
    setApiKey('')
    setFailure(undefined)
    setResult(undefined)
  }

  return (
    <Modal
      open={open}
      title="Enable visual enhancement"
      closeLabel="Close"
      onClose={() => { if (!busy) onClose() }}
      className={css['modal'] as string}
    >
      <div className={css.modalBody}>
        <div className={css.hero}>
          <div className={css.heroIcon}>{({
            bailian: 'Q', openrouter: 'O', ollama: 'O', vllm: 'V', sglang: 'S', custom: 'C',
          } as const)[provider]}</div>
          <div><strong>{selectedProvider?.name ?? 'Compatible provider'} · {model}</strong><span>Once verified, the capability attaches to the four built-in Agents and to Agent presets created later.</span></div>
        </div>
        <div className={css.fieldGrid}>
          <label className={css.field}>
            <span>Compatible provider</span>
            <select value={provider} onChange={pickProvider} disabled={busy}>
              {providers.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
            </select>
          </label>
          <label className={css.field}>
            <span>Compatible model</span>
            <input
              value={model}
              readOnly={selectedProvider?.modelEditable !== true}
              onChange={(event) => { setModel(event.target.value) }}
              disabled={busy}
            />
          </label>
        </div>
        {selectedProvider?.baseUrlEditable === true && <label className={css.field}>
          <span>OpenAI-compatible service address</span>
          <input
            value={baseUrl}
            placeholder={selectedProvider.defaultBaseUrl ?? 'http://127.0.0.1:8000/v1'}
            onChange={(event) => { setBaseUrl(event.target.value) }}
            disabled={busy}
          />
        </label>}
        <label className={css.field}>
          <span>{selectedProvider?.name ?? 'Compatible provider'} API key{selectedProvider?.apiKeyRequired === false ? ' (optional)' : ''}</span>
          <input
            type="password"
            autoComplete="off"
            value={apiKey}
            placeholder={selectedProvider?.apiKeyRequired === false
              ? 'Leave empty when the local service requires no authentication'
              : selectedProvider?.configured === true ? 'Saved; leave empty to verify again' : 'Enter the API key'}
            onChange={(event) => { setApiKey(event.target.value) }}
            disabled={busy}
          />
        </label>
        {selectedProvider !== undefined && <p className={css.help}><a href={selectedProvider.apiKeyUrl} target="_blank" rel="noreferrer">Open the {selectedProvider.name} API documentation</a></p>}
        <div className={css.testCard}>
          <div className={css.imageWrap}>{image === undefined ? <span>Preparing the sample image…</span> : <img src={image.url} alt="Visual verification image" />}</div>
          <div className={css.testInfo}>
            <strong>Verify with a real image</strong>
            <span>{image?.name ?? 'Sample cover'}</span>
            <label className={css.upload}>Replace verification image<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={pickImage} disabled={busy} /></label>
          </div>
        </div>
        {result !== undefined && <div className={css.success}><strong>Recognition succeeded; visual enhancement is on</strong><p>{result}</p></div>}
        {(failure ?? outerFailure) !== undefined && <div className={css.error} role="alert">{failure ?? outerFailure}</div>}
        <p className={css.privacy}>The verification image is sent only to {selectedProvider?.baseUrlEditable === true ? baseUrl || 'the service address you entered' : selectedProvider?.name ?? 'the selected compatible provider'}; the API key is stored only in this machine's protected credential file and never written into a conversation or project code.</p>
        <div className={css.actions}>
          <button type="button" className={css.secondary} disabled={busy} onClick={onClose}>{result === undefined ? 'Cancel' : 'Done'}</button>
          {result === undefined && <button type="button" className={css.primary} disabled={busy || image === undefined || selectedProvider === undefined} onClick={() => { void verify() }}>{busy ? `Verifying through ${selectedProvider?.name ?? 'the compatible service'}…` : 'Verify and enable'}</button>}
        </div>
      </div>
    </Modal>
  )
}
