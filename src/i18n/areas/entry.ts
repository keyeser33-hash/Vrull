import type { Messages, TranslationOf } from '../translate'

// Hyrja dhe hapat e parë (V2-E1-17; bordet "Hyrja · Hyr", "Hapja", "Gjuha dhe pesha", "Ditët dhe oraret",
// "Programi"). Çelësat: 'entry.*'. Çelësat e vjetër 'login.*', 'auth.*', 'fetch.*' mbeten te baza.
// Një skedar për zonë, që detyrat paralele të mos prekin të njëjtin skedar; sq.ts dhe en.ts i bashkojnë.
// Shqipja është burimi i çelësave; anglishtja britanike ndjek të njëjtat çelësa dhe parametra.

export const sq = {} as const satisfies Messages

export const en: TranslationOf<typeof sq> = {}
