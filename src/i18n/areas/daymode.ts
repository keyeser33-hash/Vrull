import type { Messages, TranslationOf } from '../translate'

// Pamja e ditës (V20, V50, V2-E3-07; bordet "Sot · Gatishmëria e lartë" dhe "Cilësimet · Pamja ndjek gjendjen"):
// tekstet e pamjes së lodhur dhe të ditës me energji, dhe çelësi te Cilësimet › Pamja. Çelësat: 'daymode.*'.
// Një skedar për zonë, që detyrat paralele të mos prekin të njëjtin skedar; sq.ts dhe en.ts i bashkojnë.

export const sq = {
  'daymode.follow': 'Pamja ndjek gjendjen',
} as const satisfies Messages

export const en: TranslationOf<typeof sq> = {
  'daymode.follow': 'Look follows how you feel',
}
