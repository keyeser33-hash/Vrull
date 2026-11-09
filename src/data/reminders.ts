import { localDate } from '@/lib/calendar'
import { waterTargetMl } from '@/nutrition/water'
import { ignoredStreaks, MUTE_AFTER_DAYS, type ReminderLogEntry } from '@/reminders/ignored'
import type { MutableKind, ReminderInput, ReminderToggles, SmartInput } from '@/reminders/plan'
import type { DayType } from '@/nutrition/targets'
import { readMissedInput } from './missed-day'
import { type NutritionDay, planDay, targetsWeight } from './nutrition'
import { readProfile } from './profile'
import { readSchedule } from './schedule-settings'
import type { LocalStore } from './store'
import { settingsRow } from './settings-row'
import { supplementFoodIds, supplementList } from './supplements'
import { trainingSnapshot } from './training'

// Cilësimet e rikujtuesve (SPEC §13) dhe të dhënat që u duhen për t'u planifikuar. Të gjitha
// cilësimet rrinë te `user_settings.reminders` (jsonb): çelësat, orët e qeta, llojet e heshtura
// dhe dita kur një lloj u ndez përsëri (V37), pa kolona të reja.

export interface ReminderSettings {
  toggles: ReminderToggles & { water: boolean }
  /** Dita ISO e matjes javore (7 = e diel). */
  measurementDay: number
  /** Intervali i qetë që zgjodhi përdoruesi; null pa interval. */
  quiet: { from: string; to: string } | null
  /** Llojet e heshtura vetë, me datën kur heshtën. */
  muted: Partial<Record<MutableKind, string>>
  /** Dita kur një lloj u ndez përsëri: ditët e injoruara para saj nuk numërohen. */
  resumed: Partial<Record<MutableKind, string>>
}

const DEFAULT_TOGGLES = { meals: true, supplements: true, training: true, measurements: true, water: true }
const TOGGLE_KEYS = Object.keys(DEFAULT_TOGGLES) as (keyof typeof DEFAULT_TOGGLES)[]
const KINDS: readonly MutableKind[] = ['meal', 'supplements', 'water']
const TIME = /^\d{2}:\d{2}$/

const dates = (value: unknown): Partial<Record<MutableKind, string>> => {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  return Object.fromEntries(KINDS.filter((kind) => typeof source[kind] === 'string').map((kind) => [kind, String(source[kind]).slice(0, 10)]))
}

async function rawReminders(store: LocalStore): Promise<{ id: string | undefined; raw: Record<string, unknown> }> {
  const row = await settingsRow(store)
  const raw = row?.reminders && typeof row.reminders === 'object' ? (row.reminders as Record<string, unknown>) : {}
  return { id: row?.id, raw }
}

export async function reminderSettings(store: LocalStore): Promise<ReminderSettings> {
  const row = await settingsRow(store)
  const raw = row?.reminders && typeof row.reminders === 'object' ? (row.reminders as Record<string, unknown>) : {}
  const toggles = { ...DEFAULT_TOGGLES }
  for (const key of TOGGLE_KEYS) if (typeof raw[key] === 'boolean') toggles[key] = raw[key] as boolean
  const quiet = raw.quiet as { from?: unknown; to?: unknown } | null | undefined
  return {
    toggles,
    measurementDay: Number(row?.measurement_day ?? 7),
    quiet: quiet && typeof quiet.from === 'string' && typeof quiet.to === 'string' && TIME.test(quiet.from) && TIME.test(quiet.to) && quiet.from !== quiet.to ? { from: quiet.from, to: quiet.to } : null,
    muted: dates(raw.muted),
    resumed: dates(raw.resumed),
  }
}

async function patchReminders(store: LocalStore, patch: Record<string, unknown>) {
  const { id, raw } = await rawReminders(store)
  await store.put('user_settings', { id, reminders: { ...DEFAULT_TOGGLES, ...raw, ...patch } })
}

export async function setReminderToggle(store: LocalStore, key: keyof ReminderSettings['toggles'], on: boolean) {
  await patchReminders(store, { [key]: on })
}

export async function setQuietHours(store: LocalStore, quiet: { from: string; to: string } | null) {
  await patchReminders(store, { quiet })
}

/** Hesht llojet e injoruara 3 ditë rresht (V37). */
export async function muteReminders(store: LocalStore, kinds: readonly MutableKind[], today: string) {
  if (kinds.length === 0) return
  const { muted } = await reminderSettings(store)
  await patchReminders(store, { muted: { ...muted, ...Object.fromEntries(kinds.map((kind) => [kind, today])) } })
}

/** "Ndize përsëri": lloji vjen sërish dhe ditët e injoruara numërohen nga sot. */
export async function unmuteReminders(store: LocalStore, kind: MutableKind, today: string) {
  const { muted, resumed } = await reminderSettings(store)
  const next = { ...muted }
  delete next[kind]
  await patchReminders(store, { muted: next, resumed: { ...resumed, [kind]: today } })
}

export async function setMeasurementDay(store: LocalStore, day: number) {
  const row = await settingsRow(store)
  await store.put('user_settings', { id: row?.id, measurement_day: day })
}

/** Gjithçka që i duhet planit të rikujtuesve për 7 ditët nga `now`, me rikujtuesit e zgjuar (V37). */
export async function reminderInput(store: LocalStore, now: Date): Promise<ReminderInput> {
  const [profile, settings, supplements, snapshot, targets, schedule, missed] = await Promise.all([
    readProfile(store),
    reminderSettings(store),
    supplementList(store),
    trainingSnapshot(store),
    store.all('nutrition_targets'),
    readSchedule(store),
    readMissedInput(store),
  ])
  const dayTypes = Object.fromEntries(targets.filter((row) => row.is_manual).map((row) => [String(row.date), row.day_type as DayType]))
  return {
    from: now,
    days: 7,
    wakeTime: profile.wakeTime,
    sleepTime: profile.sleepTime,
    trainingTime: profile.trainingTime,
    trainingDays: profile.trainingDays,
    toggles: settings.toggles,
    measurementDay: settings.measurementDay,
    nextWorkout:
      snapshot && !snapshot.pointer.completed
        ? {
            blockName: snapshot.plan.blockName,
            blockWeeks: snapshot.plan.blockWeeks,
            week: snapshot.plan.week,
            run: snapshot.plan.run,
            dayNumber: snapshot.plan.dayNumber,
            dayName: snapshot.plan.dayName,
          }
        : null,
    supplements,
    dayTypes,
    trainingTimes: schedule.trainingTimes,
    mealPlan: schedule.plan,
    startedOn: missed.startedOn,
    sessionDates: missed.sessionDates,
    smart: await smartInput(store, now, settings, profile.trainingDays, dayTypes),
  }
}

/** Rikujtuesit në ditë për vaktet dhe suplementet bashkë (V37); uji ka të vetin, një në ditë. */
export const MAX_DAILY_REMINDERS = 4

async function smartInput(store: LocalStore, now: Date, settings: ReminderSettings, trainingDays: readonly number[], dayTypes: Record<string, DayType>): Promise<SmartInput> {
  // Nga dita e djeshme: vaktet pas mesnate i përkasin asaj.
  const dates = Array.from({ length: 8 }, (_, index) => localDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + index - 1)))
  const [diary, supplementLogs, water, weightKg, trainingDay, restDay, supplementFoods] = await Promise.all([
    Promise.all(dates.map((date) => store.where('diary_entries', 'date', date))),
    Promise.all(dates.map((date) => store.where('supplement_logs', 'date', date))),
    Promise.all(dates.map((date) => store.where('water_logs', 'date', date))),
    targetsWeight(store, localDate(now)),
    planDay(store, 'training', now),
    planDay(store, 'rest', now),
    supplementFoodIds(store),
  ])
  const planOf = (day: NutritionDay) =>
    Object.fromEntries(
      day.meals.map((meal) => [
        meal.meal,
        { items: meal.template.map((line) => ({ name: line.name, sourceId: line.sourceId })), kcal: meal.templateTotals.kcal, proteinG: meal.templateTotals.proteinG },
      ]),
    )
  const typeOf = (date: string) => dayTypes[date] ?? (trainingDays.includes(new Date(`${date}T12:00:00`).getDay() || 7) ? 'training' : 'rest')
  return {
    maxDaily: MAX_DAILY_REMINDERS,
    logged: {
      // Proteina e shënuar "E mora" nuk e bën vaktin të regjistruar.
      meals: diary
        .flat()
        .filter((row) => !supplementFoods.has(String(row.food_id)))
        .map((row) => `${String(row.date)}|${String(row.meal)}`),
      supplements: supplementLogs.flat().map((row) => `${String(row.date)}|${String(row.timing)}|${String(row.supplement_id)}`),
      water: Object.fromEntries(
        dates.map((date, index) => [
          date,
          water[index]
            .map((row) => ({ ml: Number(row.ml ?? 0), at: Date.parse(String(row.logged_at)) }))
            .filter((entry) => entry.ml > 0 && Number.isFinite(entry.at))
            .sort((a, b) => a.at - b.at),
        ]),
      ),
    },
    quiet: settings.quiet,
    muted: Object.fromEntries(Object.keys(settings.muted).map((kind) => [kind, true])),
    waterTargets: weightKg === null ? {} : Object.fromEntries(dates.map((date) => [date, waterTargetMl(weightKg, typeOf(date))])),
    plan: { training: planOf(trainingDay), rest: planOf(restDay) },
  }
}

/**
 * Heshtja vetë (V37): llojet që telefoni i tregoi 3 ditë rresht pa asnjë prekje dhe pa regjistrim
 * heshtin; kthen llojet që sapo heshtën.
 */
export async function muteIgnored(store: LocalStore, log: readonly ReminderLogEntry[], today: string): Promise<MutableKind[]> {
  if (log.length === 0) return []
  const settings = await reminderSettings(store)
  const dates = [...new Set(log.map((entry) => entry.date).filter(Boolean))]
  const supplementFoods = await supplementFoodIds(store)
  const facts = new Map(
    await Promise.all(
      dates.map(async (date) => {
        const [diary, supplements, water] = await Promise.all([
          store.where('diary_entries', 'date', date),
          store.where('supplement_logs', 'date', date),
          store.where('water_logs', 'date', date),
        ])
        return [
          date,
          {
            // Proteina e shënuar "E mora" nuk e bën vaktin të regjistruar.
            meals: new Set(diary.filter((row) => !supplementFoods.has(String(row.food_id))).map((row) => String(row.meal))),
            supplements: new Set(supplements.map((row) => String(row.timing))),
            // SPEC §13: asnjë regjistrim atë ditë; një gotë e vetme mjafton.
            water: water.some((row) => Number(row.ml ?? 0) > 0),
          },
        ] as const
      }),
    ),
  )
  const isLogged = (entry: ReminderLogEntry) => {
    const day = facts.get(entry.date)
    if (!day) return false
    const meal = entry.key.split('|')[2] ?? ''
    if (entry.kind === 'meal') return day.meals.has(meal)
    if (entry.kind === 'supplements') return day.supplements.has(meal)
    return entry.kind === 'water' ? day.water : true
  }
  const streaks = ignoredStreaks(log, isLogged, today, settings.resumed)
  const kinds = (Object.keys(streaks) as MutableKind[]).filter((kind) => streaks[kind] >= MUTE_AFTER_DAYS && !settings.muted[kind])
  await muteReminders(store, kinds, today)
  return kinds
}
