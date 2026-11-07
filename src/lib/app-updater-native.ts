import { registerPlugin, type PluginListenerHandle } from '@capacitor/core'
import type { InstallStatus } from '@/update/updater'

// Plugin-i lokal i app-it: android/app/src/main/java/al/traininghub/app/AppUpdaterPlugin.java.
interface AppUpdaterPlugin {
  canInstall(): Promise<{ value: boolean }>
  openInstallSettings(): Promise<void>
  download(options: { url: string; sha256: string }): Promise<{ path: string }>
  install(options: { path: string; sha256: string }): Promise<void>
  addListener(event: 'downloadProgress', listener: (progress: { bytes: number; total: number }) => void): Promise<PluginListenerHandle>
  addListener(event: 'installStatus', listener: (status: InstallStatus) => void): Promise<PluginListenerHandle>
}

const AppUpdater = registerPlugin<AppUpdaterPlugin>('AppUpdater')

export const nativeUpdater = {
  canInstall: async () => (await AppUpdater.canInstall()).value,
  openInstallSettings: () => AppUpdater.openInstallSettings(),
  async download(url: string, sha256: string, onProgress: (fraction: number) => void) {
    const listener = await AppUpdater.addListener('downloadProgress', ({ bytes, total }) => {
      if (total > 0) onProgress(Math.min(1, bytes / total))
    })
    try {
      const { path } = await AppUpdater.download({ url, sha256 })
      onProgress(1)
      return path
    } finally {
      await listener.remove()
    }
  },
  install: (path: string, sha256: string) => AppUpdater.install({ path, sha256 }),
  onInstallStatus: (listener: (status: InstallStatus) => void) => AppUpdater.addListener('installStatus', listener),
}
