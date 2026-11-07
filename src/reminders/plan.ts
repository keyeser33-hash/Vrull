import { JIM_FOODS, JIM_MEALS } from '@/nutrition/jim'
import { MEAL_LABEL } from '@/nutrition/meals'
import { mealSchedule } from '@/nutrition/schedule'
import type { SupplementDef } from '@/nutrition/supplements'
import type { DayType } from '@/nutrition/targets'

// Rikujtuesit (SPEC §13), pa UI: njoftimet e ditëve të ardhshme sipas orarit të vakteve, të
// suplementeve, të stërvitjes dhe të matjes javore. Telefoni i planifikon dhe i rinovon sa herë
// hapet app-i ose ndryshojnë cilësimet, stërvitja e radhës ose suplementet.

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
  /** "Java 2 · Stërvitja 3": stërvitja e radhës, për ditën e parë të stërvitjes. */
  nextWorkoutLabel: string | null
  supplements: (SupplementDef & { id: string; enabled: boolean })[]
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
  const result = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes)
  // Pas mesnate (gjumi pas orës 24): dita e nesërme.
  if (hours < 4) result.setDate(result.getDate() + 1)
  return result
}
const addMinutes = (time: string, minutes: number) => {
  const [hours, mins] = time.split(':').map(Number)
  const total = (((hours * 60 + mins + minutes) % 1440) + 1440) % 1440
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`
}
const sentence = (names: string[]) => names.map((name, index) => (index === 0 ? name : name.toLowerCase())).join(', ')

export function planReminders(input: ReminderInput): Reminder[] {
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
      dayItems.push({ at: at(day, input.wakeTime), title: 'Matja e javës', body: 'Pesha para mëngjesit, perimetrat dhe fotot.', kind: 'measurement' })
    }
    if (input.toggles.training && training) {
      const title = !labelUsed && input.nextWorkoutLabel ? `Sot: ${input.nextWorkoutLabel}` : 'Sot ke stërvitje'
      labelUsed = true
      dayItems.push({ at: at(day, addMinutes(input.wakeTime, 30)), title, body: `Stërvitja ${input.trainingTime}`, kind: 'training' })
    }
    for (const { meal, time } of mealSchedule({ wakeTime: input.wakeTime, sleepTime: input.sleepTime, trainingTime: training ? input.trainingTime : null })) {
      const supplements = input.toggles.supplements ? input.supplements.filter((item) => item.enabled && item.timing.includes(meal)).map((item) => item.name) : []
      const foods = (JIM_MEALS[meal] ?? []).map((item) => JIM_FOODS[item.food].name)
      if (input.toggles.meals && foods.length > 0) {
        const extra = supplements.length > 0 ? ` · me ${supplements.map((name) => name.toLowerCase()).join(', ')}` : ''
        dayItems.push({ at: at(day, time), title: MEAL_LABEL[meal], body: `${sentence(foods)}${extra}`, kind: 'meal' })
      } else if (supplements.length > 0) {
        dayItems.push({ at: at(day, time), title: `Suplementet · ${MEAL_LABEL[meal]}`, body: supplements.join(', '), kind: 'supplements' })
      }
    }
    dayItems.forEach((item, index) => {
      if (item.at > input.from) reminders.push({ ...item, id: idBase + index })
    })
  }
  return reminders.sort((a, b) => a.at.getTime() - b.at.getTime() || a.id - b.id)
}
