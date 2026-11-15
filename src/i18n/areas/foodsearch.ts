import type { Messages, TranslationOf } from '../translate'

// Ushqimi i ri, kërkimi (V59, SPEC §0.3h, V2-E3-28; bordet "0.42 · Ushqimi i ri"): kërkimi pa shkrim dhe me shkrim, sasia, shporta. Çelësat: 'foodsearch.*'.
// Një skedar për zonë, që detyrat paralele të mos prekin të njëjtin skedar; sq.ts dhe en.ts i bashkojnë.

export const sq = {
  'foodsearch.area': 'Kërkimi i ushqimit',
} as const satisfies Messages

export const en: TranslationOf<typeof sq> = {
  'foodsearch.area': 'Food search',
}
