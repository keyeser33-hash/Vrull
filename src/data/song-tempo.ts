import { acousticBrainzTempo, type CleanSong, lookupTempo, saveTappedTempo, songKey, type SongRef, type TempoDeps, type TempoLookup, type TempoRecord } from '@/lib/music-tempo'
import { db } from './app-data'
import { supabase } from './supabase'

// Tempo e këngës në telefon (SPEC V29): ruhet te baza lokale (`_meta`, "tempo:artisti|titulli") me
// burimin, pa sinkronizim. GetSongBPM përmes funksionit `song-tempo` (vetëm me sesion), AcousticBrainz
// drejt nga telefoni (IP-ja e vet, CORS i lejuar), me MusicBrainz të shumtën një kërkesë në sekondë.

const PREFIX = 'tempo:'
const TIMEOUT_MS = 8_000
const MUSICBRAINZ_GAP_MS = 1_100

let musicBrainzReady = Promise.resolve()

/** Një kërkesë JSON; gabim kur nuk arrihet ose kthen gabim (503 i MusicBrainz, 429 i AcousticBrainz). */
async function fetchJson(url: string): Promise<unknown> {
  if (url.startsWith('https://musicbrainz.org/')) {
    // MusicBrainz: mesatarisht 1 kërkesë në sekondë për IP, ndryshe 503 për të gjitha.
    const turn = musicBrainzReady
    musicBrainzReady = turn.then(() => new Promise((resolve) => setTimeout(resolve, MUSICBRAINZ_GAP_MS)))
    await turn
  }
  const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!response.ok) throw new Error(`${new URL(url).host}: ${response.status}`)
  return response.json()
}

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
