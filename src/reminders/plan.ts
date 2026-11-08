import type { I18n } from '@/i18n'
import { foodName, mealName, nameInSentence, programWeekLabel, supplementName } from '@/i18n/domain'
import { JIM_FOODS, JIM_MEALS } from '@/nutrition/jim'
import { mealSchedule } from '@/nutrition/schedule'
import type { SupplementDef } from '@/nutrition/supplements'
import type { DayType } from '@/nutrition/targets'

// Rikujtuesit (SPEC §13), pa UI: njoftimet e ditëve të ardhshme sipas orarit të vakteve, të
// suplementeve, të stërvitjes dhe të matjes javore. Telefoni i planifikon dhe i rinovon sa herë
// hapet app-i ose ndryshojnë cilësimet, stërvitja e radhës ose suplementet. Tekstet vijnë në gjuhën
// e app-it në kohën e planifikimit ('reminders.notify.*'), si njoftimi i pushimit.

/** Stërvitja e radhës, që njoftimi i mëngjesit ta thotë: "Faza 1 · Java 2 · Stërvitja 3". */
export interface NextWorkout {
  blockName: string | null
  blockWeeks: number
  week: number
  run: number
  dayNumber: number
}

export interface ReminderToggles {
  meals: boolean
  supplements: boolean
  training: boolean
  measurements: boolean
}

export interface ReminderInput {
  from: Date
  days: number
  wakeTime: string
  sleepTime: string
  trainingTime: string
  /** Ditët ISO (1 = e hënë ... 7 = e diel). */
  trainingDays: number[]
  toggles: ReminderToggles
  measurementDay: number
  /** Stërvitja e radhës, për ditën e parë të stërvitjes. */
  nextWorkout: NextWorkout | null
  supplements: (Omit<SupplementDef, 'key'> & { id: string; enabled: boolean })[]
  /** Llojet e ditëve të ndryshuara me dorë, sipas datës. */
  dayTypes: Record<string, DayType>
}

export interface Reminder {
  id: number
  at: Date
  title: string
  body: string
  kind: 'meal' | 'supplements' | 'training' | 'measurement'
}

/** Id-të e rikujtuesve: 5000–5199 (timer-i i pushimit ka 4201). */
export const REMINDER_IDS = { first: 5000, last: 5199 }

const pad = (value: number) => String(value).padStart(2, '0')
const isoDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
const at = (day: Date, time: string) => {
  const [hours, minutes] = time.split(':').map(Number)
  // Zgjimi dhe stërvitja e mëngjesit; vaktet pas mesnate vijnë nga minutat e orarit (V46).
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes)
}
const addMinutes = (time: string, minutes: number) => {
  const [hours, mins] = time.split(':').map(Number)
  const total = (((hours * 60 + mins + minutes) % 1440) + 1440) % 1440
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`
}
export function planReminders(input: ReminderInput, { t, fmt, lang }: Pick<I18n, 't' | 'fmt' | 'lang'>): Reminder[] {
  const lower = (name: string) => nameInSentence(name, lang)
  const sentence = (names: string[]) => names.map((name, index) => (index === 0 ? name : lower(name))).join(', ')
  const workoutLabel = input.nextWorkout
    ? t('reminders.notify.workoutLabel', { week: programWeekLabel(t, input.nextWorkout), day: String(input.nextWorkout.dayNumber) })
    : null
  const reminders: Reminder[] = []
  let labelUsed = false
  for (let offset = 0; offset < input.days; offset++) {
    const day = new Date(input.from.getFullYear(), input.from.getMonth(), input.from.getDate() + offset)
    const date = isoDate(day)
    const weekday = day.getDay() || 7
    const training = (input.dayTypes[date] ?? (input.trainingDays.includes(weekday) ? 'training' : 'rest')) === 'training'
    const idBase = REMINDER_IDS.first + offset * 20
    const dayItems: Omit<Reminder, 'id'>[] = []

    if (input.toggles.measurements && weekday === input.measurementDay) {
      dayItems.push({ at: at(day, input.wakeTime), title: t('reminders.notify.measurement'), body: t('reminders.notify.measurementText'), kind: 'measurement' })
    }
    if (input.toggles.training && training) {
      const title = !labelUsed && workoutLabel ? t('reminders.notify.workout', { label: workoutLabel }) : t('reminders.notify.workoutToday')
      labelUsed = true
      // Ora e stërvitjes me formatin e gjuhës (24 orë në të dyja).
      const [hours, minutes] = input.trainingTime.split(':').map(Number)
      const trainingAt = fmt.time(new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes))
      dayItems.push({ at: at(day, addMinutes(input.wakeTime, 30)), title, body: t('reminders.notify.workoutAt', { time: trainingAt }), kind: 'training' })
    }
    for (const { meal, minutes } of mealSchedule({ wakeTime: input.wakeTime, sleepTime: input.sleepTime, trainingTime: training ? input.trainingTime : null })) {
      // Minutat e ditës: një vakt pas mesnate bie të nesërmen kalendarike, por i përket kësaj dite (V46).
      const mealAt = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, minutes)
      const supplements = input.toggles.supplements
        ? input.supplements.filter((item) => item.enabled && item.timing.includes(meal)).map((item) => supplementName(t, item.name))
        : []
      const foods = (JIM_MEALS[meal] ?? []).map((item) => foodName(t, { name: JIM_FOODS[item.food].name, sourceId: `jim:${item.food}` }))
      if (input.toggles.meals && foods.length > 0) {
        const body = supplements.length > 0 ? t('reminders.notify.mealWith', { foods: sentence(foods), supplements: supplements.map(lower).join(', ') }) : sentence(foods)
        dayItems.push({ at: mealAt, title: mealName(t, meal), body, kind: 'meal' })
      } else if (supplements.length > 0) {
        dayItems.push({ at: mealAt, title: t('reminders.notify.supplements', { meal: mealName(t, meal) }), body: supplements.join(', '), kind: 'supplements' })
      }
    }
    dayItems.forEach((item, index) => {
      if (item.at > input.from) reminders.push({ ...item, id: idBase + index })
    })
  }
  return reminders.sort((a, b) => a.at.getTime() - b.at.getTime() || a.id - b.id)
}
