import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { scheduler, store } from '@/data/app-data'
import type { TableName } from '@/data/tables'
import { currentI18n, language } from '@/i18n'
import { createSessionNotifier, openState, sessionView } from './session-notification'
import { nativeSessionPort, notificationOpen } from './session-notification-native'
import { restControl } from './use-rest-timer'

// Lidhja e njoftimit të seancës me app-in (V2-E1-08): njoftimi ndjek bazën lokale (setet, seanca,
// peshat e javës, gjuha, sinkronizimi), prekjet e tij zbatohen sapo JS-i i merr vesh dhe në çdo
// nisje ose kthim në plan të parë, dhe "Ndrysho" hap seancën te seti. Vetëm në telefon.

const TRAINING_TABLES = new Set<TableName>([
  'set_logs',
  'workout_sessions',
  'program_state',
  'programs',
  'program_blocks',
  'program_days',
  'program_slots',
  'slot_prescriptions',
  'exercises',
  'week_weights',
  'one_rm_overrides',
  'user_settings',
])

export function useSessionNotification(ready: boolean) {
  // Te ruteri i të dhënave (createBrowserRouter) `navigate` nuk ndryshon mes vizatimeve.
  const navigate = useNavigate()

  useEffect(() => {
    if (!ready || !Capacitor.isNativePlatform()) return
    const notifier = createSessionNotifier({ store, port: nativeSessionPort, rest: restControl, i18n: currentI18n })
    notifier.setView(sessionView.get())
    let timer: ReturnType<typeof setTimeout> | undefined
    // Disa shkrime njëri pas tjetrit (seti, pastaj seanca) japin një njoftim të vetëm.
    const schedule = () => {
      clearTimeout(timer)
      timer = setTimeout(() => void notifier.sync().catch(() => undefined), 300)
    }
    const open = async () => {
      const request = await notificationOpen.consume()
      if (!request) return
      // Te seanca e hapur njoftimi s'shton një hap të ri te historia: "Mbrapa" kthen aty nga erdhi.
      navigate('/seanca', { state: openState(request), replace: window.location.pathname === '/seanca' })
    }

    const stopActions = notifier.start()
    const stopStore = store.subscribe((table) => {
      if (TRAINING_TABLES.has(table)) schedule()
    })
    const stopSync = scheduler.subscribe(() => {
      if (!scheduler.getStatus().syncing) schedule()
    })
    const stopLanguage = language.subscribe(schedule)
    const stopView = sessionView.subscribe(() => {
      notifier.setView(sessionView.get())
      schedule()
    })
    const stopOpen = notificationOpen.listen(() => void open().catch(() => undefined))
    void open().catch(() => undefined)
    const resume = App.addListener('resume', () => {
      void notifier.drain().catch(() => undefined)
      void open().catch(() => undefined)
    })
    return () => {
      clearTimeout(timer)
      stopActions()
      stopStore()
      stopSync()
      stopLanguage()
      stopView()
      stopOpen()
      void resume.then((handle) => handle.remove())
    }
  }, [ready, navigate])
}
