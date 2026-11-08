import { Capacitor, CapacitorHttp } from '@capacitor/core'
import {
  acousticBrainzTempo,
  type CleanSong,
  createTempoFetch,
  lookupTempo,
  saveTappedTempo,
  songKey,
  type SongRef,
  type TempoDeps,
  type TempoLookup,
  type TempoRecord,
} from '@/lib/music-tempo'
import { db } from './app-data'
import { supabase } from './supabase'

// Tempo e këngës në telefon (SPEC V29): ruhet te baza lokale (`_meta`, "tempo:artisti|titulli") me
// burimin, pa sinkronizim. GetSongBPM përmes funksionit `song-tempo` (vetëm me sesion), AcousticBrainz
// drejt nga telefoni (IP-ja e vet, CORS i lejuar). MusicBrainz me User-Agent-in "Vrull/<versioni> ( faqja e
// projektit )" nga native-i në telefon (CapacitorHttp, V2-E1-16a), të shumtën një kërkesë në sekondë.

const PREFIX = 'tempo:'

/** Kërkesat e zinxhirit: MusicBrainz nga native-i në telefon (WebView-i nuk e lejon User-Agent-in), fetch në shfletues. */
const fetchJson = createTempoFetch(
  {
    native: Capacitor.isNativePlatform()
      ? async ({ url, headers, timeoutMs }) => {
          const response = await CapacitorHttp.get({ url, headers, connectTimeout: timeoutMs, readTimeout: timeoutMs, responseType: 'json' })
          return { status: response.status, data: response.data }
        }
      : null,
    fetch: (url, init) => fetch(url, init),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  },
  { version: __APP_VERSION__ },
)

export const tempoDeps: TempoDeps = {
  async read(key) {
    return ((await db._meta.get(PREFIX + key))?.value as TempoRecord | undefined) ?? null
  },
  async write(key, record) {
    await db._meta.put({ key: PREFIX + key, value: record })
  },
  async getSongBpm(song: CleanSong) {
    const { data, error } = await supabase.functions.invoke('song-tempo', { body: { title: song.title, artist: song.artist } })
    if (error) throw error
    const value = (data ?? {}) as { bpm?: unknown; url?: unknown }
    return typeof value.bpm === 'number' ? { bpm: value.bpm, url: typeof value.url === 'string' ? value.url : null } : null
  },
  acousticBrainz: (song) => acousticBrainzTempo(song, fetchJson),
  now: () => Date.now(),
}

const inFlight = new Map<string, Promise<TempoLookup>>()

/** Tempo e një kënge sipas zinxhirit; dy kërkime të njëkohshme të së njëjtës këngë bëhen një. */
export function findTempo(song: SongRef): Promise<TempoLookup> {
  const key = songKey(song)
  if (!key) return Promise.resolve({ status: 'missing' })
  const running = inFlight.get(key)
  if (running) return running
  const lookup = lookupTempo(song, tempoDeps).finally(() => inFlight.delete(key))
  inFlight.set(key, lookup)
  return lookup
}

/** Tempo nga "Prek ritmin", e ruajtur për këtë këngë. */
export const saveTapTempo = (song: SongRef, bpm: number) => saveTappedTempo(song, bpm, tempoDeps)
