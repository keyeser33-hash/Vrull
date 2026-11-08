// Java e programit në kalendar (V2-E1-09, bordi "Programi"): kohëzgjatja e përafërt e një
// stërvitjeje dhe datat e stërvitjeve që vijnë sipas ditëve të stërvitjes. Radha ecën sipas
// stërvitjeve (Q3), ndaj datat janë parashikim: një ditë e humbur i shtyn të gjitha.

/** Koha e një seti pune, pa pushimin: përsëritjet, vendosja e peshës dhe kalimi te tjetri. */
const SET_SECONDS = 45

/** Minutat e përafërta: çdo set 45 s plus pushimi i tij, rrumbullakuar te 5 minutat (të paktën 5). */
export function workoutMinutes(slots: { sets: number; restSeconds: number }[]): number {
  const seconds = slots.reduce((total, slot) => total + slot.sets * (SET_SECONDS + slot.restSeconds), 0)
  if (seconds === 0) return 0
  return Math.max(5, Math.round(seconds / 300) * 5)
}

/** Dita ISO e javës: 1 = e hënë … 7 = e diel. */
const isoWeekday = (date: Date) => ((date.getDay() + 6) % 7) + 1

/**
 * Datat e `count` stërvitjeve që vijnë, me radhë: e para sot kur sot është ditë stërvitjeje dhe
 * s'është bërë ende një stërvitje sot, përndryshe dita e parë e stërvitjes që vjen.
 */
export function upcomingDates(input: { count: number; trainingDays: number[]; today: Date; trainedToday: boolean }): Date[] {
  const days = new Set(input.trainingDays)
  if (days.size === 0) return []
  const dates: Date[] = []
  const cursor = new Date(input.today.getFullYear(), input.today.getMonth(), input.today.getDate())
  if (input.trainedToday) cursor.setDate(cursor.getDate() + 1)
  while (dates.length < input.count) {
    if (days.has(isoWeekday(cursor))) dates.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates
}
