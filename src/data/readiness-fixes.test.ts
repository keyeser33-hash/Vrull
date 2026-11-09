import { normalizeCheckIn, saveDailyState } from './daily-state'
import { chooseLighter, postponeWorkout, undoPostpone } from './day-choice'
import { createDatabase } from './db'
import { historyOverview } from './history'
import { setDayType } from './nutrition'
import { completeOnboarding } from './profile'
import { readinessView } from './readiness-view'
import { createLocalStore } from './store'
import { todayView } from './today'
import { finishWorkout, saveSet, startWorkout, trainingSnapshot } from './training'

// Ndreqjet pas rishikimit të valës së gatishmërisë (V50): çdo provë u shkrua para ndreqjes dhe ra te kodi i
// atëhershëm (gjetjet P2-A2, A3, A4, A5, C1, C2, C4 dhe P3-A6, A7).

const USER = '11111111-1111-4111-8111-111111111111'
const at = (day: number, month: number, hours = 10, minutes = 0) => new Date(2026, month - 1, day, hours, minutes)
const PROFILE = { weightKg: 80, trainingDays: [7, 1, 2, 4], trainingTime: '17:15', wakeTime: '07:00', sleepTime: '23:00' }
const CHECK_IN = { mood: 2, energy: 2, sleepMinutes: 330, sleepQuality: 2, soreness: 3, soreGroups: ['gjoksi'] } as const

function setup() {
  let clock = at(25, 10, 9)
  const store = createLocalStore(createDatabase(`fixes-${crypto.randomUUID()}`), { userId: () => USER, now: () => clock })
  return { store, setClock: (date: Date) => (clock = date) }
}
type Context = ReturnType<typeof setup>

async function train(context: Context, date: Date, sets: { weightKg: number; reps: number; rir?: number }[]) {
  context.setClock(date)
  const sessionId = await startWorkout(context.store)
  const [first] = (await trainingSnapshot(context.store))!.plan.slots
  for (const [index, set] of sets.entries()) await saveSet(context.store, { sessionId, slot: first, setNumber: index + 1, ...set })
  context.setClock(new Date(date.getTime() + 66 * 60_000))
  await finishWorkout(context.store, sessionId)
  return sessionId
}

/** Java 0 dhe java 1 e Fazës 1; seanca e fundit e enjtja 5 nëntor (si te lighter-session.test.ts). */
async function lastTrainedThursday() {
  const context = setup()
  await completeOnboarding(context.store, PROFILE, () => at(25, 10, 9))
  for (const day of [25, 26, 27, 29]) await train(context, at(day, 10, 17, 15), [{ weightKg: 50, reps: 14, rir: 2 }])
  await train(context, at(1, 11, 17, 15), [{ weightKg: 60, reps: 13 }])
  for (const day of [2, 3, 5]) await train(context, at(day, 11, 17, 15), [{ weightKg: 40, reps: 10 }])
  return context
}

const checkIn = (context: Context, date: string) => saveDailyState(context.store, date, { ...CHECK_IN, soreGroups: [...CHECK_IN.soreGroups] })
const setsOf = async (context: Context) => (await trainingSnapshot(context.store))!.plan.slots.map((slot) => slot.sets)

describe('P2-A5: vendimi nuk humbet kur telefoni tjetër bën check-in', () => {
  it('rreshtat e dy telefonave bashkohen (i fundit fiton për rresht) dhe vendimi mbetet', async () => {
    let clockA = at(12, 11, 7, 30)
    let clockB = at(12, 11, 7, 45)
    const a = createLocalStore(createDatabase(`a-${crypto.randomUUID()}`), { userId: () => USER, now: () => clockA })
    const b = createLocalStore(createDatabase(`b-${crypto.randomUUID()}`), { userId: () => USER, now: () => clockB })
    await saveDailyState(a, '2026-11-12', { ...CHECK_IN, soreGroups: ['gjoksi'] })
    clockA = at(12, 11, 7, 31)
    await chooseLighter(a, '2026-11-12')
    // B nuk e ka rreshtin e A dhe bën check-in me orë më të re.
    await saveDailyState(b, '2026-11-12', { ...CHECK_IN, mood: 3, soreGroups: ['gjoksi'] })
    // Sinkronizimi: për çdo (tabelë, id) fiton rreshti me updated_at më të ri.
    const merged = new Map<string, Record<string, unknown>>()
    for (const store of [a, b]) {
      for (const table of ['daily_states', 'daily_choices'] as const) {
        for (const row of await store.all(table)) {
          const key = `${table}:${row.id}`
          const kept = merged.get(key)
          if (!kept || String(row.updated_at) > String(kept.updated_at)) merged.set(key, row)
        }
      }
    }
    expect([...merged.values()].some((row) => row.choice === 'lighter')).toBe(true)
  })
})

describe('P2-A3 dhe P3-C4: një datë vendimi (dita e ushqimit) për të gjithë lexuesit', () => {
  it('seancë e nisur në 00:30 mban "më të lehtë": setet nuk kthehen dhe historiku e njeh', async () => {
    const context = await lastTrainedThursday()
    context.setClock(at(12, 11, 0, 30))
    // 00:30 me zgjim 07:00: dita e ushqimit është ende e mërkura 11.
    const view = await todayView(context.store)
    expect(view.date).toBe('2026-11-11')
    await checkIn(context, view.date)
    const normal = await setsOf(context)
    await chooseLighter(context.store, view.date)
    const lighter = await setsOf(context)
    expect(lighter).not.toEqual(normal)
    const sessionId = await startWorkout(context.store)
    expect(await setsOf(context)).toEqual(lighter)
    const [first] = (await trainingSnapshot(context.store))!.plan.slots
    await saveSet(context.store, { sessionId, slot: first, setNumber: 1, weightKg: 50, reps: 10 })
    context.setClock(at(12, 11, 1, 40))
    await finishWorkout(context.store, sessionId)
    const history = await historyOverview(context.store)
    const session = history.weeks.flatMap((week) => week.sessions).find((entry) => entry.id === sessionId)
    expect(session?.lighter).toBe(true)
  })
})

describe('P2-C1: pas mbylljes së seancës më të lehtë stërvitja e radhës është normale', () => {
  it('stërvitja e radhës nuk lehtësohet', async () => {
    const context = await lastTrainedThursday()
    context.setClock(at(12, 11, 10))
    await checkIn(context, '2026-11-12')
    const normal = await setsOf(context)
    await chooseLighter(context.store, '2026-11-12')
    expect(await setsOf(context)).not.toEqual(normal)
    await train(context, at(12, 11, 17, 15), [{ weightKg: 50, reps: 10 }])
    context.setClock(at(12, 11, 21))
    const view = await todayView(context.store)
    expect(view.mode).toBe('done')
    const next = await trainingSnapshot(context.store)
    // Stërvitja e radhës është një tjetër; nuk ka asnjë set të hequr nga lehtësimi i së mëparshmes.
    const planned = next!.plan.slots.map((slot) => slot.sets)
    context.setClock(at(12, 11, 21, 5))
    expect(planned).toEqual(await setsOf(context))
    const reference = await lastTrainedThursday()
    await train(reference, at(12, 11, 17, 15), [{ weightKg: 50, reps: 10 }])
    reference.setClock(at(12, 11, 21))
    expect(planned).toEqual(await setsOf(reference))
  })
})

describe('P2-A2: nisja e stërvitjes e anulon shtyrjen', () => {
  it('e premtja mbetet pushim dhe e shtuna nuk është ditë e humbur', async () => {
    const context = await lastTrainedThursday()
    context.setClock(at(12, 11, 10))
    await checkIn(context, '2026-11-12')
    expect(await postponeWorkout(context.store, '2026-11-12')).toBe(true)
    await train(context, at(12, 11, 17, 15), [{ weightKg: 55, reps: 10 }])
    context.setClock(at(13, 11, 10))
    const friday = await todayView(context.store)
    expect(friday.mode).toBe('rest')
    context.setClock(at(14, 11, 10))
    const saturday = await todayView(context.store)
    expect(saturday.missed).toBeNull()
    expect(saturday.week.find((day) => day.date === '2026-11-13')?.state).toBe('rest')
  })

  it('kthen llojet e zgjedhura me dorë para shtyrjes', async () => {
    const context = await lastTrainedThursday()
    context.setClock(at(12, 11, 10))
    await checkIn(context, '2026-11-12')
    await setDayType(context.store, '2026-11-13', 'rest')
    expect(await postponeWorkout(context.store, '2026-11-12')).toBe(true)
    await startWorkout(context.store)
    const row = (await context.store.where('nutrition_targets', 'date', '2026-11-13'))[0]
    expect(row?.is_manual ? row.day_type : null).toBe('rest')
  })
})

describe('P3-A6: nextDate e shtyrjes ndjek ditën e ushqimit', () => {
  it('në 00:30 të nesërmes kalendarike stërvitja kalon "nesër" = e premtja', async () => {
    const context = await lastTrainedThursday()
    context.setClock(at(12, 11, 10))
    await checkIn(context, '2026-11-12')
    expect(await postponeWorkout(context.store, '2026-11-12')).toBe(true)
    context.setClock(at(13, 11, 0, 30))
    const view = await todayView(context.store)
    expect(view.postponed).toBe(true)
    expect(view.nextDate).toBe('2026-11-13')
  })
})

describe('P2-C2 dhe P2-S1: gatishmëria nga rreshti', () => {
  it('përqindja nuk ndryshon pas shtyrjes', async () => {
    const context = await lastTrainedThursday()
    context.setClock(at(12, 11, 10))
    await checkIn(context, '2026-11-12')
    const before = (await readinessView(context.store)).readiness?.percent
    expect(await postponeWorkout(context.store, '2026-11-12')).toBe(true)
    expect((await readinessView(context.store)).readiness?.percent).toBe(before)
  })
})

describe('P2-A4: kufiri i grupeve me dhimbje', () => {
  it('15 grupe mbahen të gjitha', () => {
    const groups = ['gjoksi', 'shpatullat', 'trapezi', 'shpina', 'mesi', 'bicepsi', 'tricepsi', 'parakrahet', 'barku', 'vithet', 'kuadricepsi', 'kofshet-e-pasme', 'aduktoret', 'pulpat', 'qafa']
    expect(normalizeCheckIn({ ...CHECK_IN, soreGroups: groups }).soreGroups).toEqual(groups)
  })
})

describe('P3-A7: "Ktheje për sot" rikthen llojet nga vendimi, jo nga ky telefon', () => {
  it('një telefon tjetër e kthen shtyrjen siç ishte', async () => {
    const context = await lastTrainedThursday()
    context.setClock(at(12, 11, 10))
    await checkIn(context, '2026-11-12')
    await setDayType(context.store, '2026-11-13', 'rest')
    expect(await postponeWorkout(context.store, '2026-11-12')).toBe(true)
    // Telefoni tjetër nuk e ka vlerën e ruajtur vetëm në pajisje.
    await context.store.writeDevice('postponed-from:2026-11-12', undefined)
    expect(await undoPostpone(context.store, '2026-11-12')).toBe(true)
    const row = (await context.store.where('nutrition_targets', 'date', '2026-11-13'))[0]
    expect(row?.is_manual ? row.day_type : null).toBe('rest')
  })
})
