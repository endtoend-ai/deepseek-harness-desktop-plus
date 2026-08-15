/** Fixed Electron bridge shared by the Desktop main process and preload. */

/** Update lifecycle exposed to the sandboxed renderer. */
type DesktopUpdatePhase =
  | 'development'
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'up-to-date'
  | 'error'

/** Immutable update snapshot delivered to the settings page. */
export interface DesktopUpdateState {
  readonly phase: DesktopUpdatePhase
  readonly currentVersion: string
  readonly availableVersion?: string
  readonly progress?: number
  readonly message?: string
}

/** Four colors extracted from the selected background. */
export type DesktopAppearancePalette = readonly [string, string, string, string]

/** Persisted appearance settings. A null image selects the bundled default. */
export interface DesktopAppearanceSettings {
  readonly imageDataUrl: string | null
  readonly focusY: number
  readonly glassStrength: number
  readonly palette: DesktopAppearancePalette
}

/** Renderer-safe API exposed through contextBridge. */
export interface DesktopBridge {
  readonly platform: NodeJS.Platform
  readonly appearance: {
    get(): Promise<DesktopAppearanceSettings>
    save(settings: DesktopAppearanceSettings): Promise<DesktopAppearanceSettings>
    reset(): Promise<DesktopAppearanceSettings>
  }
  readonly updates: {
    getState(): Promise<DesktopUpdateState>
    check(): Promise<DesktopUpdateState>
    download(): Promise<DesktopUpdateState>
    install(): Promise<void>
    onState(listener: (state: DesktopUpdateState) => void): () => void
  }
}

/** Closed channel set; the preload never accepts a caller-provided channel. */
export const DESKTOP_CHANNELS = {
  appearanceGet: 'dsh-desktop:appearance:get',
  appearanceSave: 'dsh-desktop:appearance:save',
  appearanceReset: 'dsh-desktop:appearance:reset',
  updatesGet: 'dsh-desktop:updates:get',
  updatesCheck: 'dsh-desktop:updates:check',
  updatesDownload: 'dsh-desktop:updates:download',
  updatesInstall: 'dsh-desktop:updates:install',
  updatesState: 'dsh-desktop:updates:state',
} as const
