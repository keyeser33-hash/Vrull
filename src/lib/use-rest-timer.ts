import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { currentI18n } from '@/i18n'
import { createRestTimer, type RestAlarm, remainingSeconds } from './rest-timer'

// Timer-i i pushimit për një seancë, me orën që rifreskohet sa kohë numëron.

let alarm: RestAlarm | undefined
/** Njoftimi native (TH-09) regjistrohet këtu në nisje; në shfletues mbetet pa alarm. */
export function setRestAlarm(next: RestAlarm | undefined) {
  alarm = next
}

export function useRestTimer(sessionId: string, onFinished?: () => void) {
  const timer = useMemo(() => createRestTimer({ key: `th:rest:${sessionId}`, alarm: proxyAlarm }), [sessionId])
  const state = useSyncExternalStore(timer.subscribe, timer.get)
  const [now, setNow] = useState(() => Date.now())
  const remaining = remainingSeconds(state, now)

  useEffect(() => {
    if (!state) return
    setNow(Date.now())
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [state])

  useEffect(() => {
    if (state && remaining === 0) {
      timer.finish()
      onFinished?.()
    }
    // onFinished ndryshon në çdo render; mjafton momenti kur mbaron koha.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, remaining, timer])

  return {
    running: Boolean(state) && remaining > 0,
    remaining,
    total: state?.totalSeconds ?? 0,
    // Teksti i njoftimit në gjuhën e app-it në momentin kur nis pushimi.
    start: (seconds: number) => timer.start(seconds, currentI18n().t('session.notify.body')),
    add: (seconds: number) => timer.add(seconds),
    skip: () => timer.skip(),
  }
}

// Alarmi lexohet në momentin e thirrjes, që regjistrimi pas nisjes të vlejë edhe për timer-ët ekzistues.
const proxyAlarm: RestAlarm = {
  schedule: (at, body) => alarm?.schedule(at, body),
  cancel: () => alarm?.cancel(),
}
