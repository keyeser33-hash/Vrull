import type { Messages, TranslationOf } from '../translate'

// Pamja e ditës (V20, V50, V2-E3-07; bordet "Sot · Gatishmëria e ulët", "Sot · Gatishmëria e lartë" dhe "Cilësimet · Pamja ndjek gjendjen"):
// tekstet e pamjes së lodhur dhe të ditës me energji, dhe çelësi te Cilësimet › Pamja. Çelësat: 'daymode.*'.
// Një skedar për zonë, që detyrat paralele të mos prekin të njëjtin skedar; sq.ts dhe en.ts i bashkojnë.

export const sq = {
  'daymode.follow': 'Pamja ndjek gjendjen',
  'daymode.followDetail': 'Në ditë me gatishmëri të ulët: rërë në vend të prushit, lëvizje e qetë, pa festime. Historia nuk ndryshon.',
  'daymode.tired': 'Ritëm i butë sot.',
  'daymode.energetic': 'Je në formë sot. Shko fort.',
  'daymode.sampleUsual': 'Ditë e zakonshme',
  'daymode.sampleTired': 'Ditë e lodhur',
  'daymode.sampleNote': 'Mostër: ky është ilustrim, nuk prek.',
  'daymode.sampleLabel': 'Mostër, jo veprim: dy butona, Ditë e zakonshme në prush dhe Ditë e lodhur në rërë',
} as const satisfies Messages

export const en: TranslationOf<typeof sq> = {
  'daymode.follow': 'Look follows how you feel',
  'daymode.followDetail': 'On low-readiness days: sand instead of ember, calmer motion, no celebrations. History does not change.',
  'daymode.tired': 'Gentle pace today.',
  'daymode.energetic': 'You are in form today. Go hard.',
  'daymode.sampleUsual': 'Usual day',
  'daymode.sampleTired': 'Tired day',
  'daymode.sampleNote': 'Sample: an illustration, not tappable.',
  'daymode.sampleLabel': 'Sample, not an action: two buttons, Usual day in ember and Tired day in sand',
}
