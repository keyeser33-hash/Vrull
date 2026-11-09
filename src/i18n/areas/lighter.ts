import type { Messages, TranslationOf } from '../translate'

// Sugjerimi dhe seanca më e lehtë (V50, V2-E3-06; bordet "Sot · Gatishmëria e ulët", "Seanca më e lehtë",
// "Sot · Stërvitja shtyhet për nesër"). Çelësat: 'lighter.*'.
// Një skedar për zonë, që detyrat paralele të mos prekin të njëjtin skedar; sq.ts dhe en.ts i bashkojnë.

export const sq = {
  'lighter.title': 'Seanca më e lehtë',
} as const satisfies Messages

export const en: TranslationOf<typeof sq> = {
  'lighter.title': 'Lighter session',
}
