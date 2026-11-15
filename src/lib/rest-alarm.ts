import { Capacitor, registerPlugin } from '@capacitor/core'
import { Haptics } from '@capacitor/haptics'
import { LocalNotifications } from '@capacitor/local-notifications'
import { currentI18n } from '@/i18n'
import type { RestAlarm } from './rest-timer'
import { nativeRest } from './session-notification-native'

// Njoftimi native i timer-it të pushimit (SPEC §6, TH-09): alarm i saktë që bie me zë dhe dridhje
// edhe me ekran të kyçur. Që nga V2-E1-08 e mban plugin-i i njoftimit të seancës
// (SessionNotifier.java), jo LocalNotifications: pushimi që nis "Ruaj setin" te njoftimi, kur
// WebView-i fle ose procesi është vrarë, duhet të bjerë njësoj. Një alarm i vetëm: çdo pushim i ri
// e zëvendëson. Gjatë pushimit, i njëjti alarm tregon njoftimin "Pushimi" me "Kapërce pushimin".

export const nativeRestAlarm: RestAlarm = {
  schedule(at, body) {
    const { t } = currentI18n()
    void nativeRest
      .schedule({
        at: at.getTime(),
        title: t('session.notify.title'),
        body,
        channel: t('settings.restTimer'),
        channelText: t('session.notify.channelText'),
      })
      .catch(() => {})
  },
  cancel() {
    void nativeRest.cancel().catch(() => {})
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

/** A do ta pyeste telefoni tani për njoftimet (vetëm native, leja ende pa u kërkuar)? Fleta e shpjegimit del para kësaj kërkese. */
export async function restNotificationsPrompt(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false
  try {
    const { display } = await LocalNotifications.checkPermissions()
    return display === 'prompt' || display === 'prompt-with-rationale'
  } catch {
    return false
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
