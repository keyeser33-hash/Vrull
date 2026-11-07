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
import { planReminders } from '@/reminders/plan'
import { scheduleReminders } from '@/lib/reminders-native'
import { reminderInput } from './reminders'
import { addPhoto, type Pose, photoData, type PhotoRef, type PhotoRemote, photoTimeline, removePhoto, uploadPendingPhotos } from './photos'
import { ensureSupplements } from './supplements'
import { usdaFromJson } from '@/nutrition/usda'
import type { ExternalFood } from '@/nutrition/off'
import { upgradeShortcutToSize } from './training'
import { type CachedCheck, createUpdater, type UpdateState } from '@/update/updater'
import { watchUpdates } from '@/update/watch'
import { safeStorage } from '@/lib/safe-storage'
import { createReleaseRemote } from './releases'
import { nativeUpdater } from '@/lib/app-updater-native'

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
/** Bucket-i privat i fotove (SPEC §8): çdo përdorues vetëm te dosja e tij. */
export const photoRemote: PhotoRemote = {
  async upload(path, data, type) {
    const { error } = await supabase.storage.from('progress-photos').upload(path, new Blob([data], { type }), { contentType: type, upsert: true })
    if (error) throw error
  },
  async download(path) {
    const { data, error } = await supabase.storage.from('progress-photos').download(path)
    if (error || !data) throw error ?? new Error('Foto nuk u shkarkua')
    return data.arrayBuffer()
  },
}

/** Ushqimet e përgjithshme nga USDA, përmes funksionit `usda-search` (vetëm me sesion). */
export async function searchUsda(query: string): Promise<ExternalFood[]> {
  const { data, error } = await supabase.functions.invoke('usda-search', { body: { query } })
  if (error) throw error
  return usdaFromJson((data ?? {}) as Record<string, unknown>)
}

/** Fotot e progresit për ekranet: përmes store-it dhe bucket-it, pa thirrje direkte te Supabase. */
export const photos = {
  timeline: () => photoTimeline(store, db),
  add: (input: { date: string; pose: Pose; data: ArrayBuffer; width: number; height: number }) => addPhoto(store, db, input),
  remove: (id: string) => removePhoto(store, db, id),
  data: (photo: Pick<PhotoRef, 'id' | 'storagePath'>) => photoData(db, photoRemote, photo),
}

/** Ngarkon fotot që presin: kur hapet app-i, kur kthehet interneti dhe kur shtohet një foto. */
export function usePhotoUploader(ready: boolean) {
  const { userId } = useAuth()
  useEffect(() => {
    if (!ready || !userId) return
    let running = false
    const upload = () => {
      if (running || !navigator.onLine) return
      running = true
      void uploadPendingPhotos(db, photoRemote)
        .catch(() => 0)
        .finally(() => {
          running = false
        })
    }
    upload()
    const stop = store.subscribe((table) => {
      if (table === 'progress_photos') upload()
    })
    window.addEventListener('online', upload)
    const resume = App.addListener('resume', upload)
    return () => {
      stop()
      window.removeEventListener('online', upload)
      void resume.then((handle) => handle.remove())
    }
  }, [ready, userId])
}

/** Rikujtuesit e 7 ditëve të ardhshme, të planifikuar përsëri në telefon (SPEC §13). */
export async function planRemindersNow() {
  if (!Capacitor.isNativePlatform()) return
  await scheduleReminders(planReminders(await reminderInput(store, new Date())))
}

const REMINDER_TABLES = new Set(['user_settings', 'program_state', 'workout_sessions', 'supplements', 'nutrition_targets'])

/** Rinovon rikujtuesit kur hapet app-i dhe kur ndryshojnë oraret, stërvitja e radhës ose suplementet. */
export function useReminderPlanner(ready: boolean) {
  const { userId } = useAuth()
  useEffect(() => {
    if (!ready || !userId || !Capacitor.isNativePlatform()) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const plan = () => {
      clearTimeout(timer)
      timer = setTimeout(() => void planRemindersNow().catch(() => {}), 1500)
    }
    plan()
    const stop = store.subscribe((table) => {
      if (REMINDER_TABLES.has(table)) plan()
    })
    const resume = App.addListener('resume', plan)
    return () => {
      clearTimeout(timer)
      stop()
      void resume.then((handle) => handle.remove())
    }
  }, [ready, userId])
}

export function useDataUpgrades(ready: boolean) {
  const { userId } = useAuth()
  useEffect(() => {
    if (!ready || !userId) return
    void upgradeShortcutToSize(store).catch(() => {})
    void ensureSupplements(store).catch(() => {})
  }, [ready, userId])
}

// Përditësimi brenda app-it (SPEC §3b, TH-23): latest.json dhe APK-ja te bucket-i privat
// app-releases, që i ngarkon GitHub Actions. Vetëm në telefon; në shfletues mbetet "idle".
const UPDATE_CACHE = 'th-update'
const releases = createReleaseRemote(supabase.storage.from('app-releases'))

export const updater = createUpdater({
  currentVersion: __APP_VERSION__,
  online: () => navigator.onLine,
  latest: releases.latest,
  downloadUrl: releases.downloadUrl,
  canInstall: nativeUpdater.canInstall,
  openInstallSettings: nativeUpdater.openInstallSettings,
  download: nativeUpdater.download,
  install: nativeUpdater.install,
  now: () => Date.now(),
  cache: {
    get() {
      try {
        const value = JSON.parse(safeStorage.getItem(UPDATE_CACHE) ?? 'null') as CachedCheck | null
        return value && typeof value.at === 'number' ? value : null
      } catch {
        return null
      }
    },
    set: (value) => safeStorage.setItem(UPDATE_CACHE, JSON.stringify(value)),
  },
})

/** Përditësimi brenda app-it vlen vetëm në telefon (APK). */
export const updatesSupported = () => Capacitor.isNativePlatform()

export function useAppUpdate(): UpdateState {
  return useSyncExternalStore(updater.subscribe, updater.getState)
}

/** Kontrollon për version të ri kur hapet app-i, kur kthehet në plan të parë dhe kur kthehet interneti. */
export function useUpdateChecker(ready: boolean) {
  const { userId } = useAuth()
  useEffect(() => {
    if (!ready || !userId || !Capacitor.isNativePlatform()) return
    const later = (handle: Promise<{ remove(): Promise<void> }>) => () => void handle.then((value) => value.remove())
    return watchUpdates(updater, {
      onResume: (listener) => later(App.addListener('resume', listener)),
      onOnline(listener) {
        window.addEventListener('online', listener)
        return () => window.removeEventListener('online', listener)
      },
      onInstallStatus: (listener) => later(nativeUpdater.onInstallStatus(listener)),
    })
  }, [ready, userId])
}
