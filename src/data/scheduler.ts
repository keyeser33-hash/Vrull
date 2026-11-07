import type { SyncResult } from './sync'

// Kur sinkronizohet: në nisje, kur kthehet rrjeti, kur app-i vjen në plan të parë, 2 s pas
// shkrimit të fundit (që një seri setesh të shkojë si një kërkesë) dhe çdo 5 minuta.
// Pa internet nuk thërret serverin: gjendja thotë "offline" dhe të dhënat presin në telefon.

export interface SyncStatus {
  syncing: boolean
  last?: SyncResult
}

export interface SchedulerOptions {
  sync: { run(): Promise<SyncResult> }
  /** Regjistron një dëgjues për shkrimet lokale; kthen funksionin që e heq. */
  onLocalWrite: (listener: () => void) => () => void
  isOnline?: () => boolean
  /** Burimi i ngjarjeve "online" dhe "resume". */
  events: EventTarget
  now?: () => Date
  debounceMs?: number
  intervalMs?: number
  initial?: SyncResult
}

export function createSyncScheduler(options: SchedulerOptions) {
  const isOnline = options.isOnline ?? (() => navigator.onLine)
  const now = options.now ?? (() => new Date())
  const debounceMs = options.debounceMs ?? 2000
  const intervalMs = options.intervalMs ?? 5 * 60_000
  const listeners = new Set<() => void>()
  let status: SyncStatus = { syncing: false, last: options.initial }
  let debounce: ReturnType<typeof setTimeout> | undefined
  let interval: ReturnType<typeof setInterval> | undefined
  let stopWrites: (() => void) | undefined
  let running = false

  function setStatus(next: SyncStatus) {
    status = next
    listeners.forEach((listener) => listener())
  }

  async function syncNow(): Promise<SyncResult> {
    if (!isOnline()) {
      const last: SyncResult = { status: 'offline', at: now().toISOString(), pushed: 0, pulled: 0, rejected: 0 }
      setStatus({ syncing: false, last })
      return last
    }
    setStatus({ ...status, syncing: true })
    try {
      const last = await options.sync.run()
      setStatus({ syncing: false, last })
      return last
    } catch (error) {
      const last: SyncResult = {
        status: 'error',
        at: now().toISOString(),
        pushed: 0,
        pulled: 0,
        rejected: 0,
        error: error instanceof Error ? error.message : String(error),
      }
      setStatus({ syncing: false, last })
      return last
    }
  }

  const trigger = () => {
    if (running) void syncNow()
  }

  const onWrite = () => {
    clearTimeout(debounce)
    debounce = setTimeout(trigger, debounceMs)
  }

  return {
    start() {
      if (running) return
      running = true
      options.events.addEventListener('online', trigger)
      options.events.addEventListener('resume', trigger)
      stopWrites = options.onLocalWrite(onWrite)
      interval = setInterval(trigger, intervalMs)
      setTimeout(trigger, 0)
    },
    stop() {
      running = false
      options.events.removeEventListener('online', trigger)
      options.events.removeEventListener('resume', trigger)
      stopWrites?.()
      clearTimeout(debounce)
      clearInterval(interval)
    },
    syncNow,
    /** Gjendja e ruajtur nga hapja e kaluar, derisa të vijë sinkronizimi i parë. */
    restore(last: SyncResult | undefined) {
      if (last && !status.last) setStatus({ ...status, last })
    },
    getStatus: () => status,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

export type SyncScheduler = ReturnType<typeof createSyncScheduler>
