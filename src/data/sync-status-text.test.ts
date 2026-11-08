import { i18nFor } from '@/i18n'
import { syncSummary } from './sync-status-text'
import type { SyncResult } from './sync'

const NOW = new Date('2026-11-30T10:00:00.000Z')
const result = (values: Partial<SyncResult>): SyncResult => ({
  status: 'ok',
  at: '2026-11-30T10:00:00.000Z',
  pushed: 0,
  pulled: 0,
  rejected: 0,
  ...values,
})

describe('teksti i gjendjes së sinkronizimit', () => {
  const detail = (values: Partial<SyncResult>, i18n = i18nFor('sq')) => syncSummary({ syncing: false, last: result(values) }, NOW, i18n).detail
  const at = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000).toISOString()

  it('koha e sinkronizimit të fundit, me fjalë', () => {
    expect(detail({ at: at(0.5) })).toBe('tani')
    expect(detail({ at: at(5) })).toBe('para 5 min')
    expect(detail({ at: at(60) })).toBe('para 1 ore')
    expect(detail({ at: at(180) })).toBe('para 3 orësh')
    expect(detail({ at: '2026-11-28T07:05:00.000Z' })).toMatch(/^më 28\.11\.2026, \d\d:05$/)
    expect(detail({ status: 'error', rejected: 1 })).toBe('1 ndryshim nuk u pranua nga serveri. Mbetet në telefon.')
    expect(detail({ status: 'error', error: 'timeout' })).toBe('Sinkronizimi nuk u krye. Provohet përsëri vetë.')
  })

  it('në anglisht, me shumësin dhe datën britanike', () => {
    const en = i18nFor('en')
    expect(syncSummary({ syncing: true }, NOW, en).title).toBe('Syncing')
    expect(detail({ at: at(0.5) }, en)).toBe('just now')
    expect(detail({ at: at(5) }, en)).toBe('5 min ago')
    expect(detail({ at: at(60) }, en)).toBe('1 hour ago')
    expect(detail({ at: at(180) }, en)).toBe('3 hours ago')
    expect(detail({ at: '2026-11-28T07:05:00.000Z' }, en)).toMatch(/^on 28\/11\/2026 at \d\d:05$/)
    expect(detail({ status: 'error', rejected: 1 }, en)).toBe('1 change was not accepted by the server. It stays on the phone.')
    expect(detail({ status: 'error', rejected: 2 }, en)).toBe('2 changes were not accepted by the server. They stay on the phone.')
  })

  // Cilësimet › Sinkronizimi (bordi): gjendja me pikë dhe fjalë, koha ose shpjegimi poshtë.
  it('rreshti i Cilësimeve: gjendja, ngjyra e pikës dhe detaji', () => {
    const at = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000).toISOString()
    expect(syncSummary({ syncing: false, last: result({ at: at(2) }) }, NOW)).toEqual({ tone: 'success', title: 'I sinkronizuar', detail: 'para 2 min' })
    expect(syncSummary({ syncing: true }, NOW)).toEqual({ tone: 'muted', title: 'Po sinkronizohet', detail: null })
    expect(syncSummary({ syncing: false }, NOW)).toEqual({ tone: 'muted', title: 'Ende pa sinkronizim', detail: null })
    expect(syncSummary({ syncing: false, last: result({ status: 'offline' }) }, NOW)).toEqual({
      tone: 'muted',
      title: 'Pa internet',
      detail: 'Ndryshimet ruhen në telefon dhe dërgohen kur të kthehet rrjeti.',
    })
    expect(syncSummary({ syncing: false, last: result({ status: 'signed_out' }) }, NOW)).toEqual({
      tone: 'muted',
      title: 'Pa llogari',
      detail: 'Hyr në llogari që të dhënat të ruhen edhe në Supabase.',
    })
    expect(syncSummary({ syncing: false, last: result({ status: 'error', rejected: 2 }) }, NOW)).toEqual({
      tone: 'danger',
      title: 'Nuk u sinkronizua',
      detail: '2 ndryshime nuk u pranuan nga serveri. Mbeten në telefon.',
    })
    const en = i18nFor('en')
    expect(syncSummary({ syncing: false, last: result({ at: at(2) }) }, NOW, en)).toEqual({ tone: 'success', title: 'Synced', detail: '2 min ago' })
    expect(syncSummary({ syncing: false, last: result({ status: 'error' }) }, NOW, en)).toEqual({
      tone: 'danger',
      title: 'Not synced',
      detail: 'Sync did not finish. It will try again by itself.',
    })
  })
})
