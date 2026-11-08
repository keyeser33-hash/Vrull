import {
  acousticBrainzBpm,
  acousticBrainzTempo,
  cleanArtist,
  cleanTitle,
  lookupTempo,
  musicBrainzQuery,
  octave,
  recordingIds,
  saveTappedTempo,
  songKey,
  type TempoDeps,
  type TempoRecord,
  validTempo,
} from './music-tempo'

// Tempo e këngës (V29, docs/research/muzika.md §3): ruajtja në telefon, GetSongBPM përmes Edge
// Function, pastaj AcousticBrainz, pastaj "Prek ritmin". Asnjë kërkesë rrjeti: burimet janë të imituara,
// me formën e përgjigjeve të verifikuar më 08.11.2026 te MusicBrainz dhe AcousticBrainz.

describe('titulli dhe artisti para kërkimit', () => {
  it('heq shtesat e YouTube Music dhe të Spotify-t që nuk janë pjesë e këngës', () => {
    expect(cleanTitle('Get Lucky (Official Video)')).toBe('Get Lucky')
    expect(cleanTitle('Get Lucky [Official Audio]')).toBe('Get Lucky')
    expect(cleanTitle('Lose Yourself (Lyrics)')).toBe('Lose Yourself')
    expect(cleanTitle('Eye of the Tiger - Remastered 2011')).toBe('Eye of the Tiger')
    expect(cleanTitle('Without Me (feat. Someone)')).toBe('Without Me')
    expect(cleanTitle('24K Magic (Official Music Video) [HD]')).toBe('24K Magic')
    expect(cleanTitle('Song - Radio Edit')).toBe('Song')
    // Versioni tjetër i këngës mbetet: remix-i ka tempon e vet.
    expect(cleanTitle('Song (Remix)')).toBe('Song (Remix)')
    expect(cleanTitle('  Edhe   një përsëritje ')).toBe('Edhe një përsëritje')
  })

  it('artisti: pa "- Topic", pa "VEVO", vetëm i pari kur janë disa me presje', () => {
    expect(cleanArtist('Daft Punk - Topic')).toBe('Daft Punk')
    expect(cleanArtist('AdeleVEVO')).toBe('Adele')
    expect(cleanArtist('Daft Punk, Pharrell Williams')).toBe('Daft Punk')
    expect(cleanArtist('Eminem feat. Dido')).toBe('Eminem')
    expect(cleanArtist('Simon & Garfunkel')).toBe('Simon & Garfunkel')
  })

  it('çelësi i ruajtjes nuk varet nga shkronjat e mëdha, shenjat ose shtesat', () => {
    expect(songKey({ title: 'Get Lucky (Official Video)', artist: 'Daft Punk - Topic' })).toBe(songKey({ title: 'get lucky', artist: 'DAFT PUNK' }))
    expect(songKey({ title: 'Çelë Për Ty', artist: 'Arbër' })).toBe('arber|cele per ty')
    expect(songKey({ title: 'Pa artist', artist: null })).toBe('|pa artist')
    expect(songKey({ title: '  ', artist: 'X' })).toBeNull()
  })
})

describe('tempo e pranuar dhe oktava', () => {
  it('pranon 60–200 BPM', () => {
    expect(validTempo(60)).toBe(true)
    expect(validTempo(200)).toBe(true)
    expect(validTempo(59.9)).toBe(false)
    expect(validTempo(201)).toBe(false)
    expect(validTempo(Number.NaN)).toBe(false)
  })

  it('×2 dhe ÷2 korrigjojnë oktavën, vetëm brenda 60–200', () => {
    expect(octave(84, 'double')).toBe(168)
    expect(octave(171.6, 'half')).toBe(85.8)
    expect(octave(120, 'double')).toBeNull()
    expect(octave(110, 'half')).toBeNull()
  })
})

// Përgjigjet e MusicBrainz (ws/2/recording?fmt=json) dhe AcousticBrainz (api/v1/low-level?features=rhythm.bpm).
const MB = {
  created: '2026-11-08T12:12:13.926Z',
  count: 4,
  offset: 0,
  recordings: [
    { id: 'aaaaaaaa-0000-4000-8000-000000000001', score: 100, title: 'Get Lucky', length: 369_000, 'artist-credit': [{ name: 'Daft Punk' }] },
    { id: 'aaaaaaaa-0000-4000-8000-000000000002', score: 100, title: 'Get Lucky', length: 248_000, 'artist-credit': [{ name: 'Daft Punk' }] },
    { id: 'aaaaaaaa-0000-4000-8000-000000000003', score: 95, title: 'Get Lucky', 'artist-credit': [{ name: 'Daft Punk' }] },
    { id: 'aaaaaaaa-0000-4000-8000-000000000004', score: 40, title: 'Lucky', length: 248_000, 'artist-credit': [{ name: 'Tjetër' }] },
  ],
}
const AB = {
  'aaaaaaaa-0000-4000-8000-000000000002': { '0': { metadata: { audio_properties: { length: 247.9 } }, rhythm: { bpm: 116.05859375 } } },
  'aaaaaaaa-0000-4000-8000-000000000001': { '0': { rhythm: { bpm: 116.033065796 } }, '1': { rhythm: { bpm: 58.1 } } },
  'aaaaaaaa-0000-4000-8000-000000000003': { '0': { rhythm: { bpm: 117.2 } } },
  mbid_mapping: {},
}

describe('AcousticBrainz përmes MusicBrainz', () => {
  it('kërkesa e MusicBrainz kërkon titullin dhe artistin, me thonjëzat e mbrojtura', () => {
    expect(musicBrainzQuery({ title: 'Get Lucky', artist: 'Daft Punk' })).toBe('recording:"Get Lucky" AND artist:"Daft Punk"')
    expect(musicBrainzQuery({ title: 'Say "Hi"', artist: null })).toBe('recording:"Say \\"Hi\\""')
  })

  it('MBID-të: vetëm përputhjet e forta, të parat ato me kohëzgjatjen më afër këngës', () => {
    expect(recordingIds(MB, 247_000)).toEqual([
      'aaaaaaaa-0000-4000-8000-000000000002',
      'aaaaaaaa-0000-4000-8000-000000000001',
      'aaaaaaaa-0000-4000-8000-000000000003',
    ])
    expect(recordingIds(MB, null)).toEqual([
      'aaaaaaaa-0000-4000-8000-000000000001',
      'aaaaaaaa-0000-4000-8000-000000000002',
      'aaaaaaaa-0000-4000-8000-000000000003',
    ])
    expect(recordingIds({ recordings: 'x' }, null)).toEqual([])
    expect(recordingIds(null, null)).toEqual([])
  })

  it('tempo është mediana e vlerave të gjetura, që një oktavë e gabuar të mos e prishë', () => {
    expect(acousticBrainzBpm(AB)).toBeCloseTo(116.06, 1)
    expect(acousticBrainzBpm({ mbid_mapping: {} })).toBeNull()
    expect(acousticBrainzBpm({ x: { '0': { rhythm: { bpm: 250 } } } })).toBeNull()
  })

  it('kërkon MusicBrainz, pastaj deri në 25 MBID te AcousticBrainz me rhythm.bpm', async () => {
    const urls: string[] = []
    const fetchJson = async (url: string) => {
      urls.push(url)
      return url.startsWith('https://musicbrainz.org/') ? MB : AB
    }
    const bpm = await acousticBrainzTempo({ title: 'Get Lucky', artist: 'Daft Punk', durationMs: 247_000 }, fetchJson)
    expect(bpm).toBeCloseTo(116.06, 1)
    expect(urls[0]).toBe(`https://musicbrainz.org/ws/2/recording?query=${encodeURIComponent('recording:"Get Lucky" AND artist:"Daft Punk"')}&limit=25&fmt=json`)
    expect(urls[1]).toBe(
      'https://acousticbrainz.org/api/v1/low-level?recording_ids=aaaaaaaa-0000-4000-8000-000000000002;aaaaaaaa-0000-4000-8000-000000000001;aaaaaaaa-0000-4000-8000-000000000003&features=rhythm.bpm',
    )
    // Pa regjistrime te MusicBrainz, AcousticBrainz nuk pyetet.
    const none = vi.fn(async () => ({ recordings: [] }))
    expect(await acousticBrainzTempo({ title: 'X', artist: 'Y' }, none)).toBeNull()
    expect(none).toHaveBeenCalledTimes(1)
  })
})

function memory(initial: Record<string, TempoRecord> = {}) {
  const records = new Map(Object.entries(initial))
  let now = 1_000_000
  const deps: TempoDeps & { records: Map<string, TempoRecord>; tick: (ms: number) => void } = {
    records,
    tick: (ms) => void (now += ms),
    read: async (key) => records.get(key) ?? null,
    write: async (key, record) => void records.set(key, record),
    getSongBpm: vi.fn(async () => null),
    acousticBrainz: vi.fn(async () => null),
    now: () => now,
  }
  return deps
}

const SONG = { title: 'Get Lucky (Official Video)', artist: 'Daft Punk - Topic', durationMs: 248_000 }
const KEY = 'daft punk|get lucky'

describe('zinxhiri i tempos', () => {
  it('GetSongBPM i pari: tempo ruhet në telefon me burimin dhe lidhjen', async () => {
    const deps = memory()
    deps.getSongBpm = vi.fn(async () => ({ bpm: 116, url: 'https://getsongbpm.com/song/get-lucky/x' }))
    const result = await lookupTempo(SONG, deps)
    expect(result).toEqual({ status: 'found', tempo: { bpm: 116, source: 'getsongbpm', url: 'https://getsongbpm.com/song/get-lucky/x', at: 1_000_000 } })
    // Kërkimi bëhet me titullin dhe artistin e pastruar.
    expect(deps.getSongBpm).toHaveBeenCalledWith({ title: 'Get Lucky', artist: 'Daft Punk', durationMs: 248_000 })
    expect(deps.acousticBrainz).not.toHaveBeenCalled()
    expect(deps.records.get(KEY)).toEqual(result.status === 'found' ? result.tempo : null)
  })

  it('pa GetSongBPM, AcousticBrainz; vlera ruhet me një shifër pas presjes', async () => {
    const deps = memory()
    deps.acousticBrainz = vi.fn(async () => 116.0586)
    expect(await lookupTempo(SONG, deps)).toEqual({ status: 'found', tempo: { bpm: 116.1, source: 'acousticbrainz', url: null, at: 1_000_000 } })
  })

  it('GetSongBPM i paarritshëm (gabim, kufi) nuk e ndal: provohet AcousticBrainz', async () => {
    const deps = memory()
    deps.getSongBpm = vi.fn(async () => Promise.reject(new Error('429')))
    deps.acousticBrainz = vi.fn(async () => 120)
    expect(await lookupTempo(SONG, deps)).toMatchObject({ status: 'found', tempo: { bpm: 120, source: 'acousticbrainz' } })
  })

  it('një tempo jashtë 60–200 nuk pranohet nga asnjë burim', async () => {
    const deps = memory()
    deps.getSongBpm = vi.fn(async () => ({ bpm: 220, url: null }))
    deps.acousticBrainz = vi.fn(async () => 40)
    expect(await lookupTempo(SONG, deps)).toEqual({ status: 'missing' })
  })

  it('vlera e ruajtur vjen pa rrjet; "nuk u gjet" provohet sërish pas 7 ditësh', async () => {
    const deps = memory({ [KEY]: { bpm: 138, source: 'tap', url: null, at: 1 } })
    expect(await lookupTempo(SONG, deps)).toEqual({ status: 'found', tempo: { bpm: 138, source: 'tap', url: null, at: 1 } })
    expect(deps.getSongBpm).not.toHaveBeenCalled()

    const missing = memory()
    expect(await lookupTempo(SONG, missing)).toEqual({ status: 'missing' })
    expect(missing.records.get(KEY)).toEqual({ bpm: null, at: 1_000_000 })
    missing.tick(6 * 24 * 3600_000)
    await lookupTempo(SONG, missing)
    expect(missing.getSongBpm).toHaveBeenCalledTimes(1)
    missing.tick(2 * 24 * 3600_000)
    await lookupTempo(SONG, missing)
    expect(missing.getSongBpm).toHaveBeenCalledTimes(2)
  })

  it('pa rrjet asnjë burim nuk arrihet: "pa rrjet", pa ruajtur "nuk u gjet"', async () => {
    const deps = memory()
    deps.getSongBpm = vi.fn(async () => Promise.reject(new Error('offline')))
    deps.acousticBrainz = vi.fn(async () => Promise.reject(new Error('offline')))
    expect(await lookupTempo(SONG, deps)).toEqual({ status: 'offline' })
    expect(deps.records.size).toBe(0)
  })

  it('pa titull nuk kërkohet asgjë', async () => {
    const deps = memory()
    expect(await lookupTempo({ title: ' ', artist: 'X' }, deps)).toEqual({ status: 'missing' })
    expect(deps.getSongBpm).not.toHaveBeenCalled()
  })

  it('"Prek ritmin" ruan tempon e prekur dhe e mbishkruan atë të gjetur', async () => {
    const deps = memory({ [KEY]: { bpm: 171.6, source: 'getsongbpm', url: 'https://getsongbpm.com/x', at: 1 } })
    expect(await saveTappedTempo(SONG, 86, deps)).toEqual({ bpm: 86, source: 'tap', url: null, at: 1_000_000 })
    expect(await lookupTempo(SONG, deps)).toMatchObject({ status: 'found', tempo: { bpm: 86, source: 'tap' } })
    await expect(saveTappedTempo(SONG, 300, deps)).rejects.toThrow()
  })
})
