import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { reminderRoute } from '@/reminders/plan'
import { reminderOpen } from './reminders-native'

// Prekja e njoftimit "Java jote është gati" (V43, SPEC §0.3c): app-i hap përmbledhjen e asaj jave, në
// nisje (app-i i mbyllur), kur njoftimi vjen me app-in të hapur dhe kur kthehet në plan të parë.
// Plugin-i e mban çelësin deri sa JS-i ta marrë një herë (RemindersPlugin.consumeOpen). Vetëm në telefon.

export function useReminderOpen(ready: boolean) {
  const navigate = useNavigate()
  useEffect(() => {
    if (!ready || !Capacitor.isNativePlatform()) return
    const open = async () => {
      const route = reminderRoute(await reminderOpen.consume())
      if (route) navigate(route)
    }
    const stop = reminderOpen.listen(() => void open().catch(() => undefined))
    void open().catch(() => undefined)
    const resume = App.addListener('resume', () => void open().catch(() => undefined))
    return () => {
      stop()
      void resume.then((handle) => handle.remove())
    }
  }, [ready, navigate])
}
