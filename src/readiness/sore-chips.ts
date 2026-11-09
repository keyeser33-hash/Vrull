// Çipat e dhimbjeve (V50, V2-E3-04): fleta e check-in-it zgjedh çipa, ndërsa gjendja ruan id-të e grupeve të muskujve
// (`MUSCLE_GROUPS`). Logjikë e pastër, pa UI; i përdorin fleta, fjalia e sugjerimit dhe rreshti i dhimbjeve te "Gati".

/** Çdo çip ruan id-të e grupeve të muskujve, jo vetë çipin; çdo grup bie te saktësisht një çip. */
export const SORE_CHIPS = [
  { id: 'gjoksi', groups: ['gjoksi'] },
  { id: 'shpina', groups: ['shpina', 'mesi', 'trapezi'] },
  { id: 'shpatullat', groups: ['shpatullat'] },
  { id: 'qafa', groups: ['qafa'] },
  { id: 'krahet', groups: ['bicepsi', 'tricepsi', 'parakrahet'] },
  { id: 'kembet', groups: ['kuadricepsi', 'kofshet-e-pasme', 'pulpat', 'vithet', 'aduktoret'] },
  { id: 'barku', groups: ['barku'] },
] as const

export type SoreChip = (typeof SORE_CHIPS)[number]['id']

/** Çipat e ndezur për grupet e ruajtura: një çip është i ndezur kur ka të paktën një nga grupet e tij. */
export function chipsOf(groups: readonly string[]): SoreChip[] {
  return SORE_CHIPS.filter((chip) => chip.groups.some((group) => groups.includes(group))).map((chip) => chip.id)
}

/** Id-të e grupeve për çipat e zgjedhur, pa përsëritje, sipas radhës së çipave. */
export function groupsOf(chips: readonly SoreChip[]): string[] {
  return SORE_CHIPS.filter((chip) => chips.includes(chip.id)).flatMap((chip) => [...chip.groups])
}
