import Dexie from 'dexie'
import { createFakeRemote } from '@/test/fake-remote'
import { createLanguageStore } from '@/i18n/language'
import { createBackgroundStore } from '@/lib/background'
import { readTheme } from '@/lib/theme'
import { adoptSavedBackground, savedBackground } from './background'
import { createDatabase, type LocalDatabase } from './db'
import { adoptSavedLanguage, savedLanguage } from './language'
import { logTemplateMeal, nutritionDay } from './nutrition'
import { addPhoto, photoTimeline } from './photos'
import { completeOnboarding, readProfile } from './profile'
import { metricHistory, saveMeasurement } from './progress'
import { reminderSettings, setMeasurementDay, setReminderToggle } from './reminders'
import { createLocalStore, type LocalStore } from './store'
import { ensureSupplements, supplementList, toggleSupplement } from './supplements'
import { createSync } from './sync'
import { finishWorkout, saveSet, startWorkout, trainingHistory, trainingSnapshot } from './training'
import { CLEAN, TABLES, type TableName } from './tables'

// V2-E1-05: të dhënat e v1 (0.16.0) në telefonin e përdoruesit kalojnë të paprekura në v2. Baza e v1
// ndërtohet me skemën e ngrirë të 0.16.0 dhe me rrugët e app-it (hyrja, seanca, matja, ushqimi,
// suplementet, fotoja, rikujtuesit); pastaj hapet nga v2 (createDatabase), lokalisht dhe nga Supabase.

const USER = '11111111-1111-4111-8111-111111111111'

// Skema lokale e 0.16.0, e ngrirë: tabelat dhe indekset e versionit 1, skedarët e fotove te versioni 2.
// Mos e ndrysho: v2 duhet ta hapë këtë bazë siç është në telefon.
const V1_SCHEMA: Record<string, string> = {
  _meta: 'key',
  exercises: 'id, _dirty, library_id',
  programs: 'id, _dirty',
  program_blocks: 'id, _dirty, program_id',
  program_days: 'id, _dirty, program_id',
  program_slots: 'id, _dirty, program_id, day_id',
  slot_prescriptions: 'id, _dirty, program_id, slot_id',
  program_state: 'id, _dirty, program_id',
  workout_sessions: 'id, _dirty, date, program_id',
  set_logs: 'id, _dirty, session_id, exercise_id',
  one_rm_overrides: 'id, _dirty, exercise_id',
  body_measurements: 'id, _dirty, date',
  progress_photos: 'id, _dirty, date',
  foods: 'id, _dirty, [source+source_id]',
  recipes: 'id, _dirty',
  recipe_items: 'id, _dirty, recipe_id',
  meal_templates: 'id, _dirty',
  diary_entries: 'id, _dirty, date',
  nutrition_targets: 'id, _dirty, date',
  supplements: 'id, _dirty',
  supplement_logs: 'id, _dirty, date, supplement_id',
  user_settings: 'id, _dirty',
}

/** Tabelat e sinkronizuara të v1: v2 shton të reja (p.sh. week_weights), që baza e v1 nuk i ka. */
const V1_TABLES = TABLES.filter((table) => table in V1_SCHEMA)

function openV1(name: string): LocalDatabase {
  const db = new Dexie(name) as LocalDatabase
  db.version(1).stores(V1_SCHEMA)
  db.version(2).stores({ _photo_files: 'id, uploaded' })
  return db
}

const TODAY = '2026-11-02'
let clock = Date.parse(`${TODAY}T07:00:00.000Z`)
const now = () => new Date(clock)
const tick = (ms = 60_000) => {
  clock += ms
}

const storeFor = (db: LocalDatabase) => createLocalStore(db, { userId: () => USER, now })

/**
 * Dyqani i fazës v1: kodi i v2 që përdoret për të krijuar të dhënat e v1 lexon edhe tabela që v1 nuk
 * i kishte (p.sh. `weekly_checks`); në bazën e v1 ato lexohen bosh, si te v1.
 */
function v1StoreFor(db: LocalDatabase): LocalStore {
  const store = storeFor(db)
  const missing = (table: TableName) => !(table in V1_SCHEMA)
  return {
    ...store,
    all: (table) => (missing(table) ? Promise.resolve([]) : store.all(table)),
    where: (table, index, value) => (missing(table) ? Promise.resolve([]) : store.where(table, index, value)),
  }
}

/** Një javë e parë në v1: hapat e parë, Stërvitja 1 me dy sete, matja, një vakt, suplementet, një foto. */
async function useV1(store: LocalStore, db: LocalDatabase) {
  await completeOnboarding(store, { weightKg: 80, trainingDays: [1, 2, 4, 5], trainingTime: '18:00', wakeTime: '07:00', sleepTime: '23:00' }, now)
  await setReminderToggle(store, 'meals', false)
  await setMeasurementDay(store, 3)
  tick()
  const sessionId = await startWorkout(store)
  const snapshot = (await trainingSnapshot(store))!
  const [slot] = snapshot.plan.slots
  for (const setNumber of [1, 2]) {
    tick()
    await saveSet(store, { sessionId, slot, setNumber, weightKg: 60, reps: 10, rir: 2 })
  }
  tick()
  await finishWorkout(store, sessionId)
  await saveMeasurement(store, TODAY, { weight_kg: 80.4, waist_cm: 84 })
  await logTemplateMeal(store, TODAY, 'breakfast_1')
  await ensureSupplements(store)
  const [supplement] = await supplementList(store)
  await toggleSupplement(store, { date: TODAY, supplementId: supplement.id, meal: 'breakfast_1' })
  await addPhoto(store, db, { date: TODAY, pose: 'front', data: new Uint8Array([1, 2, 3]).buffer, width: 1200, height: 1600 })
}

async function snapshotOf(db: LocalDatabase) {
  const entries = await Promise.all([...V1_TABLES, '_meta', '_photo_files'].map(async (table) => [table, await db.table(table).toArray()] as const))
  return Object.fromEntries(entries)
}

/** Çfarë sheh përdoruesi nga të dhënat, me leximet e ekraneve. */
async function whatTheUserSees(store: LocalStore, db: LocalDatabase) {
  const history = await trainingHistory(store)
  const day = await nutritionDay(store, TODAY, now())
  return {
    sets: history.sets.map((set) => [set.setNumber, set.weightKg, set.reps, set.rir]),
    worked: history.worked.length,
    pointer: (await trainingSnapshot(store))?.label,
    weight: await metricHistory(store, 'weight_kg'),
    waist: await metricHistory(store, 'waist_cm'),
    profile: await readProfile(store),
    reminders: await reminderSettings(store),
    breakfast: day.meals.find((meal) => meal.meal === 'breakfast_1')?.entries.length,
    supplementsTaken: day.meals.flatMap((meal) => meal.supplements).filter((item) => item.taken).length,
    photos: (await photoTimeline(store, db)).map((entry) => [entry.date, Object.keys(entry.photos)]),
  }
}

describe('të dhënat e v1 në v2', () => {
  beforeEach(() => {
    window.localStorage.clear()
    clock = Date.parse(`${TODAY}T07:00:00.000Z`)
  })

  it('baza lokale e v1 hapet në v2 pa humbur asnjë rresht, dhe ekranet shohin të njëjtat të dhëna', async () => {
    const name = `v1-local-${crypto.randomUUID()}`
    const v1 = openV1(name)
    const v1Store = v1StoreFor(v1)
    await useV1(v1Store, v1)
    // Tema e v1 ruhej vetëm në telefon.
    window.localStorage.setItem('th-theme', 'light')
    const before = await snapshotOf(v1)
    const seen = await whatTheUserSees(v1Store, v1)
    v1.close()

    expect(seen.sets).toEqual([
      [1, 60, 10, 2],
      [2, 60, 10, 2],
    ])
    expect(seen.worked).toBe(1)
    expect(seen.breakfast).toBeGreaterThan(0)
    expect(seen.supplementsTaken).toBe(1)

    const v2 = createDatabase(name)
    const v2Store = storeFor(v2)
    expect(await snapshotOf(v2)).toEqual(before)
    expect(await whatTheUserSees(v2Store, v2)).toEqual(seen)
    expect(readTheme()).toBe('light')

    // Cilësimet e reja të v2 mungojnë te rreshti i v1 dhe marrin vlerat e telefonit, pa prekur të tjerat.
    const [settingsBefore] = before.user_settings
    expect(settingsBefore).not.toHaveProperty('language')
    expect(settingsBefore).not.toHaveProperty('background')
    expect(await savedLanguage(v2Store)).toBeNull()
    expect(await savedBackground(v2Store)).toBeNull()
    await adoptSavedLanguage(v2Store, createLanguageStore())
    await adoptSavedBackground(v2Store, createBackgroundStore())
    const [settingsAfter] = await v2.user_settings.toArray()
    expect(settingsAfter).toMatchObject({ language: 'sq', background: 'solid' })
    const { language: _language, background: _background, updated_at: _updated, _dirty: _state, ...kept } = settingsAfter
    const { updated_at: _updatedBefore, _dirty: _stateBefore, ...keptBefore } = settingsBefore
    expect(kept).toEqual(keptBefore)
    expect(await whatTheUserSees(v2Store, v2)).toEqual(seen)
    v2.close()
  })

  it('rreshtat e v1 në Supabase (pa kolonat e reja) vijnë të plotë në një instalim të ri të v2', async () => {
    const remote = createFakeRemote()
    const v1 = openV1(`v1-phone-${crypto.randomUUID()}`)
    const v1Store = v1StoreFor(v1)
    await useV1(v1Store, v1)
    expect(await createSync({ db: v1, remote, userId: () => USER, now, tables: V1_TABLES }).run()).toMatchObject({ status: 'ok', rejected: 0 })
    const seen = await whatTheUserSees(v1Store, v1)
    const [serverSettings] = remote.rows('user_settings')
    expect(serverSettings).not.toHaveProperty('language')
    expect(serverSettings).not.toHaveProperty('background')

    const v2 = createDatabase(`v2-phone-${crypto.randomUUID()}`)
    const v2Store = storeFor(v2)
    expect(await createSync({ db: v2, remote, userId: () => USER, now }).run()).toMatchObject({ status: 'ok', rejected: 0 })
    for (const table of TABLES as readonly TableName[]) {
      const local = (await v2[table].toArray()).map(({ _dirty, ...row }) => {
        expect(_dirty).toBe(CLEAN)
        return row
      })
      const byId = (rows: { id: string }[]) => [...rows].sort((a, b) => a.id.localeCompare(b.id))
      expect(byId(local), table).toEqual(byId(remote.rows(table)))
    }
    // Skedari i fotos jeton vetëm në telefonin e v1 dhe në bucket; rreshti i saj vjen.
    const { photos: _photos, ...rest } = await whatTheUserSees(v2Store, v2)
    const { photos: _v1Photos, ...expected } = seen
    expect(rest).toEqual(expected)
    expect(await photoTimeline(v2Store, v2)).toEqual([expect.objectContaining({ date: TODAY, photos: { front: expect.objectContaining({ id: expect.any(String) }) } })])

    // Pas hapjes, v2 shton gjuhën dhe sfondin te rreshti dhe i dërgon; asgjë tjetër nuk ndryshon.
    await adoptSavedLanguage(v2Store, createLanguageStore())
    await adoptSavedBackground(v2Store, createBackgroundStore())
    tick()
    expect(await createSync({ db: v2, remote, userId: () => USER, now }).run()).toMatchObject({ status: 'ok', rejected: 0 })
    const [updated] = remote.rows('user_settings')
    expect(updated).toMatchObject({ language: 'sq', background: 'solid', training_days: serverSettings.training_days, measurement_day: 3 })
    v1.close()
    v2.close()
  })
})
