import { i18nFor } from '@/i18n'
import { describeSync, syncSummary } from './sync-status-text'
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
  it('gjatë sinkronizimit', () => {
    expect(describeSync({ syncing: true }, NOW)).toBe('Po sinkronizohet')
  })

  it('para sinkronizimit të parë', () => {
    expect(describeSync({ syncing: false }, NOW)).toBe('Ende pa sinkronizim')
  })

  it('koha e sinkronizimit të fundit, me fjalë', () => {
    const at = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000).toISOString()
    expect(describeSync({ syncing: false, last: result({ at: at(0.5) }) }, NOW)).toBe('Sinkronizuar tani')
    expect(describeSync({ syncing: false, last: result({ at: at(5) }) }, NOW)).toBe('Sinkronizuar para 5 min')
    expect(describeSync({ syncing: false, last: result({ at: at(60) }) }, NOW)).toBe('Sinkronizuar para 1 ore')
    expect(describeSync({ syncing: false, last: result({ at: at(180) }) }, NOW)).toBe('Sinkronizuar para 3 orësh')
    expect(describeSync({ syncing: false, last: result({ at: '2026-11-28T07:05:00.000Z' }) }, NOW)).toMatch(
      /^Sinkronizuar më 28\.11\.2026, \d\d:05$/,
    )
  })

  it('pa internet, pa hyrje dhe me refuzime', () => {
    expect(describeSync({ syncing: false, last: result({ status: 'offline' }) }, NOW)).toBe(
      'Pa internet. Ndryshimet ruhen në telefon dhe dërgohen kur të kthehet rrjeti.',
    )
    expect(describeSync({ syncing: false, last: result({ status: 'signed_out' }) }, NOW)).toBe(
      'Hyr në llogari që të dhënat të ruhen edhe në Supabase.',
    )
    expect(describeSync({ syncing: false, last: result({ status: 'error', rejected: 2 }) }, NOW)).toBe(
      '2 ndryshime nuk u pranuan nga serveri. Mbeten në telefon.',
    )
    expect(describeSync({ syncing: false, last: result({ status: 'error', rejected: 1 }) }, NOW)).toBe(
      '1 ndryshim nuk u pranua nga serveri. Mbetet në telefon.',
    )
    expect(describeSync({ syncing: false, last: result({ status: 'error', error: 'timeout' }) }, NOW)).toBe(
      'Sinkronizimi nuk u krye. Provohet përsëri vetë.',
    )
  })

  it('në anglisht, me shumësin dhe datën britanike', () => {
    const en = i18nFor('en')
    const at = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000).toISOString()
    expect(describeSync({ syncing: true }, NOW, en)).toBe('Syncing')
    expect(describeSync({ syncing: false, last: result({ at: at(0.5) }) }, NOW, en)).toBe('Synced just now')
    expect(describeSync({ syncing: false, last: result({ at: at(5) }) }, NOW, en)).toBe('Synced 5 min ago')
    expect(describeSync({ syncing: false, last: result({ at: at(60) }) }, NOW, en)).toBe('Synced 1 hour ago')
    expect(describeSync({ syncing: false, last: result({ at: at(180) }) }, NOW, en)).toBe('Synced 3 hours ago')
    expect(describeSync({ syncing: false, last: result({ at: '2026-11-28T07:05:00.000Z' }) }, NOW, en)).toMatch(
      /^Synced on 28\/11\/2026 at \d\d:05$/,
    )
    expect(describeSync({ syncing: false, last: result({ status: 'error', rejected: 1 }) }, NOW, en)).toBe(
      '1 change was not accepted by the server. It stays on the phone.',
    )
    expect(describeSync({ syncing: false, last: result({ status: 'error', rejected: 2 }) }, NOW, en)).toBe(
      '2 changes were not accepted by the server. They stay on the phone.',
    )
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
