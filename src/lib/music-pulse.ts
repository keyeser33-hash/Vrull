import { validTempo } from './music-tempo'

// Pulsi i "Trupit në ritëm" dhe kënga e radhës (SPEC V29, docs/research/muzika.md §2.3, §5). Pulsi
// është ndërrim CSS i dy pamjeve të trupit me periudhë 60/BPM; ndjek tempon, jo goditjet. Gjatë
// pushimit periudha dyfishohet (gjysma e tempos). Ndalet kur app-i del në sfond ose ekrani fiket; me
// "lëvizje të reduktuar" trupi rri i ndezur pa pulsuar. Kënga nuk ndërrohet kurrë vetë.

export type BeatPhase = 'set' | 'rest'

/** Setet: 120–140 BPM për këngë që njihen, me fjalë (Jones, Karageorghis et al. 2024; Terry et al. 2020). */
export const SET_TEMPO = { min: 120, max: 140, ideal: 130, ceiling: 150 } as const

export interface PulseInput {
  bpm: number | null
  phase: BeatPhase
  /** Muzika luan (jo në pauzë). */
  playing: boolean
  /** Faqja duket dhe app-i është përpara. */
  active: boolean
  reducedMotion: boolean
}

export interface Pulse {
  /** Trupi pulson (përndryshe rri i ndezur). */
  animate: boolean
  /** Animacioni ecën; false = i ndalur (`animation-play-state: paused`). */
  running: boolean
  /** Periudha e një goditjeje të trupit; null pa tempo. */
  periodMs: number | null
}

export function pulse({ bpm, phase, playing, active, reducedMotion }: PulseInput): Pulse {
  const periodMs = bpm !== null && validTempo(bpm) ? (60_000 / bpm) * (phase === 'rest' ? 2 : 1) : null
  const animate = periodMs !== null && playing && !reducedMotion
  return { animate, running: animate && active, periodMs }
}

/** Sa ms brenda goditjes jemi tani, nga prekja e fundit e "Prek ritmin"; 0 pa fazë të njohur. */
export function beatPhaseMs(periodMs: number, anchor: number | null, now: number): number {
  if (anchor === null || periodMs <= 0) return 0
  return (((now - anchor) % periodMs) + periodMs) % periodMs
}

type WithTempo = { bpm: number | null }
const known = <T extends WithTempo>(songs: T[]) => songs.filter((song): song is T & { bpm: number } => song.bpm !== null && validTempo(song.bpm))

/** Për setin: brenda 120–140 më afër 130; përndryshe më e larta nën 150. */
export function pickSetSong<T extends WithTempo>(songs: T[]): T | null {
  const candidates = known(songs)
  const inside = candidates.filter((song) => song.bpm >= SET_TEMPO.min && song.bpm <= SET_TEMPO.max)
  if (inside.length > 0) return inside.reduce((best, song) => (Math.abs(song.bpm - SET_TEMPO.ideal) < Math.abs(best.bpm - SET_TEMPO.ideal) ? song : best))
  const below = candidates.filter((song) => song.bpm < SET_TEMPO.ceiling)
  return below.length > 0 ? below.reduce((best, song) => (song.bpm > best.bpm ? song : best)) : null
}

/** Për pushimin: më e qeta nën tempon e këngës që luan (ose nën 120 kur ajo s'ka tempo). */
export function pickRestSong<T extends WithTempo>(songs: T[], currentBpm: number | null): T | null {
  const limit = currentBpm ?? SET_TEMPO.min
  const calmer = known(songs).filter((song) => song.bpm < limit)
  return calmer.length > 0 ? calmer.reduce((best, song) => (song.bpm < best.bpm ? song : best)) : null
}

/** Kur fillon seti: kënga nën tempon e setit ose pa tempo merr ofertën për një më energjike. */
export const wantsEnergy = (bpm: number | null) => bpm === null || bpm < SET_TEMPO.min
