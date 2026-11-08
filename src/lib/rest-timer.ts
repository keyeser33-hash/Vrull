// Timer-i i pushimit (SPEC §6, TH-09). Mban vetëm kohën kur mbaron pushimi, që të mbijetojë
// minimizimin dhe rihapjen e app-it; alarmi (njoftimi native) planifikohet për të njëjtën kohë.

import { safeStorage } from './safe-storage'

export interface RestState {
  endsAt: number
  totalSeconds: number
}

export interface RestAlarm {
  schedule(at: Date, body: string): void
  cancel(): void
}

export interface RestTimer {
  get(): RestState | null
  start(seconds: number, body: string): void
  /** Pushimi që nisi njoftimi i seancës (V2-E1-08): i njëjti fund dhe total; një pushim i mbaruar nuk rifillon. */
  adopt(endsAt: number, totalSeconds: number, body: string): void
  add(seconds: number): void
  skip(): void
  /** Koha mbaroi: pastron gjendjen; njoftimi i planifikuar vjen gjithsesi. */
  finish(): void
  subscribe(listener: () => void): () => void
}

/** Sekondat që mbeten, të rrumbullakosura lart (1:29,5 shfaqet 1:30). */
export function remainingSeconds(state: RestState | null, now: number): number {
  return state ? Math.max(0, Math.ceil((state.endsAt - now) / 1000)) : 0
}

export function createRestTimer(options: {
  key: string
  now?: () => number
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
  alarm?: RestAlarm
}): RestTimer {
  const now = options.now ?? (() => Date.now())
  const storage = options.storage ?? safeStorage
  const listeners = new Set<() => void>()
  let body = ''
  let state: RestState | null = read()

  function read(): RestState | null {
    try {
      const value = JSON.parse(storage.getItem(options.key) ?? 'null') as (RestState & { body?: string }) | null
      if (!value || typeof value.endsAt !== 'number') return null
      body = value.body ?? ''
      return { endsAt: value.endsAt, totalSeconds: value.totalSeconds }
    } catch {
      return null
    }
  }

  function write(next: RestState | null) {
    state = next
    if (next) storage.setItem(options.key, JSON.stringify({ ...next, body }))
    else storage.removeItem(options.key)
    listeners.forEach((listener) => listener())
  }

  return {
    get: () => state,
    start(seconds, text) {
      body = text
      write({ endsAt: now() + seconds * 1000, totalSeconds: seconds })
      options.alarm?.schedule(new Date(state!.endsAt), body)
    },
    adopt(endsAt, totalSeconds, text) {
      if (endsAt <= now()) return
      body = text
      write({ endsAt, totalSeconds })
      options.alarm?.schedule(new Date(endsAt), body)
    },
    add(seconds) {
      if (!state) return
      const endsAt = Math.max(now(), state.endsAt + seconds * 1000)
      write({ endsAt, totalSeconds: Math.max(1, state.totalSeconds + seconds) })
      options.alarm?.schedule(new Date(endsAt), body)
    },
    skip() {
      options.alarm?.cancel()
      write(null)
    },
    finish() {
      write(null)
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
