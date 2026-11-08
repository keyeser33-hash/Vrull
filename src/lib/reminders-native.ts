import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { currentI18n, type Language } from '@/i18n'
import { type Reminder, REMINDER_IDS } from '@/reminders/plan'

// Rikujtuesit në telefon (SPEC §13): njoftime lokale në kanalin e tyre. Çdo planifikim i ri heq
// ata të mëparshëm (id 5000–5199) dhe vendos të rinjtë; timer-i i pushimit nuk preket. Emri i
// kanalit ndjek gjuhën e app-it: Android-i e përditëson kur kanali krijohet përsëri me të njëjtën id.

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

export async function scheduleReminders(reminders: Reminder[]) {
  if ((await reminderPermission()) !== 'granted') return
  await ensureChannel()
  const { notifications } = await LocalNotifications.getPending()
  const old = notifications.filter((item) => item.id >= REMINDER_IDS.first && item.id <= REMINDER_IDS.last)
  if (old.length > 0) await LocalNotifications.cancel({ notifications: old.map((item) => ({ id: item.id })) })
  if (reminders.length === 0) return
  await LocalNotifications.schedule({
    notifications: reminders.map((item) => ({
      id: item.id,
      title: item.title,
      body: item.body,
      channelId: CHANNEL,
      smallIcon: 'ic_stat_pushimi',
      autoCancel: true,
      schedule: { at: item.at, allowWhileIdle: true },
    })),
  })
}
