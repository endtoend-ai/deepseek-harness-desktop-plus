/** Sandboxed renderer bridge: fixed methods only, no generic IPC escape hatch. */

import { contextBridge, ipcRenderer } from 'electron'
import {
  DESKTOP_CHANNELS,
  type DesktopAppearanceSettings,
  type DesktopBridge,
  type DesktopUpdateState,
} from './desktop-bridge-contract.ts'

const bridge: DesktopBridge = Object.freeze({
  platform: process.platform,
  appearance: Object.freeze({
    get: () => ipcRenderer.invoke(DESKTOP_CHANNELS.appearanceGet) as Promise<DesktopAppearanceSettings>,
    save: (settings: DesktopAppearanceSettings) =>
      ipcRenderer.invoke(DESKTOP_CHANNELS.appearanceSave, settings) as Promise<DesktopAppearanceSettings>,
    reset: () => ipcRenderer.invoke(DESKTOP_CHANNELS.appearanceReset) as Promise<DesktopAppearanceSettings>,
  }),
  updates: Object.freeze({
    getState: () => ipcRenderer.invoke(DESKTOP_CHANNELS.updatesGet) as Promise<DesktopUpdateState>,
    check: () => ipcRenderer.invoke(DESKTOP_CHANNELS.updatesCheck) as Promise<DesktopUpdateState>,
    download: () => ipcRenderer.invoke(DESKTOP_CHANNELS.updatesDownload) as Promise<DesktopUpdateState>,
    install: () => ipcRenderer.invoke(DESKTOP_CHANNELS.updatesInstall) as Promise<void>,
    onState: (listener: (state: DesktopUpdateState) => void) => {
      const receive = (_event: Electron.IpcRendererEvent, state: DesktopUpdateState): void => { listener(state) }
      ipcRenderer.on(DESKTOP_CHANNELS.updatesState, receive)
      return () => { ipcRenderer.off(DESKTOP_CHANNELS.updatesState, receive) }
    },
  }),
})

contextBridge.exposeInMainWorld('dshDesktop', bridge)

