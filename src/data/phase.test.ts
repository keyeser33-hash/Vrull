import { decidePhase, type PhaseInput } from './phase'

const base: PhaseInput = { auth: 'signed_in', onboarded: false, pulled: false, syncing: false, lastStatus: undefined }

describe('faza e app-it', () => {
  it('pret sesionin dhe leximin lokal para se të vendosë', () => {
    expect(decidePhase({ ...base, auth: 'loading' })).toBe('loading')
    expect(decidePhase({ ...base, onboarded: undefined })).toBe('loading')
    expect(decidePhase({ ...base, pulled: undefined })).toBe('loading')
  })

  it('pa sesion: hyrja', () => {
    expect(decidePhase({ ...base, auth: 'signed_out', onboarded: undefined })).toBe('signed_out')
  })

  it('me profil të plotësuar: Sot, edhe pa internet dhe pa sinkronizim', () => {
    expect(decidePhase({ ...base, onboarded: true, pulled: false, lastStatus: 'offline' })).toBe('ready')
  })

  it('pas hyrjes merr të dhënat ekzistuese para hapave, që një instalim i ri të mos i përsërisë', () => {
    expect(decidePhase({ ...base, syncing: true })).toBe('fetching')
    expect(decidePhase({ ...base })).toBe('fetching')
    expect(decidePhase({ ...base, lastStatus: 'signed_out' })).toBe('fetching')
    expect(decidePhase({ ...base, lastStatus: 'offline' })).toBe('fetch_failed')
    expect(decidePhase({ ...base, lastStatus: 'error' })).toBe('fetch_failed')
    expect(decidePhase({ ...base, lastStatus: 'offline', syncing: true })).toBe('fetching')
  })

  it('pasi të dhënat janë marrë dhe profili mungon: hapat', () => {
    expect(decidePhase({ ...base, pulled: true, lastStatus: 'ok' })).toBe('onboarding')
    expect(decidePhase({ ...base, pulled: true, lastStatus: 'offline' })).toBe('onboarding')
  })
})
