// GetSongBPM (https://getsongbpm.com/api, lexuar më 08.11.2026), pa API të Deno-s, që provat ta lexojnë.
// - GET https://api.getsongbpm.com/search/ me `type` ("song", "artist", "both") dhe `lookup`
//   ("song:enter+sandman artist:metallica" për "both"); çelësi te `api_key` ose te koka `X-API-KEY`.
// - Objekti "both": song_id, song_title, song_uri, tempo, time_sig, key_of, camelot, artist, album.
// - Kushtet: falas, "a link back to GetSongBPM.com is REQUIRED (Website, in-App or Store Listing)";
//   kufijtë ("rate limits apply") pa numër; ruajtja e rezultateve nuk përmendet.
// Dokumentimi nuk e tregon mbështjellësin e listës: lexohen të dyja format (lista ose { search: [...] }).

const MAX_LENGTH = 200

export interface TempoRequest {
  title: string
  artist: string | null
}

export function parseRequest(body: unknown): TempoRequest | null {
  if (!body || typeof body !== 'object') return null
  const value = body as Record<string, unknown>
  const title = typeof value.title === 'string' ? value.title.trim() : ''
  const artist = typeof value.artist === 'string' ? value.artist.trim() : ''
  if (title.length < 1 || title.length > MAX_LENGTH || artist.length > MAX_LENGTH) return null
  return { title, artist: artist || null }
}

/** Adresa e kërkimit, pa çelësin (ai shkon te koka `X-API-KEY`, jo te adresa ose te log-et). */
export function searchUrl(title: string, artist: string | null): string {
  const params = new URLSearchParams(artist ? { type: 'both', lookup: `song:${title} artist:${artist}` } : { type: 'song', lookup: title })
  return `https://api.getsongbpm.com/search/?${params}`
}

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()

function artistName(artist: unknown): string | null {
  if (typeof artist === 'string') return artist
  if (Array.isArray(artist)) return artistName(artist[0])
  const name = (artist as { name?: unknown } | null)?.name
  return typeof name === 'string' ? name : null
}

function sameTitle(found: string, wanted: string) {
  const a = normalize(found)
  const b = normalize(wanted)
  return a === b || a.startsWith(`${b} `)
}

function sameArtist(found: string, wanted: string) {
  const a = normalize(found)
  const b = normalize(wanted)
  return a === b || a.includes(b) || b.includes(a)
}

/** Lidhja te faqja e këngës, vetëm kur është te GetSongBPM.com. */
function songUrl(value: unknown): string | null {
  return typeof value === 'string' && /^https:\/\/(www\.)?getsongbpm\.com\//.test(value) ? value : null
}

/** Tempo e këngës që përputhet me titullin dhe artistin; null kur nuk ka. */
export function bestMatch(json: unknown, title: string, artist: string | null): { bpm: number; url: string | null } | null {
  const list = Array.isArray(json) ? json : (json as { search?: unknown } | null)?.search
  if (!Array.isArray(list)) return null
  for (const entry of list) {
    const item = (entry ?? {}) as Record<string, unknown>
    const found = typeof item.song_title === 'string' ? item.song_title : typeof item.title === 'string' ? item.title : null
    const tempo = typeof item.tempo === 'number' ? item.tempo : typeof item.tempo === 'string' && item.tempo.trim() !== '' ? Number(item.tempo) : Number.NaN
    if (!found || !Number.isFinite(tempo) || tempo <= 0 || !sameTitle(found, title)) continue
    const name = artistName(item.artist)
    if (artist && (!name || !sameArtist(name, artist))) continue
    return { bpm: tempo, url: songUrl(item.song_uri ?? item.uri) }
  }
  return null
}
