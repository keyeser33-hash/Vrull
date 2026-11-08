import type { Messages, TranslationOf } from '../translate'

// Trupi 3D dhe matjet (V2-E1-14; bordet "Trupi", "ShtoMatjen"). Çelësat: 'bodyModel.*', 'measure.*'.
// Një skedar për zonë, që detyrat paralele të mos prekin të njëjtin skedar; sq.ts dhe en.ts i bashkojnë.
// Shqipja është burimi i çelësave; anglishtja britanike ndjek të njëjtat çelësa dhe parametra.

export const sq = {} as const satisfies Messages

export const en: TranslationOf<typeof sq> = {}
