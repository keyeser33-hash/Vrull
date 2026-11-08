import { Capacitor, registerPlugin } from '@capacitor/core'
import { Haptics } from '@capacitor/haptics'
import { LocalNotifications } from '@capacitor/local-notifications'
import { currentI18n } from '@/i18n'
import type { RestAlarm } from './rest-timer'

// Njoftimi native i timer-it të pushimit (SPEC §6, TH-09): alarm i saktë që bie me zë dhe dridhje
// edhe me ekran të kyçur. Një njoftim i vetëm me id fikse: çdo pushim i ri e zëvendëson.

const CHANNEL = 'pushimi'
const REST_ID = 4201
let channelReady: Promise<void> | null = null

function ensureChannel() {
  const { t } = currentI18n()
  channelReady ??= LocalNotifications.createChannel({
    id: CHANNEL,
    name: t('settings.restTimer'),
    description: t('session.notify.channelText'),
    // IMPORTANCE_HIGH: del sipër ekranit, me zë dhe dridhje.
    importance: 4,
    visibility: 1,
    vibration: true,
  }).catch(() => {
    channelReady = null
  })
  return channelReady
}

export const nativeRestAlarm: RestAlarm = {
  schedule(at, body) {
    void (async () => {
      await ensureChannel()
      await LocalNotifications.cancel({ notifications: [{ id: REST_ID }] })
      await LocalNotifications.schedule({
        notifications: [
          {
            id: REST_ID,
            title: currentI18n().t('session.notify.title'),
            body,
            channelId: CHANNEL,
            smallIcon: 'ic_stat_pushimi',
            autoCancel: true,
            schedule: { at, allowWhileIdle: true },
          },
        ],
      })
    })().catch(() => {})
  },
  cancel() {
    void LocalNotifications.cancel({ notifications: [{ id: REST_ID }] }).catch(() => {})
  },
}

/** Lejet e timer-it, të kërkuara në stërvitjen e parë (SPEC §3a): njoftimet, pastaj alarmet e sakta. */
export async function prepareRestNotifications() {
  if (!Capacitor.isNativePlatform()) return
  try {
    let { display } = await LocalNotifications.checkPermissions()
    if (display === 'prompt' || display === 'prompt-with-rationale') display = (await LocalNotifications.requestPermissions()).display
    if (display !== 'granted') return
    // Android 12: alarmet e sakta i lejon përdoruesi te cilësimet; nga Android 13 jepen vetë.
    const { exact_alarm } = await LocalNotifications.checkExactNotificationSetting()
    if (exact_alarm !== 'granted') await LocalNotifications.changeExactNotificationSetting()
  } catch {
    // Pa leje timer-i punon brenda app-it; njoftimi thjesht nuk vjen.
  }
}

/** Kur pushimi mbaron me app-in të hapur dhe pa leje njoftimesh: të paktën një dridhje. */
export async function restFinishedInApp() {
  if (!Capacitor.isNativePlatform()) return
  try {
    const { display } = await LocalNotifications.checkPermissions()
    if (display !== 'granted') await Haptics.vibrate({ duration: 600 })
  } catch {
    // Pa dridhje: ekrani e tregon gjithsesi.
  }
}

interface BatteryPlugin {
  isIgnoringOptimizations(): Promise<{ value: boolean }>
  requestIgnoreOptimizations(): Promise<void>
}
const Battery = registerPlugin<BatteryPlugin>('Battery')

/** Nëse timer-i vonon me ekran të kyçur (Samsung, Xiaomi...): përjashtimi nga optimizimi i baterisë. */
export async function batteryUnrestricted(): Promise<boolean | null> {
  if (!Capacitor.isNativePlatform()) return null
  try {
    return (await Battery.isIgnoringOptimizations()).value
  } catch {
    return null
  }
}

export async function requestBatteryExemption() {
  if (Capacitor.isNativePlatform()) await Battery.requestIgnoreOptimizations().catch(() => {})
}
