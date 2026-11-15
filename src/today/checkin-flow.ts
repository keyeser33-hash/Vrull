import { type CheckInAnswers, type DailyState, normalizeCheckIn, type Scale, type Soreness } from '@/data/daily-state'

// Rrjedha e gjendjes së ditës si story (V57, SPEC §0.3f), pa UI dhe pa bazë: katër pyetjet e §0.3d, cila ka përgjigje,
// cila hapet e para, dhe kur përgjigjet mjaftojnë për një rresht të plotë. Një përgjigje ruhet sapo jepet (skica në
// telefon); rreshti i `daily_states` shkruhet kur janë të katërta, me të njëjtën `saveDailyState` si fleta e vjetër.

export const QUESTIONS = ['mood', 'energy', 'sleep', 'soreness'] as const
export type Question = (typeof QUESTIONS)[number]

/** Përgjigjet e dhëna deri tani; gjumi ka dy fusha që jepen bashkë ("Tjetra"). */
export interface Draft {
  mood?: Scale
  energy?: Scale
  sleepMinutes?: number
  sleepQuality?: Scale
  soreness?: Soreness
  soreGroups?: string[]
}

export function answeredQuestions(draft: Draft): Record<Question, boolean> {
  return {
    mood: draft.mood !== undefined,
    energy: draft.energy !== undefined,
    sleep: draft.sleepMinutes !== undefined && draft.sleepQuality !== undefined,
    soreness: draft.soreness !== undefined,
  }
}

/** Indeksi i story-t që hapet: pyetja e parë pa përgjigje (0–3), ose 4 (gatishmëria) kur janë të katërta. */
export function firstOpenQuestion(draft: Draft): number {
  const answered = answeredQuestions(draft)
  const index = QUESTIONS.findIndex((question) => !answered[question])
  return index === -1 ? QUESTIONS.length : index
}

/** Përgjigjet e plota e të normalizuara, ose null kur ndonjë pyetje mungon. */
export function completeAnswers(draft: Draft): CheckInAnswers | null {
  const answered = answeredQuestions(draft)
  if (!QUESTIONS.every((question) => answered[question])) return null
  return normalizeCheckIn({
    mood: draft.mood!,
    energy: draft.energy!,
    sleepMinutes: draft.sleepMinutes!,
    sleepQuality: draft.sleepQuality!,
    soreness: draft.soreness!,
    soreGroups: draft.soreGroups ?? [],
  })
}

/** Rreshti i ruajtur ka përparësi (është i plotë); pa të, skica e telefonit. */
export function draftOf(state: DailyState | null, stored: Draft): Draft {
  if (!state) return stored
  return { mood: state.mood, energy: state.energy, sleepMinutes: state.sleepMinutes, sleepQuality: state.sleepQuality, soreness: state.soreness, soreGroups: state.soreGroups }
}
