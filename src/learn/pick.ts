import { exerciseFacts, type Fact, foodFacts, RECOVERY_FACTS } from './facts'

// "A e dije?" pa UI dhe pa bazë (V56, V57, SPEC §0.3e): cilët fakte vlejnë për një vend dhe cili del sot. Një fakt në
// ditë ushqimi (V46) në secilin vend; ruajtja e faktit të parë (tabela `learn_events`) është te `data/learn.ts`.
// Te Sot: faktet e ushtrimeve të stërvitjes së sotme, në ditë pushimi rikuperimi. Te pushimi: ushtrimi aktual. Pas
// ushqimit: ushqimet e regjistruara sot, i fundit i pari. Një fakt nuk përsëritet në një vend derisa të jenë parë të
// gjithë faktet e tij: zgjidhet ai që është parë më pak herë aty, pastaj ai i parë më herët, pastaj radha.

export type FactPlace = 'today' | 'rest' | 'food'

export const FACT_PLACES: readonly FactPlace[] = ['today', 'rest', 'food']

/** Një fakt i parë: dita e ushqimit, vendi dhe fakti. */
export interface SeenFact {
  factId: string
  date: string
  place: FactPlace
}

const unique = (facts: readonly Fact[]) => [...new Map(facts.map((fact) => [fact.id, fact])).values()]

/**
 * Sot: faktet e ushtrimeve të stërvitjes së sotme, me radhën e stërvitjes. Pa stërvitje (pushim, program i
 * mbaruar) ose me ushtrime pa asnjë fakt: faktet e rikuperimit.
 */
export function todayCandidates(exercises: readonly string[] | null): Fact[] {
  const facts = unique((exercises ?? []).flatMap(exerciseFacts))
  return facts.length > 0 ? facts : [...RECOVERY_FACTS]
}

/** Pushimi mes seteve: faktet e ushtrimit aktual; bosh kur ushtrimi s'ka fakte. */
export function restCandidates(exercise: string | null | undefined): Fact[] {
  return exercise ? exerciseFacts(exercise) : []
}

/** Pas ushqimit: faktet e ushqimeve të regjistruara (çelësat e Jimit, i fundit i pari); bosh kur s'kanë fakte. */
export function foodCandidates(foods: readonly string[]): Fact[] {
  return unique(foods.flatMap(foodFacts))
}

/**
 * Fakti i ri për një vend nga kandidatët, me historinë e atij vendi (ditët e mëparshme). Zgjidhet ai i parë më pak
 * herë, pastaj ai i parë më herët (ose kurrë), pastaj radha e kandidatëve. Null pa kandidatë.
 */
export function pickFact(candidates: readonly Fact[], history: readonly SeenFact[]): Fact | null {
  const count = new Map<string, number>()
  const last = new Map<string, string>()
  for (const entry of history) {
    count.set(entry.factId, (count.get(entry.factId) ?? 0) + 1)
    if (entry.date > (last.get(entry.factId) ?? '')) last.set(entry.factId, entry.date)
  }
  let best: { fact: Fact; count: number; last: string } | null = null
  for (const fact of candidates) {
    const entry = { fact, count: count.get(fact.id) ?? 0, last: last.get(fact.id) ?? '' }
    if (!best || entry.count < best.count || (entry.count === best.count && entry.last < best.last)) best = entry
  }
  return best?.fact ?? null
}
