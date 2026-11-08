import { nativeMusicBridge } from './music-native'

// Muzika "Trupi në ritëm" (SPEC V29, V2-E1-12, docs/research/muzika.md): app-i i muzikës së
// përdoruesit (Spotify, YouTube Music ose çdo tjetër) përmes sesioneve të medias së Android-it, me
// lejen "Qasja te njoftimet" (MusicPlugin.java). Vrull nuk luan muzikë dhe nuk lexon asnjë njoftim.
//
// API për seancën dhe për njoftimin e seancës (E1-08):
// - `music.available()`: ka plugin (vetëm app-i në Android); `music.access()`: leja.
// - `music.subscribe(listener)` jep sesionin që luan (`NowPlaying`: titulli, artisti, gjendja,
//   pozicioni, radha) ose null, sa herë ndryshon; dëgjimi native nis me dëgjuesin e parë dhe ndalet me
//   të fundit. `music.current()` jep të fundit pa pritur. `isPlaying(session)`, `musicAppName(session)`.
// - `controlsOf(session)` thotë cilat kontrolle pranon app-i: vetëm ato shfaqen (p.sh. "Kalo këngën"
//   në njoftim vetëm kur `next` është true).
// - `music.control('play' | 'pause' | 'next' | 'previous' | 'seekTo' | 'skipToQueueItem')` dërgon
//   kërkesën; app-i i muzikës vendos. Refuzimi kthehet si vlerë ('unsupported', 'no-session',
//   'no-access'), pa hedhur gabim. Kënga ndërrohet vetëm me prekje.
// - Tempo e këngës: `useSongTempo` (music-hooks.ts) mbi `data/song-tempo.ts`.

export type MusicAction = 'play' | 'pause' | 'next' | 'previous' | 'seekTo' | 'skipToQueueItem'
export type PlaybackStatus = 'playing' | 'paused' | 'buffering' | 'stopped' | 'none' | 'other'

/** Një këngë e radhës, kur app-i e jep radhën. */
export interface QueueEntry {
  id: number
  title: string
  artist: string | null
}

export interface NowPlaying {
  packageName: string
  /** Emri i app-it sipas sistemit; null kur sistemi nuk e jep. */
  appName: string | null
  title: string | null
  artist: string | null
  album: string | null
  durationMs: number | null
  status: PlaybackStatus
  speed: number
  /** Pozicioni në `positionAt` (ms e orës së telefonit); JS-i e vazhdon vetë. */
  positionMs: number
  positionAt: number
  /** Veprimet që shpall sesioni (PlaybackState.getActions()), me emrat e plugin-it. */
  actions: string[]
  /** Këngët pas së tanishmes; null kur app-i nuk e jep radhën. */
  queue: QueueEntry[] | null
  /** Sesioni ka faqen e vet (getSessionActivity): "Hap app-in e muzikës". */
  canOpen: boolean
}

export interface MusicControls {
  playPause: boolean
  previous: boolean
  next: boolean
  seek: boolean
  /** "Luaj tani" për një këngë të radhës: app-i jep radhën dhe pranon skipToQueueItem. */
  queue: boolean
}

export interface MusicAccess {
  granted: boolean
  /** Versioni i Android-it (API); null jashtë telefonit. */
  sdk: number | null
  /** APK e instaluar jashtë një dyqani app-esh: Android 13+ kërkon "Allow restricted settings". */
  sideloaded: boolean
}

export type ControlResult = 'ok' | 'unsupported' | 'no-session' | 'no-access' | 'unavailable' | 'error'

/** unknown: ende pa përgjigje; no-access: pa "Qasjen te njoftimet"; listening: sesionet vijnë. */
export type MusicState = 'unknown' | 'no-access' | 'listening'

/** Ura me plugin-in native; `music-native.ts` e lidh me Capacitor, provat me një të imituar. */
export interface MusicBridge {
  available(): boolean
  getAccess(): Promise<{ granted: boolean; sdk?: number | null; installer?: string | null }>
  openAccessSettings(): Promise<void>
  openAppInfo(): Promise<void>
  getNowPlaying(): Promise<{ session: unknown }>
  control(options: { action: MusicAction; positionMs?: number; queueItemId?: number }): Promise<void>
  openApp(): Promise<void>
  startListening(): Promise<void>
  stopListening(): Promise<void>
  addListener(event: 'nowPlaying', listener: (event: { session: unknown }) => void): Promise<{ remove: () => Promise<void> }>
}

const KNOWN_APPS: Record<string, string> = {
  'com.spotify.music': 'Spotify',
  'com.google.android.apps.youtube.music': 'YouTube Music',
  'com.google.android.youtube': 'YouTube',
  'com.apple.android.music': 'Apple Music',
  'deezer.android.app': 'Deezer',
  'com.aspiro.tidal': 'TIDAL',
  'com.amazon.mp3': 'Amazon Music',
  'com.soundcloud.android': 'SoundCloud',
  'com.sec.android.app.music': 'Samsung Music',
}

/** Dyqanet e app-eve: një APK prej tyre nuk ka "cilësime të kufizuara" (CDD 15 §9.8). */
const STORES = new Set(['com.android.vending', 'com.sec.android.app.samsungapps', 'com.huawei.appmarket', 'com.amazon.venezia', 'org.fdroid.fdroid'])

const STATUSES = new Set<PlaybackStatus>(['playing', 'paused', 'buffering', 'stopped', 'none', 'other'])

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() !== '' ? value : null)
const finite = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null)

/** Sesioni i plugin-it (MusicPlugin.describe) në formën e ekraneve; null kur mungon. */
export function parseSession(raw: unknown): NowPlaying | null {
  if (!raw || typeof raw !== 'object') return null
  const value = raw as Record<string, unknown>
  const packageName = text(value.packageName)
  if (!packageName) return null
  const duration = finite(value.durationMs)
  const speed = finite(value.speed)
  const queue = value.queue && typeof value.queue === 'object' ? (value.queue as Record<string, unknown>) : null
  const length = finite(queue?.length)
  return {
    packageName,
    appName: text(value.appName),
    title: text(value.title),
    artist: text(value.artist),
    album: text(value.album),
    durationMs: duration !== null && duration > 0 ? duration : null,
    status: STATUSES.has(value.state as PlaybackStatus) ? (value.state as PlaybackStatus) : 'other',
    speed: speed !== null && speed > 0 ? speed : 1,
    positionMs: Math.max(0, finite(value.positionMs) ?? 0),
    positionAt: finite(value.positionAt) ?? 0,
    actions: Array.isArray(value.actions) ? value.actions.filter((action): action is string => typeof action === 'string') : [],
    // -1: getQueue() == null, app-i nuk e jep radhën.
    queue:
      length === null || length < 0
        ? null
        : (Array.isArray(queue?.upcoming) ? queue.upcoming : []).flatMap((entry: unknown) => {
            const item = (entry ?? {}) as Record<string, unknown>
            const id = finite(item.id)
            const title = text(item.title)
            return id !== null && title ? [{ id, title, artist: text(item.subtitle) }] : []
          }),
    canOpen: value.canOpen === true,
  }
}

/** Kontrollet që pranon app-i, sipas veprimeve të shpallura. */
export function controlsOf(session: NowPlaying): MusicControls {
  const has = (action: string) => session.actions.includes(action)
  return {
    playPause: has('play') || has('pause') || has('playPause'),
    previous: has('previous'),
    next: has('next'),
    seek: has('seekTo'),
    queue: has('skipToQueueItem') && (session.queue?.length ?? 0) > 0,
  }
}

export const isPlaying = (session: NowPlaying) => session.status === 'playing'

/** "Spotify", "YouTube Music"; null kur as sistemi as lista nuk e njohin. */
export function musicAppName(session: NowPlaying): string | null {
  return session.appName ?? KNOWN_APPS[session.packageName] ?? null
}

export const isYouTubeMusic = (session: NowPlaying) => session.packageName === 'com.google.android.apps.youtube.music'

/** Pozicioni tani: gjatë luajtjes ecën me shpejtësinë e sesionit, deri te kohëzgjatja. */
export function positionNow(session: NowPlaying, now: number): number {
  const moved = isPlaying(session) ? Math.max(0, now - session.positionAt) * session.speed : 0
  const position = session.positionMs + moved
  return session.durationMs === null ? position : Math.min(session.durationMs, position)
}

function errorCode(error: unknown): string | null {
  const code = (error as { code?: unknown } | null)?.code
  return typeof code === 'string' ? code : null
}

const RESULTS: Record<string, ControlResult> = { UNSUPPORTED: 'unsupported', NO_SESSION: 'no-session', NO_ACCESS: 'no-access' }

export function createMusic(bridge: MusicBridge) {
  const listeners = new Set<(session: NowPlaying | null) => void>()
  const stateListeners = new Set<() => void>()
  let current: NowPlaying | null | undefined
  let state: MusicState = 'unknown'
  let handle: Promise<{ remove: () => Promise<void> } | null> | null = null

  const setState = (next: MusicState) => {
    if (state === next) return
    state = next
    stateListeners.forEach((listener) => listener())
  }
  const deliver = (session: NowPlaying | null) => {
    current = session
    listeners.forEach((listener) => listener(session))
  }

  async function start() {
    const listener = await bridge.addListener('nowPlaying', (event) => deliver(parseSession(event?.session)))
    try {
      await bridge.startListening()
      setState('listening')
      return listener
    } catch (error) {
      await listener.remove()
      setState(errorCode(error) === 'NO_ACCESS' ? 'no-access' : 'unknown')
      return null
    }
  }

  async function stop(pending: Promise<{ remove: () => Promise<void> } | null>) {
    const listener = await pending
    if (!listener) return
    await listener.remove()
    await bridge.stopListening().catch(() => {})
  }

  return {
    /** A ka plugin muzike (vetëm app-i në Android). */
    available: () => bridge.available(),
    async access(): Promise<MusicAccess> {
      if (!bridge.available()) return { granted: false, sdk: null, sideloaded: false }
      try {
        const result = await bridge.getAccess()
        const sdk = finite(result.sdk)
        return { granted: result.granted === true, sdk, sideloaded: !STORES.has(result.installer ?? '') }
      } catch {
        return { granted: false, sdk: null, sideloaded: false }
      }
    },
    openAccessSettings: () => bridge.openAccessSettings(),
    openAppInfo: () => bridge.openAppInfo(),
    /** Sesioni i fundit i njohur; undefined para ngjarjes së parë. */
    current: () => current,
    state: () => state,
    onState(listener: () => void) {
      stateListeners.add(listener)
      return () => void stateListeners.delete(listener)
    },
    /** Dëgjon sesionin që luan; kthen funksionin që ndalon dëgjimin. */
    subscribe(listener: (session: NowPlaying | null) => void) {
      listeners.add(listener)
      if (bridge.available() && !handle) handle = start()
      return () => {
        listeners.delete(listener)
        if (listeners.size > 0 || !handle) return
        const pending = handle
        handle = null
        current = undefined
        void stop(pending)
      }
    },
    /** Rinis dëgjimin pas lejes së re (kthimi nga cilësimet). */
    restart() {
      if (!bridge.available() || listeners.size === 0) return
      const pending = handle
      handle = (async () => {
        if (pending) await stop(pending)
        return start()
      })()
    },
    async control(action: MusicAction, options: { positionMs?: number; queueItemId?: number } = {}): Promise<ControlResult> {
      if (!bridge.available()) return 'unavailable'
      try {
        await bridge.control({ action, ...options })
        return 'ok'
      } catch (error) {
        return RESULTS[errorCode(error) ?? ''] ?? 'error'
      }
    },
    async openApp(): Promise<ControlResult> {
      if (!bridge.available()) return 'unavailable'
      try {
        await bridge.openApp()
        return 'ok'
      } catch (error) {
        return RESULTS[errorCode(error) ?? ''] ?? 'error'
      }
    },
  }
}

export type Music = ReturnType<typeof createMusic>

/** Muzika e app-it: plugin-i native i Android-it (MusicPlugin.java); jashtë telefonit nuk ofrohet. */
export const music = createMusic(nativeMusicBridge)
