import { validTempo } from './music-tempo'

// "Prek ritmin" (SPEC V29, docs/research/muzika.md §3): përdoruesi prek në çdo goditje të këngës.
// Tempo = 60 000 / mediana e intervaleve të 8 prekjeve të fundit, e rrumbullakosur; ruhet nga prekja e
// katërt, vetëm brenda 60–200 BPM. Pas 2 s pa prekje nis nga e para. Prekja e fundit jep fazën e
// goditjes, që pulsi i trupit të nisë bashkë me muzikën.

export const TAP = { minTaps: 4, window: 8, resetMs: 2000 } as const

export interface TapState {
  /** Koha e prekjeve (ms), më e vjetra e para; të shumtën 8. */
  taps: number[]
}

export const emptyTaps = (): TapState => ({ taps: [] })

export function tap(state: TapState, at: number): TapState {
  const last = state.taps.at(-1)
  const taps = last !== undefined && at - last <= TAP.resetMs && at >= last ? [...state.taps, at] : [at]
  return { taps: taps.slice(-TAP.window) }
}

export function tapTempo(state: TapState): { bpm: number | null; count: number; ready: boolean; anchor: number | null } {
  const { taps } = state
  const anchor = taps.at(-1) ?? null
  if (taps.length < 2) return { bpm: null, count: taps.length, ready: false, anchor }
  const intervals = taps.slice(1).map((time, index) => time - taps[index]).sort((a, b) => a - b)
  const middle = Math.floor(intervals.length / 2)
  const median = intervals.length % 2 === 1 ? intervals[middle] : (intervals[middle - 1] + intervals[middle]) / 2
  const bpm = median > 0 ? Math.round(60_000 / median) : null
  return { bpm, count: taps.length, ready: bpm !== null && taps.length >= TAP.minTaps && validTempo(bpm), anchor }
}
