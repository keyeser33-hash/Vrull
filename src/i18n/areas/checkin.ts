import type { Messages, TranslationOf } from '../translate'

// Check-in-i i mëngjesit (V50, V2-E3-04; SPEC §0.3d, bordet "Sot · Si ndihesh sot?" dhe "Gjendja e ditës"): karta te Sot
// dhe fleta me katër pyetjet. Çelësat: 'checkin.*'.
// Një skedar për zonë, që detyrat paralele të mos prekin të njëjtin skedar; sq.ts dhe en.ts i bashkojnë.

export const sq = {
  'checkin.title': 'Si ndihesh sot?',
} as const satisfies Messages

export const en: TranslationOf<typeof sq> = {
  'checkin.title': 'How are you feeling today?',
}
