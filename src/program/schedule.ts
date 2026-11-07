// Radha ecën sipas stërvitjeve, jo sipas kalendarit (SPEC §4, Q3). Për hapat e parë tregohet
// vetëm si bie java e parë në ditët e zgjedhura.

/** Stërvitja që bie në çdo ditë të zgjedhur gjatë javës së parë (ditët ISO, 1 = e hënë). */
export function firstWeek(trainingDays: number[], workoutsPerWeek: number): { day: number; workout: number }[] {
  return [...trainingDays].sort((a, b) => a - b).map((day, index) => ({ day, workout: (index % workoutsPerWeek) + 1 }))
}
