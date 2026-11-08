import type { Messages, TranslationOf } from '../translate'

// Njoftimi i seancës dhe seti nga njoftimi (V2-E1-08; bordi "Seanca · Njoftimi"). Çelësat: 'notify.*'.
// Një skedar për zonë, që detyrat paralele të mos prekin të njëjtin skedar; sq.ts dhe en.ts i bashkojnë.
// Shqipja është burimi i çelësave; anglishtja britanike ndjek të njëjtat çelësa dhe parametra.
// Teksti i njoftimit vjen gjithnjë nga këtu, në gjuhën e app-it: plugin-i native i ruan bashkë me
// gjendjen (lib/session-notification.ts), që njoftimi të mbetet në atë gjuhë edhe pa WebView.

export const sq = {
  // Kanali i Android-it (Cilësimet e sistemit › Njoftimet) dhe kreu i njoftimit ("Vrull · Seanca · 09:45").
  'notify.channel': 'Seanca në vazhdim',
  'notify.channelText': 'Seti i radhës dhe pushimi gjatë stërvitjes, edhe në ekranin e kyçur',
  'notify.session': 'Seanca',
  'notify.title': '{exercise} · Seti {set} nga {sets}',
  'notify.segment.restPause': '{exercise} · Seti {set} · rest-pause',
  'notify.segment.dropSet': '{exercise} · Seti {set} · drop set',
  'notify.target': 'Synimi {range}',
  'notify.toFailure': 'Deri në dështim',
  // Butoni i njoftimit të mbledhur, ku "Ruaj setin" nuk zë vend.
  'notify.saveShort': 'Ruaj',
  'notify.edit': 'Ndrysho',
  'notify.skipRest': 'Kapërce pushimin',
  // Kur njoftimi s'ka më sete të llogaritura (shumë sete të ruajtura pa e hapur app-in).
  'notify.openApp': 'Hap Vrull për setin tjetër',
  // {time} bëhet kronometri i Android-it, që numëron vetë edhe kur app-i fle.
  'notify.restEnds': 'Pushimi mbaron për {time}',
  'notify.repsLower': 'Ul përsëritjet',
  'notify.repsRaise': 'Rrit përsëritjet',
  'notify.secondsLower': 'Ul sekondat',
  'notify.secondsRaise': 'Rrit sekondat',
  // Njësia pranë numrit të madh; numrin e vendos njoftimi, ndaj forma zgjidhet sipas tij.
  'notify.reps': { one: 'përsëritje', other: 'përsëritje' },
  'notify.seconds': { one: 'sekondë', other: 'sekonda' },
} as const satisfies Messages

export const en: TranslationOf<typeof sq> = {
  'notify.channel': 'Session in progress',
  'notify.channelText': 'The next set and the rest during a workout, also on the lock screen',
  'notify.session': 'Session',
  'notify.title': '{exercise} · Set {set} of {sets}',
  'notify.segment.restPause': '{exercise} · Set {set} · rest-pause',
  'notify.segment.dropSet': '{exercise} · Set {set} · drop set',
  'notify.target': 'Target {range}',
  'notify.toFailure': 'To failure',
  'notify.saveShort': 'Log',
  'notify.edit': 'Edit',
  'notify.skipRest': 'Skip rest',
  'notify.openApp': 'Open Vrull for the next set',
  'notify.restEnds': 'Rest ends in {time}',
  'notify.repsLower': 'Fewer reps',
  'notify.repsRaise': 'More reps',
  'notify.secondsLower': 'Fewer seconds',
  'notify.secondsRaise': 'More seconds',
  'notify.reps': { one: 'rep', other: 'reps' },
  'notify.seconds': { one: 'second', other: 'seconds' },
}
