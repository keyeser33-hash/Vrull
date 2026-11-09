import { Capacitor, type PluginListenerHandle, registerPlugin } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { currentI18n, type Language } from '@/i18n'
import type { QueuedReminderAction } from '@/data/reminder-actions'
import type { ReminderLogEntry } from '@/reminders/ignored'
import { type Reminder, REMINDER_IDS, SNOOZE_MINUTES } from '@/reminders/plan'

// Rikujtuesit në telefon (SPEC §13): njoftime lokale në kanalin e tyre. Çdo planifikim i ri heq
// ata të mëparshëm (id 5000–5199) dhe vendos të rinjtë; timer-i i pushimit nuk preket. Emri i
// kanalit ndjek gjuhën e app-it: Android-i e përditëson kur kanali krijohet përsëri me të njëjtën id.
// Që nga 0.21 (V37) i vendos plugin-i native Reminders, me butonat e njoftimit; LocalNotifications
// mbetet për lejen dhe kanalin.

const CHANNEL = 'rikujtuesit'
let channelReady: { lang: Language; ready: Promise<void> } | null = null

function ensureChannel() {
  const { t, lang } = currentI18n()
  if (channelReady?.lang === lang) return channelReady.ready
  const ready = LocalNotifications.createChannel({
    id: CHANNEL,
    name: t('reminders.notify.channel'),
    description: t('reminders.notify.channelText'),
    importance: 3,
    visibility: 1,
  }).catch(() => {
    channelReady = null
  })
  channelReady = { lang, ready }
  return ready
}

export type ReminderPermission = 'granted' | 'denied' | 'prompt' | 'unavailable'

export async function reminderPermission(): Promise<ReminderPermission> {
  if (!Capacitor.isNativePlatform()) return 'unavailable'
  try {
    const { display } = await LocalNotifications.checkPermissions()
    return display === 'granted' ? 'granted' : display === 'denied' ? 'denied' : 'prompt'
  } catch {
    return 'unavailable'
  }
}

export async function requestReminderPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false
  try {
    return (await LocalNotifications.requestPermissions()).display === 'granted'
  } catch {
    return false
  }
}

/** Plugin-i native i rikujtuesve të zgjuar (RemindersPlugin.java, V2-E2-08). */
interface RemindersPlugin {
  /** `snoozeMinutes`: sa e shtyn "Shty"; telefoni e ruan me listën. */
  schedule(options: { reminders: NativeReminder[]; channel: { name: string; description: string }; cancelKeys: string[]; snoozeMinutes: number }): Promise<void>
  pending(): Promise<{ actions: QueuedReminderAction[] }>
  ack(options: { ids: string[] }): Promise<void>
  log(): Promise<{ entries: ReminderLogEntry[] }>
  /** Çelësi i njoftimit të prekur që hap një faqe ("week|2026-11-16|"), një herë. */
  consumeOpen(): Promise<{ key: string | null }>
  addListener(event: 'action' | 'open', listener: () => void): Promise<PluginListenerHandle>
}

interface NativeReminder {
  id: number
  at: number
  title: string
  body: string
  kind: Reminder['kind']
  key: string
  data: Reminder['data'] | null
  actions: NonNullable<Reminder['actions']>
  done: NonNullable<Reminder['done']>
  undo: string
}

const Reminders = registerPlugin<RemindersPlugin>('Reminders')

/**
 * Planifikon rikujtuesit: plugin-i native i vendos me alarmet e veta dhe heq listën e mëparshme; njoftimet
 * e `cancelKeys` (të regjistruara ndërkohë) hiqen nga paneli. Rikujtuesit e vjetër të LocalNotifications
 * (0.20, të njëjtat id) hiqen që të mos vijnë dy herë.
 */
export async function scheduleReminders(reminders: Reminder[], cancelKeys: string[] = []) {
  if ((await reminderPermission()) !== 'granted') return
  await ensureChannel()
  const { notifications } = await LocalNotifications.getPending()
  const old = notifications.filter((item) => item.id >= REMINDER_IDS.first && item.id <= REMINDER_IDS.last)
  if (old.length > 0) await LocalNotifications.cancel({ notifications: old.map((item) => ({ id: item.id })) })
  const { t } = currentI18n()
  await Reminders.schedule({
    reminders: reminders.map((item) => ({
      id: item.id,
      at: item.at.getTime(),
      title: item.title,
      body: item.body,
      kind: item.kind,
      key: item.key ?? `${item.kind}|${item.id}`,
      data: item.data ?? null,
      actions: item.actions ?? [],
      done: item.done ?? {},
      undo: t('reminders.notify.undo'),
    })),
    channel: { name: t('reminders.notify.channel'), description: t('reminders.notify.channelText') },
    cancelKeys,
    snoozeMinutes: SNOOZE_MINUTES,
  })
}

/** Radha e prekjeve dhe ditari i njoftimeve të shfaqura, nga telefoni. */
export const nativeReminderQueue = {
  pending: async () => (await Reminders.pending()).actions,
  ack: (ids: string[]) => Reminders.ack({ ids }),
  log: async () => (await Reminders.log()).entries,
  listen(listener: () => void) {
    const handle = Reminders.addListener('action', listener)
    return () => void handle.then((value) => value.remove())
  },
}

/** Prekja e "Java jote është gati" (V43): çelësi i njoftimit, që app-i hap përmbledhjen. */
export const reminderOpen = {
  consume: async () => (await Reminders.consumeOpen()).key,
  listen(listener: () => void) {
    const handle = Reminders.addListener('open', listener)
    return () => void handle.then((value) => value.remove()).catch(() => undefined)
  },
}
