import type { InstallStatus, Updater } from './updater'

// Kur kontrollohet për version të ri (SPEC §3b): në hapje, në rikthim te app-i dhe kur kthehet
// interneti. Burimet e ngjarjeve jepen nga app-data (Capacitor App, window, plugin-i AppUpdater).

type Unsubscribe = () => void

export interface UpdateEvents {
  onResume(listener: () => void): Unsubscribe
  onOnline(listener: () => void): Unsubscribe
  onInstallStatus(listener: (event: InstallStatus) => void): Unsubscribe
}

export function watchUpdates(updater: Pick<Updater, 'check' | 'onInstallStatus'>, events: UpdateEvents): Unsubscribe {
  const check = () => void updater.check()
  check()
  const stops = [events.onResume(check), events.onOnline(check), events.onInstallStatus((event) => updater.onInstallStatus(event))]
  return () => {
    for (const stop of stops) stop()
  }
}
