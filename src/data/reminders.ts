import type { ReminderInput, ReminderToggles } from '@/reminders/plan'
import type { DayType } from '@/nutrition/targets'
import { readProfile } from './profile'
import type { LocalStore } from './store'
import { supplementList } from './supplements'
import { trainingSnapshot } from './training'

// Cilësimet e rikujtuesve (SPEC §13) dhe të dhënat që u duhen për t'u planifikuar.

export interface ReminderSettings {
  toggles: ReminderToggles
  /** Dita ISO e matjes javore (7 = e diel). */
  measurementDay: number
}

const DEFAULT_TOGGLES: ReminderToggles = { meals: true, supplements: true, training: true, measurements: true }

async function settingsRow(store: LocalStore) {
  return (await store.all('user_settings'))[0]
}

export async function reminderSettings(store: LocalStore): Promise<ReminderSettings> {
  const row = await settingsRow(store)
  const saved = (row?.reminders as Partial<ReminderToggles> | undefined) ?? {}
  return { toggles: { ...DEFAULT_TOGGLES, ...saved }, measurementDay: Number(row?.measurement_day ?? 7) }
}

export async function setReminderToggle(store: LocalStore, key: keyof ReminderToggles, on: boolean) {
  const row = await settingsRow(store)
  const { toggles } = await reminderSettings(store)
  await store.put('user_settings', { id: row?.id, reminders: { ...toggles, [key]: on } })
}

export async function setMeasurementDay(store: LocalStore, day: number) {
  const row = await settingsRow(store)
  await store.put('user_settings', { id: row?.id, measurement_day: day })
}

/** Gjithçka që i duhet planit të rikujtuesve për 7 ditët nga `now`. */
export async function reminderInput(store: LocalStore, now: Date): Promise<ReminderInput> {
  const [profile, settings, supplements, snapshot, targets] = await Promise.all([
    readProfile(store),
    reminderSettings(store),
    supplementList(store),
    trainingSnapshot(store),
    store.all('nutrition_targets'),
  ])
  return {
    from: now,
    days: 7,
    wakeTime: profile.wakeTime,
    sleepTime: profile.sleepTime,
    trainingTime: profile.trainingTime,
    trainingDays: profile.trainingDays,
    toggles: settings.toggles,
    measurementDay: settings.measurementDay,
    nextWorkoutLabel: snapshot && !snapshot.pointer.completed ? `${snapshot.label} · Stërvitja ${snapshot.plan.dayNumber}` : null,
    supplements,
    dayTypes: Object.fromEntries(targets.filter((row) => row.is_manual).map((row) => [String(row.date), row.day_type as DayType])),
  }
}
