import { type CoachAnswer, type ContextFood, type ContextSupplement, type Draft, PARSE_ERRORS, type ParseErrorCode, type ParseMealKey, type ParseRequest } from '../../supabase/functions/log-parse/shared'
import { type BoxExercise, logSets, resolveSets, type TrainingRefs, workoutContext } from './ai-box-training'
import { coachFacts } from './ai-coach'
import { createCustomFood, recentFoods } from './foods'
import type { MonthSpend } from './pdf-import'
import { currentFoodDate, logFood, nutritionDay, planFoodId } from './nutrition'
import type { LocalStore } from './store'
import { supplementList, setSupplementTaken } from './supplements'
import { addWater } from './water'
import { foodName, mealName, portionText, supplementDose, supplementName } from '@/i18n/domain'
import { localDate } from '@/lib/calendar'
import type { I18n } from '@/i18n'
import { macrosFor } from '@/nutrition/jim'
import type { MealKey } from '@/nutrition/meals'
import type { Macros } from '@/nutrition/targets'

// Kutia e AI-së në telefon (V40, V2-E2-13; SPEC §9 "Kutia e AI-së"): konteksti që dërgohet te funksioni
// log-parse, drafti me vaktin dhe makrot e zgjidhura në telefon, ndryshimet e përdoruesit dhe regjistrimi
// pas "Regjistro të gjitha". Asgjë nuk shkruhet në bazë para regjistrimit.

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
/** Çelësat e vakteve të funksionit janë ata të app-it (kontroll në kohën e build-it). */
const SAME_MEAL_KEYS: Same<MealKey, ParseMealKey> = true
void SAME_MEAL_KEYS

/** Ku shkon një referencë e kontekstit ("f3"): ushqimi i planit, ose një rresht te foods. */
export type FoodTarget = { kind: 'plan'; food: string } | { kind: 'food'; id: string } | { kind: 'new' }

interface KnownFood {
  target: Exclude<FoodTarget, { kind: 'new' }>
  name: string
  per100: Macros
}

export interface BoxRefs {
  foods: Map<string, KnownFood>
  supplements: Map<string, { id: string; name: string; timing: MealKey[] }>
}

export interface BoxContext {
  request: Omit<ParseRequest, 'text' | 'history'>
  refs: BoxRefs
  training: TrainingRefs
}

/** Sa ushqime të njohura dërgohen: plani i sotëm, pastaj të përdorurat së fundi. */
const RECENT_FOODS = 80

const pad = (value: number) => String(value).padStart(2, '0')
const clockOf = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`
const plain = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()

/** Konteksti i kutisë për ditën e ushqimit të tanishme (V46): vaktet, ushqimet dhe suplementet e përdoruesit. */
export async function boxContext(store: LocalStore, now: Date, i18n: I18n): Promise<BoxContext> {
  const { lang, t, fmt } = i18n
  const date = await currentFoodDate(store, now)
  // Stërvitja ndjek kalendarin, ushqimi ditën e ushqimit (V46).
  const [day, recent, supplements, training, facts] = await Promise.all([nutritionDay(store, date, now), recentFoods(store, RECENT_FOODS), supplementList(store), workoutContext(store, localDate(now), i18n), coachFacts(store, now, i18n)])
  const refs: BoxRefs = { foods: new Map(), supplements: new Map() }
  const foods: ContextFood[] = []
  const seen = new Set<string>()
  const addFood = (food: KnownFood, portion: string | null) => {
    const key = plain(food.name)
    if (seen.has(key)) return
    seen.add(key)
    const ref = `f${foods.length + 1}`
    refs.foods.set(ref, food)
    foods.push({ ref, name: food.name, portion })
  }
  for (const slot of day.meals) {
    for (const line of slot.template) {
      // Pluhuri i planit është suplement (V39): kutia e njeh te suplementet.
      if (line.food === 'protein') continue
      const { item } = line
      const portion = item.unit === 'gram' ? null : `${portionText(t, fmt, { unit: item.unit, count: 1 })} = ${fmt.unit(item.unitGrams, 'g')}`
      const target: KnownFood['target'] = line.food.startsWith('food:') ? { kind: 'food', id: line.food.slice('food:'.length) } : { kind: 'plan', food: line.food }
      addFood(
        {
          target,
          name: foodName(t, { name: line.name, sourceId: line.sourceId }),
          per100: item.per100,
        },
        portion,
      )
    }
  }
  for (const food of recent) {
    if (food.sourceId?.startsWith('supplement:')) continue
    const portion = food.servingLabel && food.servingG ? `${food.servingLabel} = ${fmt.unit(food.servingG, 'g')}` : null
    addFood(
      {
        target: { kind: 'food', id: food.id },
        name: foodName(t, { name: food.name, sourceId: food.sourceId }),
        per100: {
          kcal: food.kcal,
          proteinG: food.proteinG,
          carbsG: food.carbsG,
          fatG: food.fatG,
        },
      },
      portion,
    )
  }

  const contextSupplements: ContextSupplement[] = supplements
    .filter((supplement) => supplement.enabled)
    .map((supplement, index) => {
      const ref = `s${index + 1}`
      const name = supplementName(t, supplement.name)
      refs.supplements.set(ref, {
        id: supplement.id,
        name,
        timing: supplement.timing,
      })
      const amount = supplementDose(t, supplement.name, supplement.doseText, {
        amount: supplement.doseAmount,
        unit: supplement.doseUnit,
        fmt,
      })
      return {
        ref,
        name,
        dose: supplement.scoopG && supplement.doseUnit === 'scoop' ? `${amount} = ${fmt.unit(supplement.scoopG * supplement.doseAmount, 'g')}` : amount,
      }
    })

  return {
    request: {
      date,
      time: clockOf(now),
      context: {
        language: lang === 'en' ? 'en' : 'sq',
        meals: day.meals.map((slot) => ({
          key: slot.meal,
          name: mealName(t, slot.meal),
          time: slot.time,
        })),
        foods,
        supplements: contextSupplements,
        workouts: training.workouts,
      },
      facts,
    },
    refs,
    training: training.refs,
  }
}

const minutes = (clock: string) => {
  const [hours, mins] = clock.split(':').map(Number)
  return hours * 60 + mins
}

/** Vakti i orarit më afër orës (rrethi i 24 orëve: 23:55 është afër 00:30); null pa vakte. */
export function nearestMeal(slots: readonly { meal: MealKey; time: string }[], clock: string): MealKey | null {
  let best: { meal: MealKey; distance: number } | null = null
  for (const slot of slots) {
    const gap = Math.abs(minutes(slot.time) - minutes(clock))
    const distance = Math.min(gap, 24 * 60 - gap)
    if (!best || distance < best.distance) best = { meal: slot.meal, distance }
  }
  return best?.meal ?? null
}

export interface BoxFood {
  key: string
  said: string
  name: string
  target: FoodTarget
  isNew: boolean
  per100: Macros
  /** null: pret përgjigjen e pyetjes. */
  grams: number | null
  portion: string
  estimated: boolean
  options: { label: string; grams: number }[]
  meal: MealKey
  date: string
  macros: Macros
}

export interface BoxWater {
  key: string
  ml: number
  date: string
  /** Ora e thënë, ose null (koha e regjistrimit). */
  time: string | null
}

export interface BoxSupplement {
  key: string
  supplementId: string
  name: string
  amount: number
  meal: MealKey
  date: string
}

export interface BoxDraft {
  foods: BoxFood[]
  water: BoxWater[]
  supplements: BoxSupplement[]
  exercises: BoxExercise[]
  answer: CoachAnswer | null
  notUnderstood: string[]
  /** Ku shkojnë setet (seancat dhe slotet e kontekstit kur u dërgua mesazhi). */
  training: TrainingRefs
}

export type { BoxExercise }

const ZERO: Macros = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 }
const withMacros = (row: Omit<BoxFood, 'macros'>): BoxFood => ({
  ...row,
  macros: row.grams === null ? ZERO : macrosFor(row.per100, row.grams),
})

const previousDate = (date: string) => {
  const day = new Date(`${date}T12:00:00`)
  day.setDate(day.getDate() - 1)
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`
}

let nextKey = 0
const newKey = (kind: string) => `${kind}-${++nextKey}`

/**
 * Drafti i funksionit me vaktin dhe datën e çdo rreshti (SPEC §9: vakti i thënë, ose vakti më i afërt i orës,
 * ose i radhës; suplementi pa orë merr vaktin e vet në plan) dhe me makrot nga vlerat e telefonit.
 */
export async function resolveDraft(store: LocalStore, draft: Draft, box: BoxContext, now: Date): Promise<BoxDraft> {
  const today = box.request.date
  const yesterday = previousDate(today)
  const [todayDay, yesterdayDay] = await Promise.all([
    nutritionDay(store, today, now),
    draft.foods.some((row) => row.day === -1) || draft.water.some((row) => row.day === -1) || draft.supplements.some((row) => row.day === -1) ? nutritionDay(store, yesterday, now) : null,
  ])
  const nowClock = clockOf(now)
  const pick = (day: -1 | 0, meal: MealKey | null, time: string | null, preferred: readonly MealKey[] = []): MealKey => {
    const slots = (day === -1 ? yesterdayDay! : todayDay).meals
    if (meal && slots.some((slot) => slot.meal === meal)) return meal
    if (time) return nearestMeal(slots, time) ?? 'lunch'
    const own = slots.filter((slot) => preferred.includes(slot.meal))
    if (own.length) return nearestMeal(own, nowClock)!
    if (day === 0 && todayDay.next) return todayDay.next.meal
    return nearestMeal(slots, nowClock) ?? 'lunch'
  }
  const dateOf = (day: -1 | 0) => (day === -1 ? yesterday : today)

  const foods: BoxFood[] = draft.foods.map((row) => {
    const known = row.ref ? box.refs.foods.get(row.ref) : undefined
    return withMacros({
      key: newKey('food'),
      said: row.said,
      name: known?.name ?? row.name,
      target: known?.target ?? { kind: 'new' },
      isNew: !known,
      per100: known?.per100 ?? row.per100 ?? ZERO,
      grams: row.grams,
      portion: row.portion,
      estimated: row.estimated,
      options: row.options,
      meal: pick(row.day, row.meal, row.time),
      date: dateOf(row.day),
    })
  })
  const water: BoxWater[] = draft.water.map((row) => ({
    key: newKey('water'),
    ml: row.ml,
    date: dateOf(row.day),
    time: row.time,
  }))
  const supplements: BoxSupplement[] = draft.supplements.flatMap((row) => {
    const known = box.refs.supplements.get(row.ref)
    if (!known) return []
    return [
      {
        key: newKey('supplement'),
        supplementId: known.id,
        name: known.name,
        amount: row.amount,
        meal: pick(row.day, row.meal, row.time, known.timing),
        date: dateOf(row.day),
      },
    ]
  })
  const { exercises, unmatched } = await resolveSets(store, draft.sets, box.training, localDate(now))
  return {
    foods,
    water,
    supplements,
    exercises,
    answer: draft.answer,
    notUnderstood: [...draft.notUnderstood, ...unmatched],
    training: box.training,
  }
}

const updateFood = (draft: BoxDraft, key: string, change: (row: BoxFood) => Omit<BoxFood, 'macros'>): BoxDraft => ({
  ...draft,
  foods: draft.foods.map((row) => (row.key === key ? withMacros(change(row)) : row)),
})

/** Një nga zgjedhjet e pyetjes ("1 fetë · 80 g"). */
export const chooseOption = (draft: BoxDraft, key: string, option: { label: string; grams: number }) =>
  updateFood(draft, key, (row) => ({
    ...row,
    grams: option.grams,
    portion: option.label,
    estimated: false,
  }))

/** Gramët e ndryshuar me dorë: porcioni me fjalë nuk vlen më. */
export const setGrams = (draft: BoxDraft, key: string, grams: number) =>
  updateFood(draft, key, (row) => ({
    ...row,
    grams,
    portion: '',
    estimated: false,
  }))

export const setMeal = (draft: BoxDraft, key: string, meal: MealKey): BoxDraft => ({
  ...updateFood(draft, key, (row) => ({ ...row, meal })),
  supplements: draft.supplements.map((row) => (row.key === key ? { ...row, meal } : row)),
})

export const removeRow = (draft: BoxDraft, key: string): BoxDraft => ({
  ...draft,
  foods: draft.foods.filter((row) => row.key !== key),
  water: draft.water.filter((row) => row.key !== key),
  supplements: draft.supplements.filter((row) => row.key !== key),
  exercises: draft.exercises.filter((row) => row.key !== key),
})

/** "Po, si shtesë": ushtrimi jashtë stërvitjes regjistrohet si shtesë; "Mos e shto" e heq. */
export const acceptExtra = (draft: BoxDraft, key: string, accept: boolean): BoxDraft =>
  accept
    ? {
        ...draft,
        exercises: draft.exercises.map((row) => (row.key === key ? { ...row, extra: true } : row)),
      }
    : removeRow(draft, key)

/** Ushtrimi jashtë stërvitjes që pret "Po, si shtesë" ose "Mos e shto". */
export const pendingExtra = (draft: BoxDraft) => draft.exercises.find((row) => !row.slot && !row.extra) ?? null

/** Sa rreshta do të regjistrohen: ushqimet me sasi, setet e pranuara, suplementet dhe uji. */
export const draftRows = (draft: BoxDraft) => draft.foods.filter((row) => row.grams !== null).length + draft.exercises.filter((row) => row.slot || row.extra).reduce((sum, row) => sum + row.sets.length, 0) + draft.supplements.length + draft.water.length

/**
 * Përgjigja e lirë te pyetja (MESIMET, "AI-ja"): funksioni kthen vetëm rreshtat e përgjigjur ose të rinj.
 * Një ushqim me të njëjtin emër që priste sasinë merr gramët; të tjerët shtohen.
 */
export function mergeAnswer(draft: BoxDraft, answer: BoxDraft): BoxDraft {
  let foods = [...draft.foods]
  const added: BoxFood[] = []
  for (const row of answer.foods) {
    const index = foods.findIndex((pending) => pending.grams === null && plain(pending.name) === plain(row.name))
    if (index >= 0 && row.grams !== null) {
      const pending = foods[index]
      foods = foods.map((item, at) =>
        at === index
          ? withMacros({
              ...pending,
              grams: row.grams,
              portion: row.portion,
              estimated: row.estimated,
            })
          : item,
      )
    } else added.push(row)
  }
  // Setet e reja shkojnë te seancat e mesazhit të ri, prandaj referencat e tij zënë vendin e të vjetrave.
  const training = {
    workouts: new Map([...draft.training.workouts, ...answer.training.workouts]),
    exercises: new Map([...draft.training.exercises, ...answer.training.exercises]),
  }
  return {
    foods: [...foods, ...added],
    water: [...draft.water, ...answer.water],
    supplements: [...draft.supplements, ...answer.supplements],
    exercises: [...draft.exercises, ...answer.exercises],
    answer: answer.answer ?? draft.answer,
    notUnderstood: [...draft.notUnderstood, ...answer.notUnderstood],
    training,
  }
}

/** Totali i rreshtave me sasi, për përmbledhjen. */
export const draftTotals = (draft: BoxDraft): Macros =>
  draft.foods.reduce(
    (sum, row) => ({
      kcal: sum.kcal + row.macros.kcal,
      proteinG: sum.proteinG + row.macros.proteinG,
      carbsG: sum.carbsG + row.macros.carbsG,
      fatG: sum.fatG + row.macros.fatG,
    }),
    ZERO,
  )

/** Ushqimi i ri i AI-së ruhet një herë sipas emrit (`source_id` "ai"), që herën tjetër të jetë i njohur. */
async function newFoodId(store: LocalStore, row: BoxFood): Promise<string> {
  const existing = (await store.all('foods')).find((food) => food.source === 'custom' && food.source_id === 'ai' && plain(String(food.name)) === plain(row.name))
  if (existing) return existing.id
  const id = await createCustomFood(store, { name: row.name, ...row.per100 })
  await store.put('foods', { id, source_id: 'ai' })
  return id
}

const atClock = (date: string, clock: string) => new Date(`${date}T${clock}:00`)

/** "Regjistro të gjitha": çdo rresht me sasi shkon te ditari; ai që pret përgjigjen mbetet jashtë. */
export async function logBoxDraft(
  store: LocalStore,
  draft: BoxDraft,
): Promise<{
  foods: number
  water: number
  supplements: number
  sets: number
  skipped: number
}> {
  let foods = 0
  for (const row of draft.foods) {
    if (row.grams === null) continue
    const foodId = row.target.kind === 'plan' ? await planFoodId(store, row.target.food) : row.target.kind === 'food' ? row.target.id : await newFoodId(store, row)
    await logFood(store, {
      date: row.date,
      meal: row.meal,
      foodId,
      grams: row.grams,
    })
    foods += 1
  }
  for (const row of draft.supplements) await setSupplementTaken(store, { date: row.date, supplementId: row.supplementId, meal: row.meal }, true)
  for (const row of draft.water) await addWater(store, row.date, row.time ? atClock(row.date, row.time) : store.now(), row.ml)
  const sets = await logSets(store, draft.exercises, draft.training)
  return {
    foods,
    water: draft.water.length,
    supplements: draft.supplements.length,
    sets,
    skipped: draft.foods.length - foods,
  }
}

/** Gabimet e funksionit, plus "pa internet" që e vendos app-i vetë. */
export type BoxError = 'offline' | ParseErrorCode

export type BoxResult = { ok: true; draft: Draft; costEur: number; month: MonthSpend } | { ok: false; error: BoxError; month?: MonthSpend }

/** Thirrja te funksioni log-parse (app-data.ts e lidh me Supabase). */
export interface BoxRemote {
  parse(request: ParseRequest): Promise<BoxResult>
}

const ERRORS = new Set<BoxError>(PARSE_ERRORS)
const isMonth = (value: unknown): value is MonthSpend => typeof value === 'object' && value !== null && typeof (value as MonthSpend).spentEur === 'number' && typeof (value as MonthSpend).limitEur === 'number'
const isDraft = (value: unknown): value is Draft => typeof value === 'object' && value !== null && (['foods', 'water', 'supplements', 'sets', 'notUnderstood'] as const).every((key) => Array.isArray((value as Record<string, unknown>)[key])) && 'answer' in value

/** Përgjigja e funksionit (statusi null: pa lidhje) si rezultat për kutinë. */
export function boxResultFrom(status: number | null, body: unknown): BoxResult {
  if (status === null) return { ok: false, error: 'offline' }
  const value = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>
  if (status === 200) {
    const usage = value.usage as { costEur?: unknown } | undefined
    if (isDraft(value.draft) && isMonth(value.month))
      return {
        ok: true,
        draft: value.draft,
        costEur: typeof usage?.costEur === 'number' ? usage.costEur : 0,
        month: value.month,
      }
    return { ok: false, error: 'ai_failed' }
  }
  const error = ERRORS.has(value.error as BoxError) ? (value.error as BoxError) : status === 401 ? 'unauthorized' : 'ai_failed'
  return {
    ok: false,
    error,
    ...(isMonth(value.month) ? { month: value.month } : {}),
  }
}
