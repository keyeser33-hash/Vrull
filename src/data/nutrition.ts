import { JIM_FOODS, JIM_MEALS, type JimFoodKey, macrosFor, type Portion, sumMacros } from '@/nutrition/jim'
import type { MealKey } from '@/nutrition/meals'
import { foodDate, minutesInFoodDay } from '@/nutrition/food-day'
import { mealSchedule } from '@/nutrition/schedule'
import type { Evidence } from '@/nutrition/supplements'
import { bodyweightForTargets, type DayType, JIM_RANGE_KG, type Macros } from '@/nutrition/targets'
import { readProfile } from './profile'
import { mealPlanOn, readSchedule, trainingTimeOn } from './schedule-settings'
import { supplementList } from './supplements'
import { readTargetsProfile, targetsFor, type TargetsSource } from './targets-profile'
import type { LocalStore } from './store'
import type { LocalRow } from './tables'

// Dita e ushqimit (SPEC §9, TH-14 dhe TH-16): objektivat sipas peshës dhe llojit të ditës, vaktet
// me orë, shablloni i Jimit për çdo vakt dhe regjistrimet e ditarit. Makrot e një regjistrimi
// ruhen në momentin e regjistrimit, që historia të mos ndryshojë kur ndryshon një ushqim.

export interface DiaryEntry extends Macros {
  id: string
  /** Emri i ushqimit si ruhet; null kur ushqimi nuk gjendet më. Ekrani e thotë me `foodName`. */
  name: string | null
  /** `jim:<çelësi>` për ushqimet e shabllonit, kodi i produktit për Open Food Facts dhe USDA. */
  sourceId: string | null
  grams: number | null
}

export interface TemplateLine extends Macros {
  food: JimFoodKey
  /** Emri shqip i shabllonit; ekrani e përkthen sipas `food`. */
  name: string
  portion: Portion
  grams: number
}

/** done: i regjistruar; next: i radhës; todo: më vonë; missed: ora e tij kaloi pa regjistrim. */
export type MealStatus = 'done' | 'next' | 'todo' | 'missed'

export interface MealSupplement {
  id: string
  /** Emri si ruhet; ekrani e përkthen me `supplementName` kur është ai i planit. */
  name: string
  doseText: string
  evidence: Evidence
  taken: boolean
}

export interface MealSlot {
  meal: MealKey
  time: string
  status: MealStatus
  entries: DiaryEntry[]
  totals: Macros
  template: TemplateLine[]
  templateTotals: Macros
  /** Suplementet aktive të këtij vakti (SPEC §10). */
  supplements: MealSupplement[]
}

export interface NutritionDay {
  date: string
  /** Data është dita e ushqimit e tanishme (V46), jo domosdoshmërisht data kalendarike. */
  isToday: boolean
  dayType: DayType
  dayTypeManual: boolean
  weightKg: number | null
  /** Jashtë 72,6–90,7 kg plani i Jimit mbetet, por objektivat ndryshojnë (vetëm me objektivat e Jimit). */
  outsideJimRange: boolean
  targets: Macros | null
  /** Nga kalkulatori (V32) ose nga totalet e Jimit (Q15). */
  targetsSource: TargetsSource
  totals: Macros
  meals: MealSlot[]
  next: MealSlot | null
}

const toNumber = (value: unknown) => Number(value ?? 0)
const entryMacros = (row: LocalRow): Macros => ({
  kcal: toNumber(row.kcal),
  proteinG: toNumber(row.protein_g),
  carbsG: toNumber(row.carbs_g),
  fatG: toNumber(row.fat_g),
})

const savedMacros = (row: LocalRow): Macros => ({
  kcal: toNumber(row.kcal),
  proteinG: toNumber(row.protein_g),
  carbsG: toNumber(row.carbs_g),
  fatG: toNumber(row.fat_g),
})


/** Dita ISO e javës (1 = e hënë ... 7 = e diel) e një date "2026-12-07". */
const isoWeekday = (date: string) => new Date(`${date}T12:00:00`).getDay() || 7

async function dayTypeFor(store: LocalStore, date: string, trainingDays: number[]): Promise<{ dayType: DayType; manual: boolean; saved?: LocalRow }> {
  const [target] = await store.where('nutrition_targets', 'date', date)
  if (target?.is_manual) return { dayType: target.day_type as DayType, manual: true, saved: target }
  const saved = target
  const auto = await autoDayType(store, date, trainingDays)
  return { dayType: auto, manual: false, saved: saved?.day_type === auto ? saved : undefined }
}

async function autoDayType(store: LocalStore, date: string, trainingDays: number[]): Promise<DayType> {
  if (trainingDays.includes(isoWeekday(date))) return 'training'
  const sessions = await store.where('workout_sessions', 'date', date)
  return sessions.some((row) => row.status === 'completed' || row.status === 'in_progress') ? 'training' : 'rest'
}

async function weightFor(store: LocalStore, date: string) {
  const rows = await store.all('body_measurements')
  return bodyweightForTargets(
    rows.filter((row) => row.weight_kg !== null && row.weight_kg !== undefined).map((row) => ({ date: String(row.date), weightKg: Number(row.weight_kg) })),
    date,
  )
}

export async function nutritionDay(store: LocalStore, date: string, now: Date): Promise<NutritionDay> {
  const [profile, targetsProfile, schedule] = await Promise.all([readProfile(store), readTargetsProfile(store), readSchedule(store)])
  const [{ dayType, manual, saved }, measuredKg, entries, foods, supplements, supplementLogs] = await Promise.all([
    dayTypeFor(store, date, profile.trainingDays),
    weightFor(store, date),
    store.where('diary_entries', 'date', date),
    store.all('foods'),
    supplementList(store),
    store.where('supplement_logs', 'date', date),
  ])
  const foodsById = new Map(foods.map((food) => [food.id, food]))
  const planned = mealSchedule({
    wakeTime: profile.wakeTime,
    sleepTime: profile.sleepTime,
    trainingTime: dayType === 'training' ? trainingTimeOn(schedule, date) : null,
    plan: mealPlanOn(schedule.plan, date),
  })
  const byLoggedAt = (a: LocalRow, b: LocalRow) => String(a.logged_at).localeCompare(String(b.logged_at))

  // Dita e ushqimit (V46): pas mesnate, deri 3 orë para zgjimit, është ende dita e djeshme.
  const current = foodDate(now, profile.wakeTime)
  const today = date === current
  const nowMinutes = minutesInFoodDay(now, date)
  const minutesByMeal = new Map(planned.map((entry) => [entry.meal, entry.minutes]))
  const meals: MealSlot[] = planned.map(({ meal, time }) => {
    const rows = entries.filter((row) => row.meal === meal).sort(byLoggedAt)
    const list = rows.map((row) => {
      const food = foodsById.get(String(row.food_id))
      return {
        id: row.id,
        name: food ? String(food.name) : null,
        sourceId: (food?.source_id as string | null | undefined) ?? null,
        grams: row.grams === null || row.grams === undefined ? null : Number(row.grams),
        ...entryMacros(row),
      }
    })
    const template = (JIM_MEALS[meal] ?? []).map((item) => ({
      food: item.food,
      name: JIM_FOODS[item.food].name,
      portion: item.portion,
      grams: item.grams,
      ...macrosFor(JIM_FOODS[item.food], item.grams),
    }))
    return {
      meal,
      time,
      status: list.length > 0 ? 'done' : 'todo',
      entries: list,
      totals: sumMacros(list),
      template,
      templateTotals: sumMacros(template),
      supplements: supplements
        .filter((supplement) => supplement.enabled && supplement.timing.includes(meal))
        .map((supplement) => ({
          id: supplement.id,
          name: supplement.name,
          doseText: supplement.doseText,
          evidence: supplement.evidence,
          taken: supplementLogs.some((row) => row.supplement_id === supplement.id && row.timing === meal),
        })),
    }
  })

  // I radhës: vakti i parë pa regjistrim që nuk ka kaluar më shumë se 1 orë. Për ditët e kaluara
  // asnjë; për ato të ardhshme i pari pa regjistrim.
  const past = date < current
  const minutesOf = (meal: MealSlot) => minutesByMeal.get(meal.meal) ?? 0
  const next = past ? undefined : meals.find((meal) => meal.status === 'todo' && (!today || minutesOf(meal) >= nowMinutes - 60))
  for (const meal of meals) {
    if (meal === next) meal.status = 'next'
    else if (meal.status === 'todo' && (past || (today && minutesOf(meal) < nowMinutes - 60))) meal.status = 'missed'
  }

  // Pesha e objektivave të ruajtura, që shënimet e ditës të përputhen me to.
  const weightKg = saved?.bodyweight_kg !== null && saved?.bodyweight_kg !== undefined ? Number(saved.bodyweight_kg) : measuredKg
  const computed = weightKg === null ? null : targetsFor(targetsProfile, { weightKg, dayType, date, sessionsPerWeek: profile.trainingDays.length })
  const targetsSource = computed?.source ?? (targetsProfile.from !== null && date >= targetsProfile.from ? 'personal' : 'jim')
  return {
    date,
    isToday: today,
    dayType,
    dayTypeManual: manual,
    weightKg,
    outsideJimRange: targetsSource === 'jim' && weightKg !== null && (weightKg < JIM_RANGE_KG.min || weightKg > JIM_RANGE_KG.max),
    targets: saved ? savedMacros(saved) : (computed?.macros ?? null),
    targetsSource,
    totals: sumMacros(meals.flatMap((meal) => meal.entries)),
    meals,
    next: next ?? null,
  }
}

/** Objektivat e ditës ruhen (me dorë ose me regjistrimin e parë), që grafiku të mos ndryshojë pas faktit. */
async function saveTargets(store: LocalStore, date: string, dayType: DayType, manual: boolean) {
  const weightKg = await weightFor(store, date)
  const [existing] = await store.where('nutrition_targets', 'date', date)
  if (existing && !manual && (existing.is_manual || existing.day_type === dayType)) return
  if (weightKg === null) return
  const [profile, targetsProfile] = await Promise.all([readProfile(store), readTargetsProfile(store)])
  const targets = targetsFor(targetsProfile, { weightKg, dayType, date, sessionsPerWeek: profile.trainingDays.length }).macros
  await store.put('nutrition_targets', {
    id: existing?.id,
    date,
    day_type: dayType,
    kcal: targets.kcal,
    protein_g: targets.proteinG,
    carbs_g: targets.carbsG,
    fat_g: targets.fatG,
    bodyweight_kg: weightKg,
    is_manual: manual,
  })
}

/** Dita e stërvitjes ose e pushimit, me një prekje; vlen vetëm për atë datë. */
export async function setDayType(store: LocalStore, date: string, dayType: DayType) {
  await saveTargets(store, date, dayType, true)
}

/** Ushqimi i shabllonit si ushqim i përdoruesit, një herë për çdo artikull. */
async function templateFood(store: LocalStore, key: JimFoodKey) {
  const [existing] = await store.where('foods', '[source+source_id]', ['template', `jim:${key}`])
  if (existing) return existing.id
  const food = JIM_FOODS[key]
  const row = await store.put('foods', {
    source: 'template',
    source_id: `jim:${key}`,
    name: food.name,
    kcal: food.kcal,
    protein_g: food.proteinG,
    carbs_g: food.carbsG,
    fat_g: food.fatG,
  })
  return row.id
}

const round1 = (value: number) => Math.round(value * 10) / 10

/** Vakti i Jimit në ditar me një prekje (Q18); artikujt pastaj ndryshohen një nga një. */
export async function logTemplateMeal(store: LocalStore, date: string, meal: MealKey) {
  const items = JIM_MEALS[meal] ?? []
  const profile = await readProfile(store)
  const { dayType } = await dayTypeFor(store, date, profile.trainingDays)
  await saveTargets(store, date, dayType, false)
  const loggedAt = store.now().getTime()
  const rows = []
  for (const [index, item] of items.entries()) {
    const macros = macrosFor(JIM_FOODS[item.food], item.grams)
    rows.push({
      date,
      meal,
      food_id: await templateFood(store, item.food),
      grams: item.grams,
      kcal: round1(macros.kcal),
      protein_g: round1(macros.proteinG),
      carbs_g: round1(macros.carbsG),
      fat_g: round1(macros.fatG),
      // Radha e artikujve ruhet me një milisekondë mes tyre.
      logged_at: new Date(loggedAt + index).toISOString(),
    })
  }
  await store.insertMany('diary_entries', rows)
}

/** Një ushqim me gramë në një vakt; makrot llogariten nga vlerat për 100 g dhe ruhen në regjistrim. */
export async function logFood(store: LocalStore, input: { date: string; meal: MealKey; foodId: string; grams: number }) {
  const food = await store.get('foods', input.foodId)
  if (!food) throw new Error('Ushqimi nuk gjendet.')
  const profile = await readProfile(store)
  const { dayType } = await dayTypeFor(store, input.date, profile.trainingDays)
  await saveTargets(store, input.date, dayType, false)
  const macros = macrosFor(
    { kcal: Number(food.kcal), proteinG: Number(food.protein_g), carbsG: Number(food.carbs_g), fatG: Number(food.fat_g) },
    input.grams,
  )
  await store.put('diary_entries', {
    date: input.date,
    meal: input.meal,
    food_id: input.foodId,
    grams: input.grams,
    kcal: round1(macros.kcal),
    protein_g: round1(macros.proteinG),
    carbs_g: round1(macros.carbsG),
    fat_g: round1(macros.fatG),
    logged_at: store.now().toISOString(),
  })
}

export async function removeDiaryEntry(store: LocalStore, id: string) {
  await store.remove('diary_entries', id)
}

/** Faqja Objektivat (V2-E2-03): profili, pesha e sotme e objektivave dhe seancat në javë. */
export async function targetsPageData(store: LocalStore, date: string) {
  const [profile, targets, weightKg] = await Promise.all([readProfile(store), readTargetsProfile(store), weightFor(store, date)])
  return { targets, weightKg, sessionsPerWeek: profile.trainingDays.length }
}

/** Lloji i ditës dhe pesha e objektivave të një date (uji, V36), si te dita e ushqimit. */
export async function dayBasics(store: LocalStore, date: string): Promise<{ dayType: DayType; weightKg: number | null }> {
  const profile = await readProfile(store)
  const [{ dayType, saved }, measuredKg] = await Promise.all([dayTypeFor(store, date, profile.trainingDays), weightFor(store, date)])
  const weightKg = saved?.bodyweight_kg !== null && saved?.bodyweight_kg !== undefined ? Number(saved.bodyweight_kg) : measuredKg
  return { dayType, weightKg }
}

/** Dita e ushqimit e tanishme sipas orës së zgjimit (V46). */
export async function currentFoodDate(store: LocalStore, now: Date): Promise<string> {
  return foodDate(now, (await readProfile(store)).wakeTime)
}
