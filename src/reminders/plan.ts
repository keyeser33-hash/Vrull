import type { I18n } from '@/i18n'
import { foodName, mealName, missedNo, nameInSentence, programDayName, programWeekLabel, supplementName } from '@/i18n/domain'
import { JIM_FOODS, JIM_MEALS } from '@/nutrition/jim'
import type { MealKey } from '@/nutrition/meals'
import { type MealPlan, mealSchedule } from '@/nutrition/schedule'
import type { SupplementDef } from '@/nutrition/supplements'
import type { DayType } from '@/nutrition/targets'
import { GLASS_ML } from '@/nutrition/water'
import { type MissedInput, missedYesterday } from '@/program/missed-day'
import { WEEK_CARD_HOUR } from '@/progress/weekly-goals'

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
  /** Emri i ditës së programit ("Shpinë, biceps, bark"), për njoftimin e ditës së humbur. */
  dayName?: string
}

export interface ReminderToggles {
  meals: boolean
  supplements: boolean
  training: boolean
  measurements: boolean
  /** Uji sipas ritmit (V37); pa vlerë, i ndezur. */
  water?: boolean
  /** "Java jote është gati" të dielën në 20:00 (V43); pa vlerë, i ndezur. */
  week?: boolean
}

/** Llojet që heshtin vetë pas 3 ditëve të injoruara (V37). */
export type MutableKind = 'meal' | 'supplements' | 'water'

/** Rikujtuesit e zgjuar (V37, SPEC §13). Pa to, plani mbetet si te 0.20 (çdo vakt, pa butona). */
export interface SmartInput {
  /** Njoftimet e vakteve dhe suplementeve në ditë; uji (një në ditë), stërvitja dhe matja nuk numërohen. */
  maxDaily: number
  /** Çfarë është regjistruar: "data|vakti" për vaktet, "data|vakti|suplementi" për suplementet, uji sipas datës (ml dhe ora, ms). */
  logged: { meals: readonly string[]; supplements: readonly string[]; water: Readonly<Record<string, readonly { ml: number; at: number }[]>> }
  /** Intervali i qetë që zgjedh përdoruesi ("12:30"–"14:00"); njoftimet bien në fund të tij. */
  quiet: { from: string; to: string } | null
  muted: Readonly<Partial<Record<MutableKind, true>>>
  /** Sa minuta para orës vjen njoftimi i vaktit dhe i dyti i stërvitjes (V79, V80); pa vlerë, në orën e vaktit. */
  lead?: number
  /** Uji (V81): kur je prapa ritmit (si te V37), brenda njoftimit të çdo vakti, ose çdo 2 orë. Pa vlerë, 'behind'. */
  water?: WaterMode
  /** "Mbyll ditën" (V82): njoftim `CLOSE_BEFORE_SLEEP` minuta para gjumit kur ka vakte pa shënuar; `only`: vaktet e ditës heshtin (V69, "në mbrëmje"). */
  closeDay?: { only: boolean }
  /** Objektivi i ujit sipas datës; pa të, pa rikujtues uji. */
  waterTargets: Readonly<Record<string, number>>
  /** Plani im sipas llojit të ditës: artikujt dhe makrot e çdo vakti; pa të, plani i Jimit. */
  plan: Readonly<Partial<Record<DayType, Partial<Record<MealKey, { items: readonly { name: string; sourceId: string | null }[]; kcal: number; proteinG: number }>>>>>
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
  /** Kohëzgjatja e vlerësuar e stërvitjes (V62), për orën e vaktit pas stërvitjes; pa të, 60 min. */
  workoutMinutes?: number | null
  /** Ora e stërvitjes sipas ditës ISO (V35); pa të, `trainingTime` për çdo ditë. */
  trainingTimes?: Record<number, string>
  /** Plani i vakteve (V35): vlen nga `from`, para saj `previous`; `training`: ora e stërvitjes vetëm për një datë (V76). */
  mealPlan?: MealPlan & { from: string | null; previous: MealPlan | null; training?: { date: string; time: string } | null }
  /** Dita e humbur (V38): dita e parë që numërohet dhe datat me seancë; pa to, pa njoftimin. */
  startedOn?: string | null
  sessionDates?: readonly string[]
  /**
   * Datat që kanë check-in (V50): rikujtuesi i stërvitjes shton "Si ndihesh?" në ditët pa të. Pa këtë fushë
   * (thirrës të vjetër) teksti nuk ndryshon.
   */
  checkedIn?: readonly string[]
  smart?: SmartInput
}

export type WaterMode = 'behind' | 'meals' | 'hours'
export type ReminderKind = 'meal' | 'supplements' | 'water' | 'training' | 'measurement' | 'missed' | 'week' | 'close'
export type ReminderActionId = 'ate' | 'snooze' | 'drank' | 'took' | 'yes' | 'no'

export interface Reminder {
  id: number
  at: Date
  title: string
  body: string
  kind: ReminderKind
  /** Butonat te njoftimi (V37), që telefoni i zbaton pa hapur app-in. */
  actions?: { id: ReminderActionId; title: string }[]
  /** Çfarë regjistron një buton: dita, vakti, suplementet ose gota; te "Java jote" e hëna e javës. */
  data?: { date: string; meal?: MealKey; supplementIds?: string[]; ml?: number }
  /** Njoftimi pas butonit, sipas butonit ("Dreka u regjistrua"). */
  done?: Partial<Record<ReminderActionId, { title: string; body: string }>>
  /** "lloji|data|vakti": njoftimi dhe shtyrja e tij hiqen sapo regjistrohet. */
  key?: string
}

/** Id-të e rikujtuesve: 5000–5199 (timer-i i pushimit ka 4201). */
export const REMINDER_IDS = { first: 5000, last: 5199 }
/** "Shty" e sjell njoftimin sërish pas kaq minutash (telefoni e mban me listën). */
export const SNOOZE_MINUTES = 30

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
/** Përparësia e vakteve kur ka më shumë se kufiri: rreth stërvitjes, gjumi, drekë e darkë, pastaj të tjerat. */
const MEAL_PRIORITY: readonly MealKey[] = ['pre_workout', 'post_workout', 'bedtime', 'lunch', 'dinner', 'breakfast_1', 'snack_pm', 'snack_am', 'breakfast_2', 'intra_workout']
/** Pikat e ujit: gjysma dhe tre të katërtat e ditës zgjuar; rikujtuesi kur je më shumë se një gotë prapa. */
const WATER_CHECKS = [0.5, 0.75]
/** "Çdo 2 orë" (V81): nga dy orë pas zgjimit deri një orë para gjumit. */
const WATER_EVERY_MINUTES = 120
/** "Mbyll ditën" vjen kaq minuta para gjumit (V82). */
export const CLOSE_BEFORE_SLEEP = 90

const minutesOf = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

export function planReminders(input: ReminderInput, { t, fmt, lang }: Pick<I18n, 't' | 'fmt' | 'lang'>): Reminder[] {
  const lower = (name: string) => nameInSentence(name, lang)
  const sentence = (names: string[]) => names.map((name, index) => (index === 0 ? name : lower(name))).join(', ')
  const litres = (ml: number) => fmt.number(ml / 1000, { minDigits: 1, maxDigits: 2 })
  const workoutLabel = input.nextWorkout
    ? t('reminders.notify.workoutLabel', { week: programWeekLabel(t, input.nextWorkout), day: String(input.nextWorkout.dayNumber) })
    : null
  const { smart } = input
  const reminders: Reminder[] = []
  let labelUsed = false
  const isTraining = (date: string, weekday: number) => (input.dayTypes[date] ?? (input.trainingDays.includes(weekday) ? 'training' : 'rest')) === 'training'
  const done = new Set(input.sessionDates ?? [])
  const missedInput: MissedInput = { trainingDays: input.trainingDays, startedOn: input.startedOn ?? null, sessionDates: input.sessionDates ?? [], dayTypes: input.dayTypes }
  const loggedMeals = new Set(smart?.logged.meals ?? [])
  const loggedSupplements = new Set(smart?.logged.supplements ?? [])
  // Ditët e stërvitjes së planit pa seancë ende: pas tyre treguesi i programit nuk dihet.
  let pending = 0
  // Dita e djeshme vetëm për vaktet pas mesnate që nuk kanë ardhur ende (V46): planifikimi në 00:10
  // nuk e humb "Para gjumit" të 00:30.
  for (let offset = -1; offset < input.days; offset++) {
    const day = new Date(input.from.getFullYear(), input.from.getMonth(), input.from.getDate() + offset)
    const late = offset < 0
    const date = isoDate(day)
    const weekday = day.getDay() || 7
    const training = isTraining(date, weekday)
    // Ora "vetëm sot" (V76) fiton mbi orën e ditës së javës.
    const trainingTime = (input.mealPlan?.training?.date === date ? input.mealPlan.training.time : undefined) ?? input.trainingTimes?.[weekday] ?? input.trainingTime
    const plan = input.mealPlan && input.mealPlan.from !== null && date < input.mealPlan.from ? (input.mealPlan.previous ?? undefined) : input.mealPlan
    const idBase = REMINDER_IDS.first + (offset + 1) * 20
    const dayItems: Omit<Reminder, 'id'>[] = []

    if (input.toggles.measurements && weekday === input.measurementDay && !late) {
      dayItems.push({ at: at(day, input.wakeTime), title: t('reminders.notify.measurement'), body: t('reminders.notify.measurementText'), kind: 'measurement' })
    }
    // Dita e humbur (V38): rregulli i Sot (`missedYesterday`), vetëm me një program që ka ende
    // stërvitje. Kur dje ka ende kohë (një ditë e planit), njoftimi ikën vetë me seancën, sepse plani
    // rillogaritet.
    if (!late && input.toggles.training && input.nextWorkout && missedYesterday(missedInput, date)) {
      const known = input.nextWorkout && (offset === 0 ? 0 : pending - 1) === 0 ? input.nextWorkout : null
      if (smart) {
        const time = fmt.time(at(day, trainingTime))
        const next = nextTrainingDay(day, (candidate) => isTraining(isoDate(candidate), candidate.getDay() || 7))
        const ask = known
          ? known.dayName
            ? t('reminders.notify.missedAsk', { day: String(known.dayNumber), name: lower(programDayName(t, known.dayName)), time })
            : t('reminders.notify.missedAskShort', { day: String(known.dayNumber), time })
          : t('reminders.notify.missedAskNext', { time })
        dayItems.push({
          at: at(day, addMinutes(input.wakeTime, 30)),
          title: t('reminders.notify.missed'),
          body: ask,
          kind: 'missed',
          key: `missed|${date}|`,
          data: { date },
          actions: [
            { id: 'yes', title: t('reminders.notify.yes') },
            { id: 'no', title: missedNo(t, next ? next.getDay() || 7 : null) },
          ],
          done: {
            yes: { title: t('reminders.notify.missedYesDone'), body: t('reminders.notify.missedYesDoneText', { time }) },
            no: { title: t('reminders.notify.missedNoDone'), body: next ? t('reminders.notify.missedNoDoneText', { day: fmt.weekday(next) }) : '' },
          },
        })
      } else {
        const body = known ? t('reminders.notify.missedText', { day: String(known.dayNumber) }) : t('reminders.notify.missedNext')
        dayItems.push({ at: at(day, addMinutes(input.wakeTime, 30)), title: t('reminders.notify.missed'), body, kind: 'missed' })
      }
    }
    // "Java jote është gati" (V43, SPEC §0.3c): të dielën në 20:00, një herë në javë, jashtë kufirit
    // ditor (si stërvitja dhe matja); orët e qeta e shtyjnë si çdo njoftim. Prekja hap përmbledhjen.
    if (!late && weekday === 7 && input.toggles.week !== false) {
      const monday = isoDate(new Date(day.getFullYear(), day.getMonth(), day.getDate() - 6))
      dayItems.push({
        at: new Date(day.getFullYear(), day.getMonth(), day.getDate(), WEEK_CARD_HOUR, 0),
        title: t('reminders.notify.week'),
        body: t('reminders.notify.weekText'),
        kind: 'week',
        key: `week|${monday}|`,
        data: { date: monday },
      })
    }
    if (training && !done.has(date) && !late) pending += 1
    if (input.toggles.training && training && !late) {
      const title = !labelUsed && workoutLabel ? t('reminders.notify.workout', { label: workoutLabel }) : t('reminders.notify.workoutToday')
      labelUsed = true
      // Ora e stërvitjes me formatin e gjuhës (24 orë në të dyja).
      const trainingAt = fmt.time(at(day, trainingTime))
      const workoutAt = t('reminders.notify.workoutAt', { time: trainingAt })
      // Dita pa check-in (V50): "Stërvitja 18:00. Si ndihesh?".
      // Prekja e tij hap story-n e parë pa përgjigje të gjendjes së ditës (V57, `reminderRoute`), jo vetëm Sot.
      const asks = !!input.checkedIn && !input.checkedIn.includes(date)
      const body = asks ? `${workoutAt}. ${t('checkin.reminder')}` : workoutAt
      dayItems.push({ at: at(day, addMinutes(input.wakeTime, 30)), title, body, kind: 'training', ...(asks ? { key: `checkin|${date}|` } : {}) })
      // I dyti, pak para orës së ditës (V80): vetëm kur dita s'ka ende seancë. Ora "vetëm sot" (V76) e lëviz bashkë me vete.
      const lead = smart?.lead ?? 0
      if (lead > 0 && !done.has(date)) {
        const [hours, minutes] = trainingTime.split(':').map(Number)
        dayItems.push({ at: new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes - lead), title: t('reminders.notify.workoutSoon', { minutes: lead }), body: workoutAt, kind: 'training' })
      }
    }

    // Vaktet dhe suplementet e tyre: një njoftim për vakt. Me rikujtuesit e zgjuar, pa vaktet dhe
    // suplementet e regjistruara, pa llojet e heshtura, dhe të shumtën `maxDaily` sipas përparësisë.
    // "Në mbrëmje" (V69, V82): vaktet nuk njoftohen gjatë ditës; i mbledh "Mbyll ditën".
    const meals = input.toggles.meals && !smart?.muted.meal && !smart?.closeDay?.only
    const lead = smart?.lead ?? 0
    // Uji brenda njoftimit të vaktit (V81): vetëm sa kohë objektivi i ditës nuk është mbyllur.
    const waterLeft = smart?.water === 'meals' && input.toggles.water !== false && !smart.muted.water && (smart.waterTargets[date] ?? 0) > (smart.logged.water[date] ?? []).reduce((sum, entry) => sum + entry.ml, 0)
    const open: MealKey[] = []
    const withSupplements = input.toggles.supplements && !smart?.muted.supplements
    const myPlan = smart?.plan[training ? 'training' : 'rest']
    const candidates: (Omit<Reminder, 'id'> & { priority: number })[] = []
    for (const { meal, minutes } of mealSchedule({ wakeTime: input.wakeTime, sleepTime: input.sleepTime, trainingTime: training ? trainingTime : null, workoutMinutes: input.workoutMinutes, plan })) {
      // Minutat e ditës: një vakt pas mesnate bie të nesërmen kalendarike, por i përket kësaj dite (V46).
      const mealAt = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, minutes)
      const mealKey = `${date}|${meal}`
      const mealLogged = loggedMeals.has(mealKey)
      if (!mealLogged) open.push(meal)
      // Njoftimi vjen `lead` minuta para vaktit (V79) dhe titulli mban orën e vaktit.
      const notifyAt = new Date(mealAt.getTime() - lead * 60_000)
      const taken = withSupplements ? input.supplements.filter((item) => item.enabled && item.timing.includes(meal) && !loggedSupplements.has(`${mealKey}|${item.id}`)) : []
      const supplements = taken.map((item) => supplementName(t, item.name))
      const planned = myPlan?.[meal]
      const foods = planned
        ? planned.items.map((item) => foodName(t, item))
        : (JIM_MEALS[meal] ?? []).map((item) => foodName(t, { name: JIM_FOODS[item.food].name, sourceId: `jim:${item.food}` }))
      const priority = MEAL_PRIORITY.indexOf(meal)
      const data = { date, meal, supplementIds: taken.map((item) => item.id) }
      if (meals && foods.length > 0 && !mealLogged) {
        const withFoods = supplements.length > 0 ? t('reminders.notify.mealWith', { foods: sentence(foods), supplements: supplements.map(lower).join(', ') }) : sentence(foods)
        const body = waterLeft ? t('reminders.notify.mealWater', { text: withFoods }) : withFoods
        const name = mealName(t, meal)
        candidates.push({
          at: notifyAt,
          title: lead > 0 ? t('reminders.notify.mealAt', { meal: name, time: fmt.time(mealAt) }) : name,
          body,
          kind: 'meal',
          priority,
          ...(smart
            ? {
                key: `meal|${mealKey}`,
                data,
                actions: [
                  { id: 'ate' as const, title: t('reminders.notify.ate') },
                  { id: 'snooze' as const, title: t('reminders.notify.snooze', { minutes: SNOOZE_MINUTES }) },
                ],
                done: {
                  ate: {
                    title: t('reminders.notify.mealDone', { meal: name }),
                    body: planned ? t('reminders.notify.mealDoneText', { kcal: Math.round(planned.kcal), protein: Math.round(planned.proteinG) }) : t('reminders.notify.mealDonePlain'),
                  },
                },
              }
            : {}),
        })
      } else if (supplements.length > 0) {
        candidates.push({
          at: notifyAt,
          title: t('reminders.notify.supplements', { meal: mealName(t, meal) }),
          body: supplements.join(', '),
          kind: 'supplements',
          priority,
          ...(smart
            ? {
                key: `supplements|${mealKey}`,
                data,
                actions: [
                  { id: 'took' as const, title: t('reminders.notify.took') },
                  { id: 'snooze' as const, title: t('reminders.notify.snooze', { minutes: SNOOZE_MINUTES }) },
                ],
                done: { took: { title: t('reminders.notify.supplementsDone'), body: supplements.join(', ') } },
              }
            : {}),
        })
      }
    }
    const chosen = smart ? [...candidates].sort((a, b) => a.priority - b.priority || a.at.getTime() - b.at.getTime()).slice(0, smart.maxDaily) : candidates
    for (const { priority: _priority, ...item } of chosen) dayItems.push(item)

    // "Mbyll ditën" (V82): një njoftim para gjumit kur ka vakte pa shënuar; prekja hap ekranin (`reminderRoute`).
    if (smart?.closeDay && input.toggles.meals && !smart.muted.meal && open.length > 0) {
      const sleep = minutesOf(input.sleepTime)
      // Gjumi pas mesnate i përket së nesërmes kalendarike (V46).
      const sleepMinute = sleep <= minutesOf(input.wakeTime) ? sleep + 1440 : sleep
      dayItems.push({
        at: new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, sleepMinute - CLOSE_BEFORE_SLEEP),
        title: t('reminders.notify.close'),
        body: t('reminders.notify.closeText', { count: open.length }),
        kind: 'close',
        key: `close|${date}|`,
        data: { date },
      })
    }

    // Uji sipas ritmit (V37): vetëm kur je prapa, një herë në ditë. Një pikë që ka kaluar, ku ishe
    // prapa, e mori rikujtuesin e ditës; pas saj nuk vjen tjetër.
    const waterTarget = smart?.waterTargets[date]
    const waterMode = smart?.water ?? 'behind'
    if (smart && waterTarget && waterMode === 'hours' && input.toggles.water !== false && !smart.muted.water && !late) {
      // "Çdo 2 orë" (V81): hesht sapo objektivi i ditës mbyllet. Të gjitha kanë të njëjtin çelës: një gotë e
      // regjistruar e heq atë që është në panel, dhe plani i ri sjell të radhës.
      const total = (smart.logged.water[date] ?? []).reduce((sum, entry) => sum + entry.ml, 0)
      const wake = minutesOf(input.wakeTime)
      const span = (minutesOf(input.sleepTime) - wake + 1440) % 1440 || 1440
      if (total < waterTarget) {
        for (let minute = WATER_EVERY_MINUTES; minute <= span - 60; minute += WATER_EVERY_MINUTES) {
          dayItems.push({
            at: new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, wake + minute),
            title: t('reminders.notify.water', { total: litres(total), target: litres(waterTarget) }),
            body: t('reminders.notify.waterEvery'),
            kind: 'water',
            key: `water|${date}|`,
            data: { date, ml: GLASS_ML },
            actions: [{ id: 'drank', title: t('reminders.notify.drank') }],
            done: { drank: { title: t('reminders.notify.waterDone'), body: t('reminders.notify.waterDoneText', { total: litres(total + GLASS_ML), target: litres(waterTarget) }) } },
          })
        }
      }
    }
    if (smart && waterTarget && waterMode === 'behind' && input.toggles.water !== false && !smart.muted.water && !late) {
      const logs = smart.logged.water[date] ?? []
      const drunkBy = (at: Date) => logs.reduce((sum, entry) => (entry.at <= at.getTime() ? sum + entry.ml : sum), 0)
      const total = logs.reduce((sum, entry) => sum + entry.ml, 0)
      const wake = minutesOf(input.wakeTime)
      const span = (minutesOf(input.sleepTime) - wake + 1440) % 1440 || 1440
      for (const share of WATER_CHECKS) {
        const checkAt = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, wake + Math.round(span * share))
        const behind = (ml: number) => ml < waterTarget * share - GLASS_ML
        if (checkAt <= input.from) {
          if (behind(drunkBy(checkAt))) break
          continue
        }
        if (!behind(total)) continue
        dayItems.push({
          at: checkAt,
          title: t('reminders.notify.water', { total: litres(total), target: litres(waterTarget) }),
          body: t('reminders.notify.waterText'),
          kind: 'water',
          key: `water|${date}|`,
          data: { date, ml: GLASS_ML },
          actions: [{ id: 'drank', title: t('reminders.notify.drank') }],
          done: { drank: { title: t('reminders.notify.waterDone'), body: t('reminders.notify.waterDoneText', { total: litres(total + GLASS_ML), target: litres(waterTarget) }) } },
        })
        break
      }
    }

    // Orët e qeta që zgjedh përdoruesi: njoftimi bie në fund të intervalit.
    const quiet = smart?.quiet
    if (quiet) {
      const from = minutesOf(quiet.from)
      const to = minutesOf(quiet.to)
      for (const item of dayItems) {
        const minute = item.at.getHours() * 60 + item.at.getMinutes()
        const inside = from <= to ? minute >= from && minute < to : minute >= from || minute < to
        if (!inside) continue
        const moved = new Date(item.at.getFullYear(), item.at.getMonth(), item.at.getDate(), 0, to)
        if (moved < item.at) moved.setDate(moved.getDate() + 1)
        item.at = moved
      }
    }
    dayItems.sort((a, b) => a.at.getTime() - b.at.getTime())
    dayItems.forEach((item, index) => {
      if (item.at > input.from) reminders.push({ ...item, id: idBase + index })
    })
  }
  return reminders.sort((a, b) => a.at.getTime() - b.at.getTime() || a.id - b.id)
}

/** Dita e parë e stërvitjes pas `day`, brenda 7 ditëve. */
function nextTrainingDay(day: Date, isTraining: (date: Date) => boolean): Date | null {
  for (let offset = 1; offset <= 7; offset++) {
    const candidate = new Date(day.getFullYear(), day.getMonth(), day.getDate() + offset)
    if (isTraining(candidate)) return candidate
  }
  return null
}

/**
 * Rruga që hap një njoftim i prekur: "week|2026-11-16|" → përmbledhja e asaj jave; "checkin|2026-11-16|" → Sot me story-n e
 * parë pa përgjigje të gjendjes së ditës (V57; shikuesi zgjedh pyetjen); null për të tjerët.
 */
export function reminderRoute(key: string | null): string | null {
  const week = key ? /^week\|(\d{4}-\d{2}-\d{2})\|$/.exec(key) : null
  if (week) return `/progresi/java/${week[1]}`
  // "Mbyll ditën" (V82) hap ekranin e ditës së vet: sot, ose dje kur njoftimi preket pas mesnate.
  const close = key ? /^close\|(\d{4}-\d{2}-\d{2})\|$/.exec(key) : null
  if (close) return `/ushqimi/mbyll?data=${close[1]}`
  return key && /^checkin\|\d{4}-\d{2}-\d{2}\|$/.test(key) ? '/?fleta=gjendja' : null
}

/**
 * Njoftimet që duhen hequr nga paneli: ato të një vakti, suplementi ose uji të regjistruar ndërkohë,
 * që plani i ri nuk i ka më (V37).
 */
export function staleKeys(smart: SmartInput, reminders: readonly Reminder[]): string[] {
  const planned = new Set(reminders.map((item) => item.key).filter(Boolean))
  const keys = new Set<string>()
  for (const meal of smart.logged.meals) keys.add(`meal|${meal}`)
  for (const supplement of smart.logged.supplements) keys.add(`supplements|${supplement.split('|').slice(0, 2).join('|')}`)
  for (const [date, logs] of Object.entries(smart.logged.water)) if (logs.some((entry) => entry.ml > 0)) keys.add(`water|${date}|`)
  // "Mbyll ditën": hiqet sapo dita s'ka më vakte të hapura (plani i ri nuk e ka).
  for (const meal of smart.logged.meals) keys.add(`close|${meal.split('|')[0]}|`)
  return [...keys].filter((key) => !planned.has(key))
}
