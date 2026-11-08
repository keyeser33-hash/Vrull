import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { onAppVisibility } from './app-visibility'
import { music, type NowPlaying, type QueueEntry } from './music'
import { type SongRef, type SongTempo, songKey, type TempoLookup } from './music-tempo'

// Tempo vjen nga baza lokale dhe rrjeti (`data/song-tempo.ts`), që ngarkohet vetëm kur duhet.
const findTempo = (song: SongRef): Promise<TempoLookup> => import('@/data/song-tempo').then((module) => module.findTempo(song))
const saveTapTempo = (song: SongRef, bpm: number) => import('@/data/song-tempo').then((module) => module.saveTapTempo(song, bpm))

// Hook-et e muzikës për seancën (V2-E1-12): sesioni që luan, leja, tempo e këngës dhe e radhës,
// faqja e dukshme (pulsi ndalet në sfond) dhe "lëvizja e reduktuar".

export type MusicStatus = 'unavailable' | 'unknown' | 'no-access' | 'listening'

/** Sesioni i app-it të muzikës sa kohë `enabled`; pas kthimit nga cilësimet kontrollon sërish lejen. */
export function useNowPlaying(enabled: boolean): { status: MusicStatus; session: NowPlaying | null } {
  const available = music.available()
  const state = useSyncExternalStore(music.onState, music.state)
  const [session, setSession] = useState<NowPlaying | null>(() => music.current() ?? null)
  useEffect(() => {
    if (!enabled || !available) return
    return music.subscribe(setSession)
  }, [enabled, available])
  // Leja jepet te cilësimet e Android-it: kur app-i kthehet, dëgjimi rinis nëse leja erdhi.
  useEffect(() => {
    if (!enabled || !available || state !== 'no-access') return
    return onResume(() => {
      void music.access().then((access) => {
        if (access.granted) music.restart()
      })
    })
  }, [enabled, available, state])
  return { status: available ? state : 'unavailable', session: state === 'listening' ? session : null }
}

/** Thërret `listener` kur app-i kthehet përpara (faqja duket sërish ose `resume` i Capacitor-it). */
export function onResume(listener: () => void): () => void {
  const visible = () => {
    if (document.visibilityState === 'visible') listener()
  }
  document.addEventListener('visibilitychange', visible)
  const handle = Capacitor.isNativePlatform() ? App.addListener('resume', listener) : null
  return () => {
    document.removeEventListener('visibilitychange', visible)
    void handle?.then((value) => value.remove())
  }
}

/** Faqja duket dhe app-i është përpara; false kur app-i del në sfond ose ekrani fiket. */
export function usePageActive(): boolean {
  const [active, setActive] = useState(() => document.visibilityState !== 'hidden')
  useEffect(() => onAppVisibility(setActive), [])
  return active
}

const REDUCED = '(prefers-reduced-motion: reduce)'

const reducedQuery = () => (typeof window.matchMedia === 'function' ? window.matchMedia(REDUCED) : null)

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => reducedQuery()?.matches ?? false)
  useEffect(() => {
    const query = reducedQuery()
    if (!query) return
    const update = () => setReduced(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return reduced
}

export type TempoStatus = 'none' | 'loading' | 'found' | 'missing' | 'offline'

export interface CurrentTempo {
  status: TempoStatus
  tempo: SongTempo | null
  /** Prekja e fundit e "Prek ritmin" (ms e `performance.now()`-it të faqes), për fazën e pulsit. */
  anchor: number | null
  /** Ruan tempon e prekur për këngën që luan. */
  saveTap(bpm: number, anchor: number | null): Promise<void>
}

/** Tempo e këngës që luan, sipas zinxhirit (e ruajtura, GetSongBPM, AcousticBrainz). */
export function useSongTempo(session: NowPlaying | null): CurrentTempo {
  const song = session ? { title: session.title, artist: session.artist, durationMs: session.durationMs } : null
  const key = song ? songKey(song) : null
  const [result, setResult] = useState<{ key: string; status: TempoStatus; tempo: SongTempo | null; anchor: number | null } | null>(null)
  useEffect(() => {
    if (!key || !song) return
    let cancelled = false
    void findTempo(song).then((lookup) => {
      if (cancelled) return
      setResult((current) =>
        // Një prekje gjatë kërkimit fiton mbi rezultatin e vonuar.
        current?.key === key && current.tempo?.source === 'tap'
          ? current
          : { key, status: lookup.status, tempo: lookup.status === 'found' ? lookup.tempo : null, anchor: null },
      )
    })
    return () => {
      cancelled = true
    }
    // `song` rindërtohet në çdo render; çelësi e përcakton këngën.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  const current = key && result?.key === key ? result : null
  const saveTap = useCallback(
    async (bpm: number, anchor: number | null) => {
      if (!key || !song) return
      const tempo = await saveTapTempo(song, bpm)
      setResult({ key, status: 'found', tempo, anchor })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  )
  return { status: key ? (current?.status ?? 'loading') : 'none', tempo: current?.tempo ?? null, anchor: current?.anchor ?? null, saveTap }
}

/** Tempo e këngëve të radhës (një nga një, që MusicBrainz të mos kalojë 1 kërkesë në sekondë). */
export function useQueueTempos(queue: QueueEntry[] | null, enabled: boolean): Map<number, number | null> {
  const key = enabled && queue ? queue.map((entry) => `${entry.id}:${entry.title}:${entry.artist ?? ''}`).join('|') : ''
  const [tempos, setTempos] = useState<{ key: string; values: Map<number, number | null> }>({ key: '', values: new Map() })
  useEffect(() => {
    if (!key || !queue) return
    let cancelled = false
    void (async () => {
      const values = new Map<number, number | null>()
      for (const entry of queue) {
        const lookup = await findTempo({ title: entry.title, artist: entry.artist })
        if (cancelled) return
        values.set(entry.id, lookup.status === 'found' ? lookup.tempo.bpm : null)
        setTempos({ key, values: new Map(values) })
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return tempos.key === key ? tempos.values : new Map()
}
