/** Visible update center backed by the Electron main-process updater. */

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { DesktopRendererBridge, DesktopUpdateState } from './bridge.ts'
import css from './DesktopCustomization.module.css'

export interface UpdateSectionInjected {
  readonly bridge: DesktopRendererBridge | undefined
}

export type UpdateSectionProps = Partial<UpdateSectionInjected>

/** Render the installed Studio shell and embedded Harness core versions. */
export function UpdateSection({ bridge }: UpdateSectionProps): ReactNode {
  const [state, setState] = useState<DesktopUpdateState | undefined>(undefined)
  useEffect(() => {
    if (bridge === undefined) return
    let active = true
    void bridge.updates.getState().then((next) => { if (active) setState(next) })
    return () => { active = false }
  }, [bridge])

  return (
    <section className={css.section}>
      <div>
        <h2 className={css.title}>Software update</h2>
        <p className={css.intro}>Online updates are not available yet. To update, download the latest installer from the release page.</p>
      </div>
      <div className={css.updateCard}>
        <div className={css.updateIcon}>DSH</div>
        <div className={css.updateIdentity}>
          <strong>DeepSeek Harness Desktop</strong>
          <span>Desktop {state?.currentVersion ?? 'Reading…'}</span>
          <span>Harness core {state?.harnessVersion ?? 'Reading…'}</span>
        </div>
        <span className={css.statusPill}>Not available yet</span>
      </div>
      <div className={css.actions}>
        <button type="button" className={css.primaryButton} disabled>Online updates not available yet</button>
      </div>
    </section>
  )
}
