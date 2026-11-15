import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { type DependencyList, useEffect, useState, useSyncExternalStore } from 'react'
import { createAuth } from './auth'
import { createDatabase } from './db'
import { decidePhase } from './phase'
import { createSupabaseRemote } from './remote-supabase'
import { createSyncScheduler } from './scheduler'
import { createLocalStore, DEVICE_TABLE } from './store'
import { supabase } from './supabase'
import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js'
// Pjesët e AI-së ngarkohen kur përdoren (F6): analizuesit e përgjigjeve nuk i duhen nisjes së app-it.
import type { ImportRemote } from './pdf-import'
import type { LabelRemote } from './supplement-label'
import type { BoxRemote } from './ai-box'
import { type AdminRemote, adminResultFrom } from './ai-admin'
import { createSync } from './sync'
import { PENDING, REJECTED, TABLES } from './tables'
import { currentI18n, language } from '@/i18n'
import { planReminders, staleKeys } from '@/reminders/plan'
import { nativeReminderQueue, scheduleReminders } from '@/lib/reminders-native'
import { localDate } from '@/lib/calendar'
import { muteIgnored, reminderInput } from './reminders'
import { appliedLog, applyReminderActions } from './reminder-actions'
import { adoptSavedLanguage } from './language'
import { adoptSavedBackground } from './background'
import { addPhoto, type Pose, photoData, type PhotoRef, type PhotoRemote, photoTimeline, removePhoto, uploadPendingPhotos } from './photos'
import { addFormVideo, type FormVideoRef, formVideoData, type NewFormVideo, removeFormVideo, syncFormVideoFiles, type VideoRemote } from './form-videos'
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
  // Vlerat vetëm të telefonit (`writeDevice`) nuk kanë çfarë të dërgojnë.
  onLocalWrite: (listener) =>
    store.subscribe((table) => {
      if (table !== DEVICE_TABLE) listener()
    }),
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

/**
 * Leximi i PDF-së së një programi me AI, përmes funksionit `program-import` (V2-E1-11; vetëm me sesion).
 * Kostoja ruhet në server; sinkronizimi e sjell te Cilësimet › AI menjëherë pas leximit.
 */
export const programImportRemote: ImportRemote = {
  async read({ file, fileName, known, language }) {
    const { readResultFrom } = await import('./pdf-import')
    if (!navigator.onLine) return readResultFrom(null, null)
    const form = new FormData()
    form.append('file', file, fileName)
    form.append('known', JSON.stringify(known))
    form.append('language', language)
    const { data, error } = await supabase.functions.invoke('program-import', { body: form })
    let result
    if (!error) {
      result = readResultFrom(200, data)
    } else if (error instanceof FunctionsHttpError) {
      const response = error.context as Response
      result = readResultFrom(response.status, await response.json().catch(() => null))
    } else {
      // Pa lidhje (FunctionsFetchError) ose relay-i i Supabase-it pa përgjigje.
      result = readResultFrom(error instanceof FunctionsFetchError ? null : 502, null)
    }
    if (result.ok || result.costEur !== undefined) void scheduler.syncNow()
    return result
  },
}

/**
 * Leximi i etiketës së një suplementi me AI, përmes funksionit `supplement-label` (V39; vetëm me sesion).
 * Fotoja nuk ruhet; kostoja ruhet në server dhe vjen me sinkronizimin.
 */
export const supplementLabelRemote: LabelRemote = {
  async read(image) {
    const { labelResultFrom } = await import('./supplement-label')
    if (!navigator.onLine) return labelResultFrom(null, null)
    const form = new FormData()
    form.append('file', image, 'etiketa.jpg')
    const { data, error } = await supabase.functions.invoke('supplement-label', { body: form })
    let result
    if (!error) result = labelResultFrom(200, data)
    else if (error instanceof FunctionsHttpError) {
      const response = error.context as Response
      result = labelResultFrom(response.status, await response.json().catch(() => null))
    } else result = labelResultFrom(error instanceof FunctionsFetchError ? null : 502, null)
    if (result.ok || result.costEur !== undefined) void scheduler.syncNow()
    return result
  },
}

/**
 * Kutia e AI-së (V40), përmes funksionit `log-parse` (vetëm me sesion): kthen draftin; asgjë nuk regjistrohet
 * para konfirmimit. Kostoja ruhet në server dhe vjen me sinkronizimin.
 */
export const boxRemote: BoxRemote = {
  async parse(request) {
    const { boxResultFrom } = await import('./ai-box')
    if (!navigator.onLine) return boxResultFrom(null, null)
    const { data, error } = await supabase.functions.invoke('log-parse', { body: request })
    let result
    if (!error) result = boxResultFrom(200, data)
    else if (error instanceof FunctionsHttpError) {
      const response = error.context as Response
      result = boxResultFrom(response.status, await response.json().catch(() => null))
    } else result = boxResultFrom(error instanceof FunctionsFetchError ? null : 502, null)
    if (result.ok || result.error === 'unreadable') void scheduler.syncNow()
    return result
  },
}

/** Kufiri i AI-së te Admini (V42), përmes funksionit `ai-admin`: vetëm me internet dhe vetëm për adminin. */
async function invokeAdmin(body: Record<string, unknown>) {
  if (!navigator.onLine) return adminResultFrom(null, null)
  const { data, error } = await supabase.functions.invoke('ai-admin', { body })
  if (!error) return adminResultFrom(200, data)
  if (error instanceof FunctionsHttpError) return adminResultFrom((error.context as Response).status, null)
  return adminResultFrom(error instanceof FunctionsFetchError ? null : 502, null)
}

export const aiAdminRemote: AdminRemote = {
  list: () => invokeAdmin({ action: 'list' }),
  async setLimit(userId, limitEur) {
    const result = await invokeAdmin({ action: 'set', userId, limitEur })
    // Kufiri i ri i vetë adminit vjen te telefoni me sinkronizimin (ai_limits).
    if (result.ok) void scheduler.syncNow()
    return result
  },
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

/** Bucket-i privat i videove të formës (V2-E1-13, V27): çdo përdorues vetëm te dosja e tij. */
export const videoRemote: VideoRemote = {
  async upload(path, data, type) {
    const { error } = await supabase.storage.from('form-videos').upload(path, new Blob([data], { type }), { contentType: type, upsert: true })
    if (error) throw error
  },
  async download(path) {
    const { data, error } = await supabase.storage.from('form-videos').download(path)
    if (error || !data) throw error ?? new Error('Videoja nuk u shkarkua')
    return data.arrayBuffer()
  },
  async remove(path) {
    const { error } = await supabase.storage.from('form-videos').remove([path])
    if (error) throw error
  },
}

/** Videot e formës për ekranet: përmes store-it dhe bucket-it, pa thirrje direkte te Supabase. */
export const formVideos = {
  add: (input: NewFormVideo) => addFormVideo(store, db, input),
  remove: (id: string) => removeFormVideo(store, db, id),
  data: (video: Pick<FormVideoRef, 'id' | 'storagePath' | 'type'>) => formVideoData(db, videoRemote, video),
}

/**
 * Ngarkon videot që presin dhe heq nga bucket-i ato të fshira: kur hapet app-i, kur kthehet interneti
 * dhe kur ndryshon një video (edhe pas sinkronizimit, kur një fshirje vjen nga telefoni tjetër).
 */
export function useFormVideoUploader(ready: boolean) {
  const { userId } = useAuth()
  useEffect(() => {
    if (!ready || !userId) return
    let running = false
    let again = false
    const run = () => {
      if (!navigator.onLine) return
      if (running) {
        again = true
        return
      }
      running = true
      void syncFormVideoFiles(db, videoRemote)
        .catch(() => undefined)
        .finally(() => {
          running = false
          if (again) {
            again = false
            run()
          }
        })
    }
    run()
    const stopStore = store.subscribe((table) => {
      if (table === 'form_videos') run()
    })
    const stopSync = scheduler.subscribe(() => {
      if (!scheduler.getStatus().syncing) run()
    })
    window.addEventListener('online', run)
    const resume = App.addListener('resume', run)
    return () => {
      stopStore()
      stopSync()
      window.removeEventListener('online', run)
      void resume.then((handle) => handle.remove())
    }
  }, [ready, userId])
}

/** Çfarë krijoi çdo prekje te rikujtuesit, për "Kthe mbrapsht" dhe që asnjë të mos zbatohet dy herë. */
const appliedReminderActions = appliedLog(safeStorage)

/** Prekjet te rikujtuesit (V37) që telefoni ruajti: zbatohen një herë, pastaj hiqen nga radha native. */
export async function applyReminderQueue() {
  if (!Capacitor.isNativePlatform()) return
  const actions = await nativeReminderQueue.pending()
  if (actions.length === 0) return
  await nativeReminderQueue.ack(await applyReminderActions(store, actions, appliedReminderActions))
}

/**
 * Rikujtuesit e 7 ditëve të ardhshme, të planifikuar përsëri në telefon (SPEC §13): pas prekjeve të
 * fundit dhe pas heshtjes së llojeve të injoruara 3 ditë rresht (V37).
 */
export async function planRemindersNow() {
  if (!Capacitor.isNativePlatform()) return
  const now = new Date()
  await applyReminderQueue().catch(() => {})
  await muteIgnored(store, await nativeReminderQueue.log().catch(() => []), localDate(now)).catch(() => [])
  const input = await reminderInput(store, now)
  // Tekstet në gjuhën e app-it tani; ndërrimi i gjuhës i planifikon përsëri (user_settings).
  const reminders = planReminders(input, currentI18n())
  await scheduleReminders(reminders, input.smart ? staleKeys(input.smart, reminders) : [])
}

// Çdo ndryshim që ndikon te rikujtuesit: oraret, stërvitja, suplementet, lloji i ditës, dhe (V37) çfarë
// u regjistrua, uji, Plani im dhe pesha (objektivi i ujit).
const REMINDER_TABLES = new Set([
  'user_settings',
  'program_state',
  'workout_sessions',
  'supplements',
  'nutrition_targets',
  'diary_entries',
  'supplement_logs',
  'water_logs',
  'meal_templates',
  'body_measurements',
  'daily_states',
])

/**
 * Rinovon rikujtuesit kur hapet app-i, kur ndryshojnë oraret, stërvitja e radhës ose suplementet, dhe kur
 * ndërrohet gjuha, edhe kur vjen me sinkronizimin nga telefoni tjetër (gjuha e telefonit nuk shkruhet te store).
 */
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
    const stopLanguage = language.subscribe(plan)
    // Rreshtat që sjell sinkronizimi shkojnë drejt te baza, pa kaluar nga `store`: plani rinovohet kur
    // mbaron një sinkronizim (SPEC §13: një regjistrim nga telefoni tjetër anulon rikujtuesin).
    let syncing = scheduler.getStatus().syncing
    const stopSync = scheduler.subscribe(() => {
      const now = scheduler.getStatus().syncing
      if (syncing && !now) plan()
      syncing = now
    })
    const resume = App.addListener('resume', plan)
    // Një prekje te njoftimi kur app-i jeton: zbatohet menjëherë, pastaj plani rinovohet.
    const stopActions = nativeReminderQueue.listen(() => void applyReminderQueue().catch(() => {}))
    return () => {
      clearTimeout(timer)
      stop()
      stopLanguage()
      stopSync()
      stopActions()
      void resume.then((handle) => handle.remove())
    }
  }, [ready, userId])
}

/**
 * Gjuha e ruajtur te cilësimet (SPEC V22): në nisje dhe pas çdo sinkronizimi, që zgjedhja nga
 * një telefon tjetër të vlejë edhe këtu. Zgjedhja te Cilësimet: chooseLanguage (data/language.ts).
 */
export function useLanguageSync(ready: boolean) {
  const { userId } = useAuth()
  useEffect(() => {
    if (!ready || !userId) return
    const adopt = () => void adoptSavedLanguage(store).catch(() => {})
    adopt()
    return scheduler.subscribe(() => {
      if (!scheduler.getStatus().syncing) adopt()
    })
  }, [ready, userId])
}

/**
 * Sfondi i ruajtur te cilësimet (V2-E1-05), si gjuha: në nisje dhe pas çdo sinkronizimi. Zgjedhja
 * te Pamja: chooseBackground (data/background.ts).
 */
export function useBackgroundSync(ready: boolean) {
  const { userId } = useAuth()
  useEffect(() => {
    if (!ready || !userId) return
    const adopt = () => void adoptSavedBackground(store).catch(() => {})
    adopt()
    return scheduler.subscribe(() => {
      if (!scheduler.getStatus().syncing) adopt()
    })
  }, [ready, userId])
}

export function useDataUpgrades(ready: boolean) {
  const { userId } = useAuth()
  useEffect(() => {
    if (!ready || !userId) return
    void upgradeShortcutToSize(store).catch(() => {})
    void ensureSupplements(store).catch(() => {})
    // Arritjet (V43): ato që u plotësuan pa u dhënë (p.sh. ushqimi i së dielës) jepen në hapje. Para marrjes
    // së parë të tabelës së arritjeve (telefoni që vjen nga 0.22) dhënia pret: provohet pas çdo
    // sinkronizimi, derisa marrja të ketë ndodhur, pastaj një herë.
    let awarded = false
    const award = () => {
      if (awarded) return
      void store
        .pulled('achievements')
        .then(async (pulled) => {
          if (!pulled || awarded) return
          awarded = true
          const { awardAchievements } = await import('./achievements')
          await awardAchievements(store)
        })
        .catch(() => {})
    }
    award()
    return scheduler.subscribe(() => {
      if (!scheduler.getStatus().syncing) award()
    })
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
