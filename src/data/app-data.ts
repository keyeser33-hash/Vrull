import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { createDatabase } from './db'
import { createSupabaseRemote } from './remote-supabase'
import { createSyncScheduler } from './scheduler'
import { createLocalStore } from './store'
import { supabase } from './supabase'
import { createSync } from './sync'
import { PENDING, REJECTED, TABLES } from './tables'

// Të dhënat e app-it: një bazë lokale, një store për shkrimet, një sinkronizim me Supabase.
// Ekranet lexojnë dhe shkruajnë vetëm përmes `store`; asnjë ekran nuk pret rrjetin.

let userId: string | null = null
const events = new EventTarget()

export const db = createDatabase()
export const store = createLocalStore(db, { userId: () => userId })
export const sync = createSync({ db, remote: createSupabaseRemote(supabase), userId: () => userId })
export const scheduler = createSyncScheduler({
  sync,
  onLocalWrite: (listener) => store.subscribe(() => listener()),
  events,
})

export const currentUserId = () => userId

let started = false

/** Thirret një herë në nisje (main.tsx). Sesioni lexohet nga telefoni, pa rrjet. */
export async function startData() {
  if (started) return
  started = true
  const { data } = await supabase.auth.getSession()
  userId = data.session?.user.id ?? null
  supabase.auth.onAuthStateChange((_event, session) => {
    const next = session?.user.id ?? null
    if (next === userId) return
    userId = next
    if (next) void scheduler.syncNow()
  })
  window.addEventListener('online', () => events.dispatchEvent(new Event('online')))
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') events.dispatchEvent(new Event('resume'))
  })
  if (Capacitor.isNativePlatform()) {
    void App.addListener('resume', () => events.dispatchEvent(new Event('resume')))
  }
  scheduler.restore(await sync.lastResult())
  scheduler.start()
}

export function useSyncStatus() {
  return useSyncExternalStore(scheduler.subscribe, scheduler.getStatus)
}

/** Sa ndryshime presin dërgimin (përfshirë ato që serveri refuzoi). */
export function usePendingChanges() {
  const [count, setCount] = useState(0)
  const status = useSyncStatus()
  useEffect(() => {
    let cancelled = false
    const refresh = async () => {
      let total = 0
      for (const table of TABLES) total += await db[table].where('_dirty').anyOf(PENDING, REJECTED).count()
      if (!cancelled) setCount(total)
    }
    void refresh()
    const stop = store.subscribe(() => void refresh())
    return () => {
      cancelled = true
      stop()
    }
  }, [status])
  return count
}
