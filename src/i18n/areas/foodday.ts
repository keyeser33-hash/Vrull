import type { Messages, TranslationOf } from '../translate'

// Ushqimi i ri, dita (V59, SPEC §0.3h, V2-E3-28; bordet "0.42 · Ushqimi i ri"): rripi i suplementeve, vija e kohës, fleta e vaktit, fusha "Çfarë hëngre?". Çelësat: 'foodday.*'.
// Një skedar për zonë, që detyrat paralele të mos prekin të njëjtin skedar; sq.ts dhe en.ts i bashkojnë.

export const sq = {
  'foodday.area': 'Dita e ushqimit',
} as const satisfies Messages

export const en: TranslationOf<typeof sq> = {
  'foodday.area': 'Food day',
}
