import { beatPhaseMs, pickRestSong, pickSetSong, pulse, SET_TEMPO, wantsEnergy } from './music-pulse'

// Pulsi i "Trupit në ritëm" (V29): periudha 60/BPM, gjysma e tempos gjatë pushimit, ndalja kur app-i
// del në sfond ose fiket ekrani, trupi i ndezur pa puls me "lëvizje të reduktuar". Zgjedhja e këngës
// së radhës: 120–140 BPM për setet (më afër 130), më e qeta për pushimin; gjithnjë me prekje.

const base = { bpm: 138, phase: 'set' as const, playing: true, active: true, reducedMotion: false }

describe('pulsi i trupit', () => {
  it('ndjek tempon e këngës: një goditje çdo 60/BPM s', () => {
    expect(pulse(base)).toEqual({ animate: true, running: true, periodMs: 60_000 / 138 })
    expect(pulse({ ...base, bpm: 120 }).periodMs).toBe(500)
  })

  it('gjatë pushimit bie në gjysmën e tempos: periudha dyfishohet', () => {
    expect(pulse({ ...base, bpm: 136, phase: 'rest' })).toEqual({ animate: true, running: true, periodMs: (60_000 / 136) * 2 })
  })

  it('ndalet kur app-i del në sfond ose ekrani fiket, dhe rinis kur kthehet', () => {
    expect(pulse({ ...base, active: false })).toEqual({ animate: true, running: false, periodMs: 60_000 / 138 })
    expect(pulse({ ...base, active: true }).running).toBe(true)
  })

  it('me "lëvizje të reduktuar" trupi rri i ndezur pa pulsuar', () => {
    expect(pulse({ ...base, reducedMotion: true })).toEqual({ animate: false, running: false, periodMs: 60_000 / 138 })
  })

  it('pa tempo ose me muzikën në pauzë, trupi rri i ndezur pa puls', () => {
    expect(pulse({ ...base, bpm: null })).toEqual({ animate: false, running: false, periodMs: null })
    expect(pulse({ ...base, bpm: 300 })).toEqual({ animate: false, running: false, periodMs: null })
    expect(pulse({ ...base, playing: false })).toMatchObject({ animate: false, running: false })
  })

  it('faza e goditjes nga "Prek ritmin": pulsi nis bashkë me prekjen e fundit', () => {
    // 120 BPM, prekja e fundit 1 250 ms më parë: jemi 250 ms brenda goditjes.
    expect(beatPhaseMs(500, 10_000, 11_250)).toBe(250)
    expect(beatPhaseMs(500, null, 11_250)).toBe(0)
  })
})

describe('kënga e radhës, me prekje', () => {
  const song = (bpm: number | null, title = String(bpm)) => ({ title, bpm })

  it('setet: brenda 120–140 më afër 130', () => {
    expect(SET_TEMPO).toEqual({ min: 120, max: 140, ideal: 130, ceiling: 150 })
    expect(pickSetSong([song(104), song(136), song(126)])?.bpm).toBe(126)
    expect(pickSetSong([song(104), song(138), song(133)])?.bpm).toBe(133)
  })

  it('setet: kur asnjë s\'bie brenda, më e larta nën 150; pa tempo, asnjë', () => {
    expect(pickSetSong([song(104), song(145), song(160)])?.bpm).toBe(145)
    expect(pickSetSong([song(104), song(112)])?.bpm).toBe(112)
    expect(pickSetSong([song(null), song(170)])).toBeNull()
    expect(pickSetSong([])).toBeNull()
  })

  it('pushimi: më e qeta nën tempon e këngës që luan', () => {
    expect(pickRestSong([song(136), song(104), song(126)], 138)?.bpm).toBe(104)
    expect(pickRestSong([song(140), song(150)], 138)).toBeNull()
    expect(pickRestSong([song(118), song(null)], null)?.bpm).toBe(118)
    expect(pickRestSong([song(126)], null)).toBeNull()
  })

  it('kur fillon seti, oferta "Kalo këngën" vjen vetëm kur kënga është nën tempon e setit ose pa tempo', () => {
    expect(wantsEnergy(98)).toBe(true)
    expect(wantsEnergy(null)).toBe(true)
    expect(wantsEnergy(120)).toBe(false)
    expect(wantsEnergy(160)).toBe(false)
  })
})
