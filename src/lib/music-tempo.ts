// Tempo e këngës (SPEC V29, docs/research/muzika.md §3). Radha e burimeve:
// 1. vlera e ruajtur në telefon (me burimin);
// 2. GetSongBPM, përmes Edge Function `song-tempo` me çelësin si secret (lidhja te GetSongBPM.com e detyrueshme në UI);
// 3. AcousticBrainz (CC0, këngët deri në 2022): MusicBrainz jep MBID-të, AcousticBrainz `rhythm.bpm`;
// 4. "Prek ritmin" (music-tap.ts), që edhe e korrigjon, bashkë me ×2 dhe ÷2.
// Kërkimi nuk e ndal kurrë ekranin: kënga del menjëherë dhe tempo shtohet kur gjendet.

export type TempoSource = 'getsongbpm' | 'acousticbrainz' | 'tap'

export interface SongTempo {
  bpm: number
  source: TempoSource
  /** Faqja e këngës te GetSongBPM, kur burimi është ai. */
  url: string | null
  /** Kur u gjet (ms). */
  at: number
}

/** "Nuk u gjet" te asnjë burim: provohet sërish pas `MISS_RETRY_MS`. */
export interface TempoMiss {
  bpm: null
  at: number
}

export type TempoRecord = SongTempo | TempoMiss

export interface SongRef {
  title: string | null
  artist: string | null
  durationMs?: number | null
}

export type TempoLookup = { status: 'found'; tempo: SongTempo } | { status: 'missing' } | { status: 'offline' }

export interface TempoDeps {
  read(key: string): Promise<TempoRecord | null>
  write(key: string, record: TempoRecord): Promise<void>
  /** GetSongBPM përmes Edge Function; null = nuk u gjet. Hedh gabim kur s'arrihet ose kur çelësi mungon. */
  getSongBpm(song: CleanSong): Promise<{ bpm: number; url: string | null } | null>
  /** AcousticBrainz; null = nuk u gjet. Hedh gabim kur s'arrihet. */
  acousticBrainz(song: CleanSong): Promise<number | null>
  now(): number
}

export interface CleanSong {
  title: string
  artist: string | null
  durationMs: number | null
}

export const TEMPO_RANGE = { min: 60, max: 200 } as const
export const MISS_RETRY_MS = 7 * 24 * 3600_000

export const validTempo = (bpm: number) => Number.isFinite(bpm) && bpm >= TEMPO_RANGE.min && bpm <= TEMPO_RANGE.max

/** ×2 ose ÷2: burimet automatike e ngatërrojnë shpesh oktavën (171,6 ↔ 85,8). null jashtë 60–200. */
export function octave(bpm: number, direction: 'double' | 'half'): number | null {
  const next = Math.round((direction === 'double' ? bpm * 2 : bpm / 2) * 10) / 10
  return validTempo(next) ? next : null
}

// Shtesat që app-et e muzikës u ngjitin titujve dhe që s'janë pjesë e këngës.
const EXTRA_WORDS = /\b(official|video|audio|lyrics?|visuali[sz]er|hd|4k|hq|explicit|clean|feat\.?|ft\.?|with)\b/i
const TRAILING = /\s+-\s+((\d{4}\s+)?remaster(ed)?(\s+\d{4})?(\s+version)?|radio edit|single version|mono|stereo)\s*$/i

/** "Get Lucky (Official Video)" → "Get Lucky"; një "(Remix)" mbetet, se ka tempon e vet. */
export function cleanTitle(title: string): string {
  let result = title
  // Kllapat me shtesa (një ose disa), nga fundi.
  result = result.replace(/\s*[([]([^)\]]*)[)\]]/g, (match, inner: string) => (EXTRA_WORDS.test(inner) ? '' : match))
  result = result.replace(TRAILING, '')
  return result.replace(/\s+/g, ' ').trim()
}

/** "Daft Punk - Topic" → "Daft Punk"; "AdeleVEVO" → "Adele"; "A, B" → "A"; "A feat. B" → "A". */
export function cleanArtist(artist: string): string {
  return artist
    .replace(/\s+-\s+topic\s*$/i, '')
    .replace(/(?<=\S)VEVO$/, '')
    .split(/,|\s+(?:feat\.?|ft\.?|featuring)\s+/i)[0]
    .replace(/\s+/g, ' ')
    .trim()
}

export function cleanSong(song: SongRef): CleanSong | null {
  const title = cleanTitle(song.title ?? '')
  if (!title) return null
  const artist = song.artist ? cleanArtist(song.artist) : ''
  return { title, artist: artist || null, durationMs: song.durationMs ?? null }
}

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('en')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()

/** Çelësi i ruajtjes: "artisti|titulli" i normalizuar; null pa titull. */
export function songKey(song: SongRef): string | null {
  const clean = cleanSong(song)
  return clean ? `${normalize(clean.artist ?? '')}|${normalize(clean.title)}` : null
}

const round1 = (value: number) => Math.round(value * 10) / 10

/** Zinxhiri: e ruajtura, GetSongBPM, AcousticBrainz. "offline" kur asnjë burim nuk u arrit. */
export async function lookupTempo(song: SongRef, deps: TempoDeps): Promise<TempoLookup> {
  const clean = cleanSong(song)
  const key = songKey(song)
  if (!clean || !key) return { status: 'missing' }
  const saved = await deps.read(key).catch(() => null)
  if (saved && saved.bpm !== null) return { status: 'found', tempo: saved }
  if (saved && deps.now() - saved.at < MISS_RETRY_MS) return { status: 'missing' }

  // Cili burim u përgjigj. "Nuk u gjet" ruhet 7 ditë vetëm kur u përgjigj AcousticBrainz, burimi i fundit:
  // GetSongBPM pa çelës nuk numërohet (hedh gabim te data/song-tempo.ts), dhe një 503 ose 429 i MusicBrainz
  // nuk e fsheh tempon e një kënge për një javë.
  let answered = false
  let finalAnswer = false
  const found = async (bpm: number, source: TempoSource, url: string | null): Promise<TempoLookup> => {
    const tempo: SongTempo = { bpm: round1(bpm), source, url, at: deps.now() }
    await deps.write(key, tempo).catch(() => {})
    return { status: 'found', tempo }
  }
  try {
    const result = await deps.getSongBpm(clean)
    answered = true
    if (result && validTempo(result.bpm)) return found(result.bpm, 'getsongbpm', result.url)
  } catch {
    // GetSongBPM nuk u arrit (pa rrjet, kufi, gabim): provohet AcousticBrainz.
  }
  try {
    const bpm = await deps.acousticBrainz(clean)
    answered = true
    finalAnswer = true
    if (bpm !== null && validTempo(bpm)) return found(bpm, 'acousticbrainz', null)
  } catch {
    // AcousticBrainz ose MusicBrainz nuk u arritën.
  }
  if (!answered) return { status: 'offline' }
  if (finalAnswer) await deps.write(key, { bpm: null, at: deps.now() }).catch(() => {})
  return { status: 'missing' }
}

/** Tempo nga "Prek ritmin": ruhet për këtë këngë me burimin "e prekur", mbi çdo vlerë tjetër. */
export async function saveTappedTempo(song: SongRef, bpm: number, deps: Pick<TempoDeps, 'write' | 'now'>): Promise<SongTempo> {
  const key = songKey(song)
  if (!key || !validTempo(bpm)) throw new Error('Tempo e pavlefshme')
  const tempo: SongTempo = { bpm: round1(bpm), source: 'tap', url: null, at: deps.now() }
  await deps.write(key, tempo)
  return tempo
}

// AcousticBrainz (acousticbrainz.readthedocs.io/api.html, lexuar më 08.11.2026): /api/v1/low-level me
// `recording_ids` "mbid;mbid" (deri në 25) dhe `features=rhythm.bpm`; përgjigja { mbid: { offset: { rhythm: { bpm } } } }.
// MusicBrainz (musicbrainz.org/doc/MusicBrainz_API): /ws/2/recording?query=…&fmt=json, 1 kërkesë në sekondë për IP.

const AB_MAX_IDS = 25
const MB_MIN_SCORE = 90

const quoted = (value: string) => `"${value.replace(/[\\"]/g, (char) => `\\${char}`)}"`

export function musicBrainzQuery(song: { title: string; artist: string | null }): string {
  return song.artist ? `recording:${quoted(song.title)} AND artist:${quoted(song.artist)}` : `recording:${quoted(song.title)}`
}

/** MBID-të e regjistrimeve me përputhje të fortë; të parat ato me kohëzgjatjen më afër këngës. */
export function recordingIds(json: unknown, durationMs: number | null): string[] {
  const recordings = (json as { recordings?: unknown } | null)?.recordings
  if (!Array.isArray(recordings)) return []
  const candidates = recordings.flatMap((entry: unknown, index) => {
    const recording = (entry ?? {}) as Record<string, unknown>
    const score = typeof recording.score === 'number' ? recording.score : Number(recording.score)
    if (typeof recording.id !== 'string' || !(score >= MB_MIN_SCORE)) return []
    const length = typeof recording.length === 'number' ? recording.length : null
    const distance = durationMs !== null && length !== null ? Math.abs(length - durationMs) : Number.POSITIVE_INFINITY
    return [{ id: recording.id, index, distance }]
  })
  return candidates
    .sort((a, b) => (durationMs === null ? a.index - b.index : a.distance - b.distance || a.index - b.index))
    .slice(0, AB_MAX_IDS)
    .map((candidate) => candidate.id)
}

/** Mediana e `rhythm.bpm` të gjetura (60–200), që një oktavë e gabuar të mos e prishë; null pa vlera. */
export function acousticBrainzBpm(json: unknown): number | null {
  if (!json || typeof json !== 'object') return null
  const values: number[] = []
  for (const [mbid, offsets] of Object.entries(json as Record<string, unknown>)) {
    if (mbid === 'mbid_mapping' || !offsets || typeof offsets !== 'object') continue
    for (const document of Object.values(offsets as Record<string, unknown>)) {
      const bpm = (document as { rhythm?: { bpm?: unknown } } | null)?.rhythm?.bpm
      if (typeof bpm === 'number' && validTempo(bpm)) values.push(bpm)
    }
  }
  if (values.length === 0) return null
  values.sort((a, b) => a - b)
  const middle = Math.floor(values.length / 2)
  return values.length % 2 === 1 ? values[middle] : (values[middle - 1] + values[middle]) / 2
}

/** MusicBrainz → AcousticBrainz. `fetchJson` hedh gabim kur kërkesa dështon (pa rrjet, 503, 429). */
export async function acousticBrainzTempo(song: CleanSong | (SongRef & { title: string }), fetchJson: (url: string) => Promise<unknown>): Promise<number | null> {
  const query = musicBrainzQuery({ title: song.title, artist: song.artist })
  const recordings = await fetchJson(`https://musicbrainz.org/ws/2/recording?query=${encodeURIComponent(query)}&limit=25&fmt=json`)
  const ids = recordingIds(recordings, song.durationMs ?? null)
  if (ids.length === 0) return null
  return acousticBrainzBpm(await fetchJson(`https://acousticbrainz.org/api/v1/low-level?recording_ids=${ids.join(';')}&features=rhythm.bpm`))
}

// Kërkesat drejt MusicBrainz dhe AcousticBrainz (V2-E1-16a). MusicBrainz kërkon një User-Agent që e
// identifikon app-in me versionin dhe një kontakt, URL ose email ("Application name/<version> ( contact-url )",
// musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting, lexuar më 08.11.2026), dhe të shumtën 1 kërkesë në
// sekondë për IP. WebView-i nuk e lejon User-Agent-in te fetch, ndaj në telefon kërkesa del nga native-i
// (CapacitorHttp); në shfletues mbetet fetch. Kontakti është faqja e projektit, kurrë një email personal.

export const MUSICBRAINZ_CONTACT = 'https://github.com/keyeser33-hash/Vrull'
const MUSICBRAINZ = 'https://musicbrainz.org/'
const MUSICBRAINZ_GAP_MS = 1_100
const TIMEOUT_MS = 8_000

export const musicBrainzUserAgent = (version: string) => `Vrull/${version} ( ${MUSICBRAINZ_CONTACT} )`

export interface TempoHttp {
  /** Kërkesa native (CapacitorHttp) në telefon; null në shfletues. */
  native: ((request: { url: string; headers: Record<string, string>; timeoutMs: number }) => Promise<{ status: number; data: unknown }>) | null
  fetch: (url: string, init?: RequestInit) => Promise<Response>
  sleep: (ms: number) => Promise<void>
}

/**
 * `fetchJson` i zinxhirit të tempos: MusicBrainz me User-Agent-in (native) dhe radhën e vet, një kërkesë në
 * 1,1 s edhe kur kërkohen disa këngë njëherësh; AcousticBrainz drejt. Hedh gabim kur kërkesa dështon
 * (pa rrjet, 503 i MusicBrainz, 429 i AcousticBrainz), që zinxhiri të mos ruajë "nuk u gjet".
 */
export function createTempoFetch(http: TempoHttp, options: { version: string }) {
  let musicBrainzTurn = Promise.resolve()

  async function viaFetch(url: string): Promise<unknown> {
    const response = await http.fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT_MS) })
    if (!response.ok) throw new Error(`${new URL(url).host}: ${response.status}`)
    return response.json()
  }

  return async function fetchJson(url: string): Promise<unknown> {
    if (!url.startsWith(MUSICBRAINZ)) return viaFetch(url)
    const turn = musicBrainzTurn
    musicBrainzTurn = turn.then(() => http.sleep(MUSICBRAINZ_GAP_MS))
    await turn
    if (!http.native) return viaFetch(url)
    const response = await http.native({
      url,
      headers: { Accept: 'application/json', 'User-Agent': musicBrainzUserAgent(options.version) },
      timeoutMs: TIMEOUT_MS,
    })
    if (response.status < 200 || response.status >= 300) throw new Error(`${new URL(url).host}: ${response.status}`)
    return typeof response.data === 'string' ? JSON.parse(response.data) : response.data
  }
}
