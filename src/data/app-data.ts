import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { type DependencyList, useEffect, useState, useSyncExternalStore } from 'react'
import { createAuth } from './auth'
import { createDatabase } from './db'
import { decidePhase } from './phase'
import { createSupabaseRemote } from './remote-supabase'
import { createSyncScheduler } from './scheduler'
import { createLocalStore } from './store'
import { supabase } from './supabase'
import { createSync } from './sync'
import { PENDING, REJECTED, TABLES } from './tables'
import { upgradeShortcutToSize } from './training'

// Të dhënat e app-it: sesioni, një bazë lokale, një store për shkrimet, një sinkronizim me
// Supabase. Ekranet lexojnë dhe shkruajnë vetëm përmes `store`; asnjë ekran nuk pret rrjetin.

const events = new EventTarget()

export const auth = createAuth(supabase.auth)
const userId = () => auth.getState().userId

export const db = createDatabase()
export const store = createLocalStore(db, { userId })
export const sync = createSync({ db, remote: createSupabaseRemote(supabase), userId })
export const scheduler = createSyncScheduler({
  sync,
  onLocalWrite: (listener) => store.subscribe(() => listener()),
  events,
})

export const currentUserId = userId

let started = false

/** Thirret një herë në nisje (main.tsx). Sesioni lexohet nga telefoni, pa rrjet. */
export async function startData() {
  if (started) return
  started = true
  await auth.start()
  let previous = userId()
  auth.subscribe(() => {
    const next = userId()
    // Pas hyrjes: të dhënat ekzistuese merren menjëherë (faza "fetching").
    if (next && next !== previous) void scheduler.syncNow()
    previous = next
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

export function useAuth() {
  return useSyncExternalStore(auth.subscribe, auth.getState)
}

export function useSyncStatus() {
  return useSyncExternalStore(scheduler.subscribe, scheduler.getStatus)
}

/**
 * Një lexim nga baza lokale që rifreskohet vetë pas çdo shkrimi lokal dhe pas çdo
 * sinkronizimi (kur mund të kenë ardhur rreshta nga serveri). undefined derisa të mbarojë leximi i parë.
 */
export function useLocalQuery<T>(query: () => Promise<T>, deps: DependencyList): T | undefined {
  const [value, setValue] = useState<T | undefined>(undefined)
  useEffect(() => {
    let cancelled = false
    // Leximet mund të mbarojnë jashtë radhës: një lexim që nisi para një tjetri që u shfaq tashmë
    // nuk e kthen ekranin pas. Leximet e reja shfaqen sapo mbarojnë, edhe kur shkrimet vijnë shpejt.
    let started = 0
    let shown = 0
    const run = () => {
      const ticket = ++started
      query().then(
        (result) => {
          if (cancelled || ticket < shown) return
          shown = ticket
          setValue(() => result)
        },
        () => {
          // Një lexim i dështuar lë vlerën e fundit; leximi tjetër e provon përsëri.
        },
      )
    }
    run()
    const stopStore = store.subscribe(run)
    const stopSync = scheduler.subscribe(() => {
      if (!scheduler.getStatus().syncing) run()
    })
    return () => {
      cancelled = true
      stopStore()
      stopSync()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return value
}

/** Ku duhet të jetë app-i tani: hyrja, marrja e të dhënave, hapat e para, apo Sot. */
export function useAppPhase() {
  const session = useAuth()
  const status = useSyncStatus()
  const onboarded = useLocalQuery(
    async () => Boolean((await store.all('user_settings'))[0]?.onboarded_at),
    [session.userId],
  )
  const pulled = useLocalQuery(async () => (await sync.pulledFor()) === session.userId, [session.userId])
  return decidePhase({
    auth: session.status,
    onboarded: session.userId ? onboarded : undefined,
    pulled: session.userId ? pulled : undefined,
    syncing: status.syncing,
    lastStatus: status.last?.status,
  })
}

/** Sa ndryshime presin dërgimin (përfshirë ato që serveri refuzoi). */
export function usePendingChanges() {
  return (
    useLocalQuery(async () => {
      let total = 0
      for (const table of TABLES) total += await db[table].where('_dirty').anyOf(PENDING, REJECTED).count()
      return total
    }, []) ?? 0
  )
}

/**
 * Përditësimet e të dhënave lokale pas një versioni të ri, kur app-i është gati (të dhënat e
 * serverit janë marrë): p.sh. ushtrimet e Shortcut to Size për profilet e versionit 0.2.0.
 */
export function useDataUpgrades(ready: boolean) {
  const { userId } = useAuth()
  useEffect(() => {
    if (ready && userId) void upgradeShortcutToSize(store).catch(() => {})
  }, [ready, userId])
}
