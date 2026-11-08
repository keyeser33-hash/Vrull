import type { Messages, TranslationOf } from '../translate'

// Programi dhe peshat e javës (V2-E1-09; bordet "Programi", "KrijoUshtrim"). Çelësat: 'programme.*'.
// Një skedar për zonë, që detyrat paralele të mos prekin të njëjtin skedar; sq.ts dhe en.ts i bashkojnë.
// Shqipja është burimi i çelësave; anglishtja britanike ndjek të njëjtat çelësa dhe parametra.

export const sq = {} as const satisfies Messages

export const en: TranslationOf<typeof sq> = {}
