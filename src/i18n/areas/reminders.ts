import type { Messages, TranslationOf } from '../translate'

// Rikujtuesit (SPEC §13): Cilësimet › Rikujtuesit dhe njoftimet që planifikon telefoni. Çelësat:
// 'reminders.*'. Teksti i njoftimit merret në gjuhën e app-it kur planifikohet (`planReminders`), si
// njoftimi i pushimit; app-i i planifikon përsëri sa herë hapet, edhe pas ndërrimit të gjuhës.
// Një skedar për zonë, që detyrat paralele të mos prekin të njëjtin skedar; sq.ts dhe en.ts i bashkojnë.

export const sq = {
  'reminders.allow': 'Lejo njoftimet',
  'reminders.allowDenied': 'Lejoji te cilësimet e telefonit',
  'reminders.allowPrompt': 'Pa leje, rikujtuesit nuk vijnë',
  'reminders.training': 'Stërvitja',
  'reminders.trainingDetail': 'Në mëngjes, stërvitja e radhës',
  'reminders.meals': 'Vaktet',
  'reminders.mealsDetail': 'Në orën e çdo vakti, me artikujt e planit',
  'reminders.supplements': 'Suplementet',
  'reminders.supplementsDetail': 'Bashkë me vaktin ku merren',
  'reminders.measurements': 'Matja javore',
  'reminders.measurementsDetail': 'Pesha, perimetrat dhe fotot',
  'reminders.list.training': 'stërvitja',
  'reminders.list.meals': 'vaktet',
  'reminders.list.supplements': 'suplementet',
  'reminders.list.measurements': 'matjet',
  'reminders.measurementDay': 'Dita e matjes',
  'reminders.measurementDayHint': 'Rikujtuesi vjen në orën e zgjimit, që pesha të matet para mëngjesit.',

  // Kanali i Android-it (Cilësimet e sistemit › Njoftimet).
  'reminders.notify.channel': 'Rikujtuesit',
  'reminders.notify.channelText': 'Vaktet, suplementet, stërvitja dhe matja javore',
  // Njoftimet: titulli, pastaj teksti.
  'reminders.notify.measurement': 'Matja e javës',
  'reminders.notify.measurementText': 'Pesha para mëngjesit, perimetrat dhe fotot.',
  'reminders.notify.workout': 'Sot: {label}',
  'reminders.notify.workoutLabel': '{week} · Stërvitja {day}',
  'reminders.notify.workoutToday': 'Sot ke stërvitje',
  'reminders.notify.workoutAt': 'Stërvitja {time}',
  'reminders.notify.mealWith': '{foods} · me {supplements}',
  'reminders.notify.supplements': 'Suplementet · {meal}',
} as const satisfies Messages

export const en: TranslationOf<typeof sq> = {
  'reminders.allow': 'Allow notifications',
  'reminders.allowDenied': 'Allow them in the phone’s settings',
  'reminders.allowPrompt': 'Without permission, reminders do not arrive',
  'reminders.training': 'Workout',
  'reminders.trainingDetail': 'In the morning, the next workout',
  'reminders.meals': 'Meals',
  'reminders.mealsDetail': 'At each meal time, with the items in the plan',
  'reminders.supplements': 'Supplements',
  'reminders.supplementsDetail': 'Together with the meal they go with',
  'reminders.measurements': 'Weekly measurement',
  'reminders.measurementsDetail': 'Weight, measurements and photos',
  'reminders.list.training': 'workouts',
  'reminders.list.meals': 'meals',
  'reminders.list.supplements': 'supplements',
  'reminders.list.measurements': 'measurements',
  'reminders.measurementDay': 'Measurement day',
  'reminders.measurementDayHint': 'The reminder comes at your wake time, so you weigh yourself before breakfast.',

  'reminders.notify.channel': 'Reminders',
  'reminders.notify.channelText': 'Meals, supplements, workouts and the weekly measurement',
  'reminders.notify.measurement': 'Weekly measurement',
  'reminders.notify.measurementText': 'Weight before breakfast, measurements and photos.',
  'reminders.notify.workout': 'Today: {label}',
  'reminders.notify.workoutLabel': '{week} · Workout {day}',
  'reminders.notify.workoutToday': 'Workout today',
  'reminders.notify.workoutAt': 'Workout at {time}',
  'reminders.notify.mealWith': '{foods} · with {supplements}',
  'reminders.notify.supplements': 'Supplements · {meal}',
}
