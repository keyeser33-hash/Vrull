// Disqet për anë te tastiera e peshës (bordi "Seanca · tastiera"), pa UI: shufra olimpike 20 kg dhe disqet
// e zakonshme të palestrës, më të mëdhenjtë së pari. Vetëm për ushtrimet me shufër; një peshë që disqet
// nuk e bëjnë (61 kg) ose nën shufrën nuk tregohet. Shufra mund të jetë 15, 10 kg ose 0 (pa shufër).

export const BAR_KG = 20
/** Shufrat që zgjedh përdoruesi (bordi "Seanca · tastiera"): olimpike 20, 15, 10 kg, ose pa shufër (0). */
export const BAR_OPTIONS = [20, 15, 10, 0] as const
export const isBarKg = (value: unknown): value is (typeof BAR_OPTIONS)[number] => (BAR_OPTIONS as readonly unknown[]).includes(value)
export const PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25] as const

export interface PlateSplit {
  barKg: number
  perSideKg: number
  plates: number[]
}

/** Hundredat e kilogramit, që 21,25 − 20 të mos japë 1,2499999. */
const cents = (value: number) => Math.round(value * 100)

export function platesPerSide(totalKg: number, barKg: number = BAR_KG, plates: readonly number[] = PLATES_KG): PlateSplit | null {
  if (!Number.isFinite(totalKg) || totalKg < barKg) return null
  const perSide = cents(totalKg - barKg) / 2
  if (!Number.isInteger(perSide)) return null
  let left = perSide
  const used: number[] = []
  for (const plate of plates) {
    const size = cents(plate)
    while (left >= size) {
      used.push(plate)
      left -= size
    }
  }
  return left === 0 ? { barKg, perSideKg: perSide / 100, plates: used } : null
}
