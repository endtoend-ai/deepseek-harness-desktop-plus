/** General-settings row for the shared Desktop visual capability. */

import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { VisionEnhancementInjected } from './VisionEnhancementShortcut.tsx'
import { VisionEnhancementDialog } from './VisionEnhancementDialog.tsx'
import css from './VisionEnhancementRow.module.css'

/** Full Settings-row props. */
export type VisionEnhancementRowProps =
  PropsRuntime<'settings.general.item'> & InjectFace<VisionEnhancementInjected>

/** Render the full Settings entry while sharing status with the composer shortcut. */
export function VisionEnhancementRow({
  useVisionEnhancement, load, disable, enable,
}: VisionEnhancementRowProps): ReactNode {
  const state = useVisionEnhancement(snapshot => snapshot)
  const [open, setOpen] = useState(false)
  const [failure, setFailure] = useState<string>()

  useEffect(() => { void load() }, [load])

  const status = useMemo(() => {
    if (state.status === 'idle' || state.status === 'loading') return 'Reading'
    if (state.status === 'saving') return 'Saving'
    if (state.enabled) return 'On'
    return 'Off'
  }, [state.enabled, state.status])

  const busy = state.status === 'idle' || state.status === 'loading' || state.status === 'saving'
  const providerName = state.providers.find(provider => provider.id === state.provider)?.name ?? state.provider
  const activate = (): void => {
    setFailure(undefined)
    if (!state.enabled) {
      setOpen(true)
      return
    }
    void disable().catch((error: unknown) => {
      setFailure(error instanceof Error ? error.message : String(error))
      setOpen(true)
    })
  }

  return (
    <>
      <div className={css.row} data-testid="vision-enhancement-row">
        <div className={css.rowText}>
          <div className={css.titleLine}>
            <span className={css.spark}>V</span>
            <span className={css.title}>Visual enhancement</span>
            <span className={css.model}>Compatible vision · {providerName} · {state.model}</span>
          </div>
          <div className={css.desc} role={state.error === null ? undefined : 'alert'}>
            {state.error ?? 'The in-conversation Vision Enhancement switch selects the official multimodal model; this row configures a compatible fallback for text-only models.'}
          </div>
        </div>
        <div className={css.control}>
          <span className={state.enabled ? css.statusOn : css.status}>{status}</span>
          <button
            type="button"
            className={state.enabled ? css.toggleOn : css.toggle}
            role="switch"
            aria-checked={state.enabled}
            aria-label="Visual enhancement"
            disabled={busy}
            onClick={activate}
          ><span /></button>
        </div>
      </div>
      <VisionEnhancementDialog
        open={open}
        provider={state.provider}
        providers={state.providers}
        model={state.model}
        baseUrl={state.baseUrl ?? ''}
        failure={failure}
        enable={enable}
        onClose={() => { setOpen(false) }}
      />
    </>
  )
}
