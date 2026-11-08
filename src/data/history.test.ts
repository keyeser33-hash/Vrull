import { createFakeRemote } from '@/test/fake-remote'
import { createDatabase } from './db'
import { editSet, historyGlance, historyOverview, pastSession } from './history'
import { completeOnboarding } from './profile'
import { createLocalStore, type LocalStore } from './store'
import { createSync } from './sync'
import { CLEAN } from './tables'
import { finishWorkout, saveSet, type Segment, startWorkout, trainingSnapshot } from './training'

// Historiku mbi bazën lokale (V2-E1-15): seancat e mbyllura sipas javës së programit, seanca e
// kaluar me setet dhe rekordet, dhe ndryshimi i një seti që rillogarit rekordet dhe sinkronizohet.

const USER = '11111111-1111-4111-8111-111111111111'
const profile = { weightKg: 80, trainingDays: [7, 1, 2, 4], trainingTime: '17:15', wakeTime: '07:00', sleepTime: '23:00' }

interface Logged {
  weightKg: number | null
  reps: number
  rir?: number
  segments?: Segment[]
}

function setup() {
  const db = createDatabase(`history-${crypto.randomUUID()}`)
  let clock = new Date(2026, 9, 24, 9, 0)
  const now = () => clock
  const store = createLocalStore(db, { userId: () => USER, now })
  return { db, store, now, set: (at: Date) => (clock = at) }
}

type Context = ReturnType<typeof setup>

/** Një stërvitje e plotë në orën e dhënë: setet sipas emrit të ushtrimit, pastaj mbyllja pas `minutes`. */
async function workout(context: Context, start: Date, minutes: number, sets: Record<string, Logged[]>) {
  const { store } = context
  context.set(start)
  const snapshot = (await trainingSnapshot(store))!
  const sessionId = await startWorkout(store)
  let minute = 0
  for (const slot of snapshot.plan.slots) {
    const logged = sets[snapshot.exercises[slot.exerciseId].name] ?? []
    for (const [index, entry] of logged.entries()) {
      minute += 2
      context.set(new Date(start.getTime() + minute * 60_000))
      await saveSet(store, {
        sessionId,
        slot,
        setNumber: index + 1,
        weightKg: entry.weightKg,
        reps: entry.reps,
        rir: entry.rir ?? null,
        technique: entry.segments ? slot.technique.type : 'none',
        segments: entry.segments,
      })
    }
  }
  context.set(new Date(start.getTime() + minutes * 60_000))
  await finishWorkout(store, sessionId)
  return sessionId
}

const at = (month: number, day: number) => new Date(2026, month, day, 17, 15)

/** Java 0 e plotë dhe Faza 1 · Java 1 · Stërvitja 1, si te bordet (Bench Press 50 × 14 → 60 × 13). */
async function trained() {
  const context = setup()
  await completeOnboarding(context.store, profile, context.now)
  const weekZero = [
    await workout(context, at(9, 25), 48, { 'Bench Press': [1, 2, 3].map(() => ({ weightKg: 50, reps: 14, rir: 2 })), 'Standing Calf Raise': [{ weightKg: 50, reps: 28 }] }),
    await workout(context, at(9, 26), 51, { 'Barbell Curl': [{ weightKg: 25, reps: 14, rir: 2 }] }),
    await workout(context, at(9, 27), 41, { 'Dumbbell Shrug': [{ weightKg: 26, reps: 14, rir: 2 }] }),
    await workout(context, at(9, 29), 44, { Squat: [{ weightKg: 60, reps: 14, rir: 3 }] }),
  ]
  const chest = await workout(context, at(10, 1), 64, {
    'Bench Press': [
      { weightKg: 60, reps: 13 },
      { weightKg: 60, reps: 12 },
      { weightKg: 60, reps: 11 },
      { weightKg: 60, reps: 10, segments: [{ weightKg: 60, reps: 4 }] },
    ],
    'Standing Calf Raise': [{ weightKg: 60, reps: 28 }],
  })
  return { ...context, weekZero, chest }
}

const round1 = (value: number | null | undefined) => (value === null || value === undefined ? value : Math.round(value * 10) / 10)

describe('historiku i seancave', () => {
  it('seancat e mbyllura sipas javës së programit, e reja e para, me kohëzgjatjen, setet dhe rekordet', async () => {
    const { store, chest, weekZero } = await trained()
    // Një stërvitje e nisur, pa u mbyllur, nuk është ende historik.
    await startWorkout(store)

    const overview = await historyOverview(store)
    expect(overview).toMatchObject({ programName: 'Shortcut to Size', total: 5, first: '2026-10-25', weekStart: 0 })
    expect(overview.weeks.map((week) => [week.blockName, week.blockWeeks, week.week, week.done, week.days])).toEqual([
      ['Faza 1', 4, 1, 1, 4],
      ['Java 0', 1, 1, 4, 4],
    ])
    const [latest] = overview.weeks[0].sessions
    expect(latest).toMatchObject({ id: chest, date: '2026-11-01', dayNumber: 1, dayName: 'Gjoks, triceps, pulpa', minutes: 64, workSets: 5 })
    expect(latest.records).toHaveLength(1)
    expect(latest.records[0]).toMatchObject({ name: 'Bench Press' })
    expect(round1(latest.records[0].e1rmKg)).toBe(86)
    expect(overview.weeks[1].sessions.map((session) => session.id)).toEqual([...weekZero].reverse())
    expect(overview.weeks[1].sessions.map((session) => [session.dayNumber, session.minutes])).toEqual([
      [4, 44],
      [3, 41],
      [2, 51],
      [1, 48],
    ])
    // Seti i parë i ushtrimit nuk është rekord.
    expect(overview.weeks[1].sessions.every((session) => session.records.length === 0)).toBe(true)
    expect(overview.byDate['2026-11-01']).toEqual({ sessions: 1, records: 1 })
    expect(overview.byDate['2026-10-25']).toEqual({ sessions: 1, records: 0 })
    expect(overview.byDate['2026-11-08']).toBeUndefined()
  })

  it('pa seanca: lista bosh', async () => {
    const context = setup()
    await completeOnboarding(context.store, profile, context.now)
    expect(await historyOverview(context.store)).toMatchObject({ total: 0, first: null, weeks: [], byDate: {} })
    expect(await historyGlance(context.store)).toEqual({ total: 0, last: null })
  })

  it('shkurt për Progresin: sa seanca të mbyllura dhe data e së fundit', async () => {
    const { store } = await trained()
    await startWorkout(store)
    expect(await historyGlance(store)).toEqual({ total: 5, last: '2026-11-01' })
  })
})

describe('seanca e kaluar', () => {
  it('ushtrimet me radhë, e1RM e çdo seti, rekordi me setin e Javës 0, volumi dhe recetat', async () => {
    const { store, chest } = await trained()
    const session = (await pastSession(store, chest))!
    expect(session).toMatchObject({
      date: '2026-11-01',
      minutes: 64,
      blockName: 'Faza 1',
      blockWeeks: 4,
      week: 1,
      dayNumber: 1,
      dayName: 'Gjoks, triceps, pulpa',
      theme: 'chest',
      workSets: 5,
      recordsCount: 1,
    })
    expect(session.exercises.map((exercise) => exercise.name)).toEqual(['Bench Press', 'Standing Calf Raise'])
    const [bench, calf] = session.exercises
    expect(bench.sets.map((entry) => round1(entry.e1rmKg))).toEqual([86, 84, 82, 80])
    expect(bench.sets.map((entry) => entry.record !== null)).toEqual([true, false, false, false])
    expect(bench.sets[3]).toMatchObject({ technique: 'rest_pause', segments: [{ weightKg: 60, reps: 4 }] })
    expect(round1(bench.bestE1rmKg)).toBe(86)
    expect(round1(bench.record?.gainKg)).toBe(9.3)
    expect(bench.record?.previous).toMatchObject({ weightKg: 50, reps: 14, rir: 2, blockName: 'Java 0', blockWeeks: 1 })
    expect(bench).toMatchObject({ equipment: 'barbell', target: { kind: 'reps', min: 12, max: 15 }, technique: { type: 'rest_pause' }, restSeconds: 90 })
    expect(calf).toMatchObject({ bestE1rmKg: null, record: null })
    expect(session.volume).toEqual([
      { groupId: 'gjoksi', sets: 4 },
      { groupId: 'shpatullat', sets: 2 },
      { groupId: 'tricepsi', sets: 2 },
      { groupId: 'pulpat', sets: 1 },
    ])
    expect(session.summary).toEqual({ main: { min: 12, max: 15 }, others: [{ groupIds: ['pulpat'], range: { min: 25, max: 30 } }], techniques: ['rest_pause'] })
    expect(await pastSession(store, 'nuk-ekziston')).toBeNull()
  })
})

describe('ndryshimi i një seti', () => {
  it('rillogarit e1RM-në dhe rekordet: rekordi i setit 1 hiqet, seti 2 e merr', async () => {
    const { store, chest } = await trained()
    const before = (await pastSession(store, chest))!
    const [first, second] = before.exercises[0].sets
    await editSet(store, first.id, { weightKg: 50, reps: 13, rir: null })

    const after = (await pastSession(store, chest))!
    const bench = after.exercises[0]
    expect(round1(bench.sets[0].e1rmKg)).toBe(71.7)
    expect(bench.sets.map((entry) => entry.record !== null)).toEqual([false, true, false, false])
    expect(bench.record).toMatchObject({ setId: second.id })
    expect(round1(bench.record?.gainKg)).toBe(7.3)
    const overview = await historyOverview(store)
    expect(round1(overview.weeks[0].sessions[0].records[0].e1rmKg)).toBe(84)
  })

  it('krijon një rekord kur seti kalon më të mirin e mëparshëm, dhe e heq kur nuk e kalon', async () => {
    const { store, chest, weekZero } = await trained()
    const [, , third] = (await pastSession(store, weekZero[0]))!.exercises[0].sets
    // 50 × 15 me RIR 2 = 78,3: kalon 76,7 të dy seteve të para të Javës 0.
    await editSet(store, third.id, { weightKg: 50, reps: 15, rir: 2 })
    expect((await pastSession(store, weekZero[0]))!.recordsCount).toBe(1)
    // 86,0 i Javës 1 mbetet rekord, por tani kundrejt 78,3.
    expect(round1((await pastSession(store, chest))!.exercises[0].record?.gainKg)).toBe(7.7)
    await editSet(store, third.id, { weightKg: 50, reps: 14, rir: 2 })
    expect((await pastSession(store, weekZero[0]))!.recordsCount).toBe(0)
  })

  it('ndryshon vetëm peshën, përsëritjet dhe RIR-in; seti mbetet në vendin e vet', async () => {
    const { store, chest } = await trained()
    const set = (await pastSession(store, chest))!.exercises[0].sets[3]
    const row = await store.get('set_logs', set.id)
    await editSet(store, set.id, { weightKg: 57.5, reps: 11, rir: 1 })
    expect(await store.get('set_logs', set.id)).toMatchObject({
      weight_kg: 57.5,
      reps: 11,
      rir: 1,
      set_number: 4,
      technique: 'rest_pause',
      segments: [{ weight_kg: 60, reps: 4 }],
      logged_at: row!.logged_at,
      session_id: chest,
    })
  })

  it('refuzon vlerat që baza nuk i pranon', async () => {
    const { store, chest } = await trained()
    const { id } = (await pastSession(store, chest))!.exercises[0].sets[0]
    await expect(editSet(store, id, { weightKg: 60, reps: 0, rir: null })).rejects.toThrow()
    await expect(editSet(store, id, { weightKg: -1, reps: 10, rir: null })).rejects.toThrow()
    await expect(editSet(store, id, { weightKg: 60, reps: 10.5, rir: null })).rejects.toThrow()
    await expect(editSet(store, id, { weightKg: 60, reps: 10, rir: 11 })).rejects.toThrow()
    await expect(editSet(store, 'nuk-ekziston', { weightKg: 60, reps: 10, rir: null })).rejects.toThrow()
    expect(await store.get('set_logs', id)).toMatchObject({ weight_kg: 60, reps: 13 })
  })

  it('sinkronizohet: seti i ndryshuar arrin në server dhe mbetet i sinkronizuar në telefon', async () => {
    const context = await trained()
    const { db, store, chest } = context
    const remote = createFakeRemote()
    const sync = createSync({ db, remote, userId: () => USER, now: context.now })
    expect(await sync.run()).toMatchObject({ status: 'ok' })
    const { id } = (await pastSession(store, chest))!.exercises[0].sets[0]
    expect(remote.rows('set_logs').find((row) => row.id === id)).toMatchObject({ weight_kg: 60, reps: 13 })

    context.set(new Date(2026, 10, 8, 10, 0))
    await editSet(store, id, { weightKg: 60, reps: 12, rir: null })
    expect((await db.set_logs.get(id))?._dirty).not.toBe(CLEAN)
    expect(await sync.run()).toMatchObject({ status: 'ok', pushed: 1 })

    expect(remote.rows('set_logs').find((row) => row.id === id)).toMatchObject({ weight_kg: 60, reps: 12, session_id: chest })
    expect((await db.set_logs.get(id))?._dirty).toBe(CLEAN)
  })
})

// Një telefon i dytë merr ndryshimin dhe rekordet i rillogarit vetë (rekordet nuk ruhen në server).
describe('ndryshimi nga një telefon tjetër', () => {
  it('rekordet ndjekin setin e ndryshuar pas sinkronizimit', async () => {
    const phone = await trained()
    const remote = createFakeRemote()
    await createSync({ db: phone.db, remote, userId: () => USER, now: phone.now }).run()
    const other = createDatabase(`history-other-${crypto.randomUUID()}`)
    const otherStore: LocalStore = createLocalStore(other, { userId: () => USER, now: phone.now })
    const otherSync = createSync({ db: other, remote, userId: () => USER, now: phone.now })
    await otherSync.run()
    expect((await pastSession(otherStore, phone.chest))!.recordsCount).toBe(1)

    const { id } = (await pastSession(phone.store, phone.chest))!.exercises[0].sets[0]
    phone.set(new Date(2026, 10, 8, 10, 0))
    await editSet(phone.store, id, { weightKg: 45, reps: 13, rir: null })
    await createSync({ db: phone.db, remote, userId: () => USER, now: phone.now }).run()
    await otherSync.run()
    const bench = (await pastSession(otherStore, phone.chest))!.exercises[0]
    expect(bench.sets[0]).toMatchObject({ weightKg: 45, reps: 13, record: null })
    expect(bench.record?.setId).toBe(bench.sets[1].id)
  })
})
