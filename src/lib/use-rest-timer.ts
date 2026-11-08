import { useEffect, useState, useSyncExternalStore } from 'react'
import { currentI18n } from '@/i18n'
import { createRestTimer, type RestAlarm, remainingSeconds, type RestTimer } from './rest-timer'

// Timer-i i pushimit për një seancë, me orën që rifreskohet sa kohë numëron.

let alarm: RestAlarm | undefined
/** Njoftimi native (TH-09) regjistrohet këtu në nisje; në shfletues mbetet pa alarm. */
export function setRestAlarm(next: RestAlarm | undefined) {
  alarm = next
}

// Një timer për seancë, i përbashkët për ekranin e seancës dhe njoftimin e seancës (V2-E1-08): një
// pushim i nisur ose i kapërcyer te njoftimi del menjëherë edhe te ekrani.
const timers = new Map<string, RestTimer>()

export function restTimer(sessionId: string): RestTimer {
  let timer = timers.get(sessionId)
  if (!timer) {
    timer = createRestTimer({ key: `th:rest:${sessionId}`, alarm: proxyAlarm })
    timers.set(sessionId, timer)
  }
  return timer
}

/** Pushimi i një seance për njoftimin e seancës (lib/session-notification.ts). */
export function restControl(sessionId: string) {
  const timer = restTimer(sessionId)
  return {
    adopt: (endsAt: number, totalSeconds: number) => timer.adopt(endsAt, totalSeconds, currentI18n().t('session.notify.body')),
    skip: () => timer.skip(),
  }
}

export function useRestTimer(sessionId: string, onFinished?: () => void) {
  const timer = restTimer(sessionId)
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
