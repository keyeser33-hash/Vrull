import { registerPlugin, type PluginListenerHandle } from '@capacitor/core'
import type { NotificationAction, NotificationState, OpenRequest, SessionNotificationPort } from './session-notification'

// Plugin-i lokal i njoftimit të seancës (V2-E1-08):
// android/app/src/main/java/al/traininghub/app/SessionNotificationPlugin.java. Native-i mban
// gjendjen, radhën e veprimeve dhe pushimin te SharedPreferences ("vrull_session"), që njoftimi të
// punojë edhe kur WebView-i fle ose procesi është vrarë (SessionNotifier.java).

interface RestOptions {
  /** Fundi i pushimit (ms). */
  at: number
  /** "Pushimi mbaroi" dhe teksti i njoftimit kur mbaron. */
  title: string
  body: string
  /** Kanali "pushimi" (zë dhe dridhje), me emrin dhe përshkrimin në gjuhën e app-it. */
  channel: string
  channelText: string
}

interface SessionNotificationPlugin {
  show(options: { state: NotificationState }): Promise<void>
  hide(): Promise<void>
  pending(): Promise<{ actions: NotificationAction[] }>
  ack(options: { ids: string[] }): Promise<void>
  scheduleRest(options: RestOptions): Promise<void>
  cancelRest(): Promise<void>
  consumeOpen(): Promise<{ request: OpenRequest | null }>
  addListener(event: 'action' | 'open', listener: () => void): Promise<PluginListenerHandle>
}

const SessionNotification = registerPlugin<SessionNotificationPlugin>('SessionNotification')

const listen = (event: 'action' | 'open', listener: () => void) => {
  const handle = SessionNotification.addListener(event, listener)
  return () => void handle.then((value) => value.remove()).catch(() => undefined)
}

export const nativeSessionPort: SessionNotificationPort = {
  show: (state) => SessionNotification.show({ state }),
  hide: () => SessionNotification.hide(),
  pending: async () => (await SessionNotification.pending()).actions,
  ack: (ids) => SessionNotification.ack({ ids }),
  onAction: (listener) => listen('action', listener),
}

/**
 * Alarmi i fundit të pushimit: native, që edhe pushimi i nisur nga njoftimi (pa WebView) të bjerë
 * me zë dhe dridhje me ekran të kyçur (Q11). I njëjti alarm vizaton edhe njoftimin "Pushimi".
 */
export const nativeRest = {
  schedule: (options: RestOptions) => SessionNotification.scheduleRest(options),
  cancel: () => SessionNotification.cancelRest(),
}

/** "Ndrysho" te njoftimi: seti që duhet hapur te seanca, një herë. */
export const notificationOpen = {
  consume: async () => (await SessionNotification.consumeOpen()).request,
  listen: (listener: () => void) => listen('open', listener),
}
