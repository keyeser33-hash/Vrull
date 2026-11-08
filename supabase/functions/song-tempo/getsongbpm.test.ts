import { bestMatch, parseRequest, searchUrl } from './getsongbpm.ts'

// GetSongBPM (getsongbpm.com/api, lexuar më 08.11.2026): GET api.getsongbpm.com/search/ me `type=both` dhe
// `lookup=song:… artist:…`, çelësi në `X-API-KEY`; objekti "both" ka song_id, song_title, song_uri,
// tempo, artist (objekt "artist" me name). Dokumentimi nuk e tregon mbështjellësin e listës, ndaj
// lexohen të dyja format: lista vetë ose { search: [...] }; { search: { error } } është "nuk u gjet".

const getLucky = {
  song_id: 'x1',
  song_title: 'Get Lucky',
  song_uri: 'https://getsongbpm.com/song/get-lucky/x1',
  tempo: '116',
  time_sig: '4/4',
  key_of: 'F♯m',
  artist: { id: 'a1', name: 'Daft Punk', uri: 'https://getsongbpm.com/artist/daft-punk/a1' },
  album: { title: 'Random Access Memories', uri: 'https://getsongbpm.com/album/x', year: '2013' },
}

describe('GetSongBPM në Edge Function', () => {
  it('kërkesa: kënga dhe artisti te `lookup`, pa çelësin në adresë', () => {
    expect(searchUrl('Get Lucky', 'Daft Punk')).toBe('https://api.getsongbpm.com/search/?type=both&lookup=song%3AGet+Lucky+artist%3ADaft+Punk')
    expect(searchUrl('Get Lucky', null)).toBe('https://api.getsongbpm.com/search/?type=song&lookup=Get+Lucky')
  })

  it('trupi i kërkesës: titulli 1–200 shkronja, artisti opsional', () => {
    expect(parseRequest({ title: ' Get Lucky ', artist: 'Daft Punk' })).toEqual({ title: 'Get Lucky', artist: 'Daft Punk' })
    expect(parseRequest({ title: 'Get Lucky' })).toEqual({ title: 'Get Lucky', artist: null })
    expect(parseRequest({ title: '' })).toBeNull()
    expect(parseRequest({ title: 'x'.repeat(201) })).toBeNull()
    expect(parseRequest(null)).toBeNull()
  })

  it('merr tempon e këngës që përputhet me titullin dhe artistin, me lidhjen te GetSongBPM.com', () => {
    const other = { ...getLucky, song_title: 'Lucky', tempo: '90', artist: { name: 'Tjetër' } }
    expect(bestMatch({ search: [other, getLucky] }, 'Get Lucky', 'Daft Punk')).toEqual({ bpm: 116, url: 'https://getsongbpm.com/song/get-lucky/x1' })
    expect(bestMatch([getLucky], 'get lucky', 'daft punk')).toEqual({ bpm: 116, url: 'https://getsongbpm.com/song/get-lucky/x1' })
  })

  it('një version me shtesë ("Get Lucky (Radio Edit)") vlen; një artist tjetër jo', () => {
    expect(bestMatch({ search: [{ ...getLucky, song_title: 'Get Lucky (Radio Edit)' }] }, 'Get Lucky', 'Daft Punk')?.bpm).toBe(116)
    expect(bestMatch({ search: [{ ...getLucky, artist: { name: 'Kopje' } }] }, 'Get Lucky', 'Daft Punk')).toBeNull()
    expect(bestMatch({ search: [{ ...getLucky, artist: [{ name: 'Daft Punk' }] }] }, 'Get Lucky', 'Daft Punk')?.bpm).toBe(116)
  })

  it('"nuk u gjet", tempo që mungon dhe lidhje jashtë GetSongBPM.com', () => {
    expect(bestMatch({ search: { error: 'no result' } }, 'Get Lucky', 'Daft Punk')).toBeNull()
    expect(bestMatch({ search: [{ ...getLucky, tempo: '' }] }, 'Get Lucky', 'Daft Punk')).toBeNull()
    expect(bestMatch({ search: [{ ...getLucky, song_uri: 'https://example.com/x' }] }, 'Get Lucky', 'Daft Punk')).toEqual({ bpm: 116, url: null })
    expect(bestMatch('x', 'Get Lucky', 'Daft Punk')).toBeNull()
  })
})
