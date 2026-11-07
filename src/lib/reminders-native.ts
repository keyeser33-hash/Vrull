import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { type Reminder, REMINDER_IDS } from '@/reminders/plan'

// Rikujtuesit në telefon (SPEC §13): njoftime lokale në kanalin e tyre. Çdo planifikim i ri heq
// ata të mëparshëm (id 5000–5199) dhe vendos të rinjtë; timer-i i pushimit nuk preket.

const CHANNEL = 'rikujtuesit'
let channelReady: Promise<void> | null = null

function ensureChannel() {
  channelReady ??= LocalNotifications.createChannel({
    id: CHANNEL,
    name: 'Rikujtuesit',
    description: 'Vaktet, suplementet, stërvitja dhe matja javore',
    importance: 3,
    visibility: 1,
  }).catch(() => {
    channelReady = null
  })
  return channelReady
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
