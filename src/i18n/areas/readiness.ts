import type { Messages, TranslationOf } from '../translate'

// Gatishmëria (V50, V2-E3-05; bordi "Fleta Gati"): pllaka te Sot dhe fleta me pesë pjesët dhe 14 ditët.
// Çelësat: 'readiness.*'.
// Një skedar për zonë, që detyrat paralele të mos prekin të njëjtin skedar; sq.ts dhe en.ts i bashkojnë.

export const sq = {
  'readiness.tile': 'Gati',
} as const satisfies Messages

export const en: TranslationOf<typeof sq> = {
  'readiness.tile': 'Ready',
}
