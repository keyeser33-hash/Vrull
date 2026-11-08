import { emptyTaps, TAP, tap, tapTempo } from './music-tap'

// "Prek ritmin" (V29, docs/research/muzika.md §3): të paktën 4 prekje; tempo = 60 000 / mediana e
// intervaleve të 8 prekjeve të fundit; nis nga e para pas 2 s pa prekje; pranohet 60–200 BPM.

const tapsAt = (times: number[]) => times.reduce(tap, emptyTaps())

describe('prek ritmin', () => {
  it('pa prekje ose me një prekje nuk ka tempo', () => {
    expect(tapTempo(emptyTaps())).toEqual({ bpm: null, count: 0, ready: false, anchor: null })
    expect(tapTempo(tapsAt([1000]))).toEqual({ bpm: null, count: 1, ready: false, anchor: 1000 })
  })

  it('nga prekja e dytë tregon tempon; ruhet vetëm nga prekja e katërt', () => {
    // 84 BPM: një goditje çdo 714 ms.
    const three = tapsAt([0, 714, 1428])
    expect(tapTempo(three)).toEqual({ bpm: 84, count: 3, ready: false, anchor: 1428 })
    const four = tap(three, 2142)
    expect(tapTempo(four)).toEqual({ bpm: 84, count: 4, ready: true, anchor: 2142 })
    expect(TAP.minTaps).toBe(4)
  })

  it('mediana e intervaleve: një prekje e vonuar nuk e prish tempon', () => {
    // 120 BPM (500 ms), me një prekje 180 ms vonë.
    expect(tapTempo(tapsAt([0, 500, 1000, 1680, 2000, 2500])).bpm).toBe(120)
  })

  it('mban vetëm 8 prekjet e fundit: tempo ndjek ndryshimin e ritmit', () => {
    const slow = [0, 1000, 2000, 3000, 4000, 5000, 6000, 7000]
    const fast = [7500, 8000, 8500, 9000, 9500, 10000, 10500, 11000]
    expect(tapTempo(tapsAt([...slow, ...fast])).bpm).toBe(120)
    expect(tapsAt([...slow, ...fast]).taps).toHaveLength(8)
  })

  it('pas 2 s pa prekje nis nga e para', () => {
    const state = tapsAt([0, 500, 1000, 1000 + TAP.resetMs + 1])
    expect(tapTempo(state)).toMatchObject({ bpm: null, count: 1 })
  })

  it('jashtë 60–200 BPM nuk ruhet', () => {
    // 220 BPM: 273 ms.
    expect(tapTempo(tapsAt([0, 273, 546, 819]))).toMatchObject({ ready: false })
    expect(tapTempo(tapsAt([0, 273, 546, 819])).bpm).toBe(220)
  })
})
