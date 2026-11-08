import { createFakeRemote, type FakeRemote } from '@/test/fake-remote'
import { createDatabase, type LocalDatabase } from './db'
import { createLocalStore, type LocalStore } from './store'
import { createSync } from './sync'
import { CLEAN, PENDING, REJECTED, type Row } from './tables'

const USER = '11111111-1111-4111-8111-111111111111'

interface Device {
  db: LocalDatabase
  store: LocalStore
  sync: ReturnType<typeof createSync>
  tick: (ms?: number) => void
}

// Një "telefon": baza e vet lokale, ora e vet, i njëjti server.
function device(remote: FakeRemote, options: { userId?: string | null; pageSize?: number } = {}): Device {
  const db = createDatabase(`sync-${crypto.randomUUID()}`)
  let clock = Date.parse('2026-11-30T08:00:00.000Z')
  const now = () => new Date(clock)
  const userId = () => (options.userId === undefined ? USER : options.userId)
  return {
    db,
    store: createLocalStore(db, { userId, now }),
    sync: createSync({ db, remote, userId, now, pageSize: options.pageSize ?? 200 }),
    tick: (ms = 1000) => {
      clock += ms
    },
  }
}

const serverRow = (values: Record<string, unknown>): Row => ({
  id: crypto.randomUUID(),
  user_id: USER,
  created_at: '2026-11-30T07:00:00.000Z',
  updated_at: '2026-11-30T07:00:00.000Z',
  deleted_at: null,
  ...values,
})

describe('sinkronizimi', () => {
  let remote: FakeRemote
  beforeEach(() => {
    remote = createFakeRemote()
  })

  it('dërgon rreshtat që presin dhe i shënon të sinkronizuar me kursorin e serverit', async () => {
    const phone = device(remote)
    const row = await phone.store.put('body_measurements', { date: '2026-11-30', weight_kg: 80 })

    const result = await phone.sync.run()

    expect(result).toMatchObject({ status: 'ok', pushed: 1, rejected: 0 })
    expect(remote.rows('body_measurements')).toMatchObject([{ id: row.id, weight_kg: 80, user_id: USER }])
    const local = await phone.db.body_measurements.get(row.id)
    expect(local?._dirty).toBe(CLEAN)
    expect(local?.server_updated_at).toBe(remote.rows('body_measurements')[0].server_updated_at)
  })

  it('nuk dërgon kurrë fushat lokale', async () => {
    const phone = device(remote)
    await phone.store.put('foods', { source: 'custom', name: 'Vezë', kcal: 143, protein_g: 12.6, carbs_g: 0.7, fat_g: 9.5 })
    await phone.sync.run()
    expect(Object.keys(remote.rows('foods')[0]).filter((key) => key.startsWith('_'))).toEqual([])
  })

  it('pa internet: asgjë nuk humbet, dhe dërgohet kur kthehet rrjeti', async () => {
    const phone = device(remote)
    const session = await phone.store.put('workout_sessions', { date: '2026-11-30', status: 'in_progress' })
    const set = await phone.store.put('set_logs', {
      session_id: session.id,
      exercise_id: crypto.randomUUID(),
      position: 0,
      set_number: 1,
      weight_kg: 60,
      reps: 12,
    })
    remote.offline = true

    expect(await phone.sync.run()).toMatchObject({ status: 'offline', pushed: 0 })
    expect((await phone.db.set_logs.get(set.id))?._dirty).toBe(PENDING)

    remote.offline = false
    expect(await phone.sync.run()).toMatchObject({ status: 'ok', pushed: 2 })
    expect(remote.rows('set_logs')).toMatchObject([{ id: set.id, weight_kg: 60, reps: 12 }])
  })

  it('dërgon prindin para fëmijës', async () => {
    const phone = device(remote)
    const program = await phone.store.put('programs', { name: 'Shortcut to Size' })
    await phone.store.put('program_days', { program_id: program.id, position: 0, name: 'Dita 1' })
    // Fëmija shkruhet para prindit në telefon, por dërgohet pas tij.
    const exercise = await phone.store.put('exercises', { name: 'Bench Press', equipment: 'barbell' })
    void exercise
    await phone.sync.run()
    const order = remote.calls.filter((call) => call.op === 'upsert').map((call) => call.table)
    expect(order).toEqual(['exercises', 'programs', 'program_days'])
  })

  it('merr ndryshimet e serverit dhe nuk i rimerr herën tjetër', async () => {
    const phone = device(remote)
    const food = remote.serverWrite('foods', serverRow({ source: 'custom', name: 'Oriz', kcal: 130, protein_g: 2.7, carbs_g: 28, fat_g: 0.3 }))

    expect(await phone.sync.run()).toMatchObject({ status: 'ok', pulled: 1 })
    expect(await phone.store.get('foods', food.id)).toMatchObject({ name: 'Oriz', _dirty: CLEAN })

    expect(await phone.sync.run()).toMatchObject({ status: 'ok', pulled: 0 })
  })

  it('faqet: shumë rreshta me të njëjtën kohë serveri merren të gjithë, pa dyfishim', async () => {
    const phone = device(remote, { pageSize: 50 })
    remote.fixedTimestamp = '2026-12-01T10:00:00.123456+00:00'
    for (let i = 0; i < 130; i++) remote.serverWrite('supplement_logs', serverRow({ date: '2026-11-30', timing: 'bedtime', supplement_id: `s${i}` }))
    remote.fixedTimestamp = null

    expect(await phone.sync.run()).toMatchObject({ pulled: 130 })
    expect(await phone.db.supplement_logs.count()).toBe(130)
  })

  it('konflikt: ndryshimi më i ri në server fiton mbi një ndryshim më të vjetër në telefon', async () => {
    const phone = device(remote)
    const row = await phone.store.put('body_measurements', { date: '2026-11-30', weight_kg: 80 })
    await phone.sync.run()

    // Telefoni ndryshon offline në 08:00:01; një pajisje tjetër ndryshon në 08:00:05.
    phone.tick()
    await phone.store.put('body_measurements', { id: row.id, weight_kg: 81 })
    remote.serverWrite('body_measurements', { ...remote.rows('body_measurements')[0], weight_kg: 82, updated_at: '2026-11-30T08:00:05.000Z' })

    expect(await phone.sync.run()).toMatchObject({ status: 'ok' })
    expect(remote.rows('body_measurements')[0].weight_kg).toBe(82)
    expect(await phone.store.get('body_measurements', row.id)).toMatchObject({ weight_kg: 82, _dirty: CLEAN })
  })

  it('konflikt: ndryshimi më i ri në telefon fiton mbi një më të vjetër në server', async () => {
    const phone = device(remote)
    const row = await phone.store.put('body_measurements', { date: '2026-11-30', weight_kg: 80 })
    await phone.sync.run()

    remote.serverWrite('body_measurements', { ...remote.rows('body_measurements')[0], weight_kg: 82, updated_at: '2026-11-30T08:00:02.000Z' })
    phone.tick(5000)
    await phone.store.put('body_measurements', { id: row.id, weight_kg: 81 })

    await phone.sync.run()
    expect(remote.rows('body_measurements')[0].weight_kg).toBe(81)
    expect(await phone.store.get('body_measurements', row.id)).toMatchObject({ weight_kg: 81, _dirty: CLEAN })
  })

  it('fshirja arrin në server dhe në një pajisje tjetër', async () => {
    const phone = device(remote)
    const other = device(remote)
    const entry = await phone.store.put('diary_entries', { date: '2026-11-30', meal: 'lunch', kcal: 500 })
    await phone.sync.run()
    await other.sync.run()
    expect(await other.store.get('diary_entries', entry.id)).toBeDefined()

    phone.tick()
    await phone.store.remove('diary_entries', entry.id)
    await phone.sync.run()
    expect(remote.rows('diary_entries')[0].deleted_at).toBe('2026-11-30T08:00:01.000Z')

    await other.sync.run()
    expect(await other.store.get('diary_entries', entry.id)).toBeUndefined()
    expect(await other.store.all('diary_entries')).toEqual([])
  })

  it('një rresht i refuzuar nuk bllokon të tjerët dhe provohet përsëri pasi ndreqet', async () => {
    const phone = device(remote)
    remote.rejectWhen = (table, row) => (table === 'foods' && Number(row.kcal) < 0 ? 'kcal >= 0' : null)
    const good = await phone.store.put('foods', { source: 'custom', name: 'Vezë', kcal: 143, protein_g: 12.6, carbs_g: 0.7, fat_g: 9.5 })
    const bad = await phone.store.put('foods', { source: 'custom', name: 'Gabim', kcal: -5, protein_g: 0, carbs_g: 0, fat_g: 0 })
    const later = await phone.store.put('supplements', { name: 'Creatine' })

    const result = await phone.sync.run()
    expect(result).toMatchObject({ status: 'error', rejected: 1 })
    expect(remote.rows('foods').map((row) => row.id)).toEqual([good.id])
    expect(remote.rows('supplements').map((row) => row.id)).toEqual([later.id])
    expect(await phone.db.foods.get(bad.id)).toMatchObject({ _dirty: REJECTED, _error: 'kcal >= 0' })

    await phone.store.put('foods', { id: bad.id, kcal: 50 })
    expect(await phone.sync.run()).toMatchObject({ status: 'ok', rejected: 0 })
    expect(remote.rows('foods')).toHaveLength(2)
  })

  it('një ndryshim i bërë gjatë dërgimit nuk humbet', async () => {
    const phone = device(remote)
    const row = await phone.store.put('body_measurements', { date: '2026-11-30', weight_kg: 80 })
    const upsert = remote.upsert.bind(remote)
    remote.upsert = async (table, rows) => {
      // Përdoruesi ndryshon peshën ndërkohë që kërkesa është në rrugë.
      phone.tick()
      await phone.store.put('body_measurements', { id: row.id, weight_kg: 79 })
      return upsert(table, rows)
    }
    await phone.sync.run()
    remote.upsert = upsert

    expect(await phone.db.body_measurements.get(row.id)).toMatchObject({ weight_kg: 79, _dirty: PENDING })
    await phone.sync.run()
    expect(remote.rows('body_measurements')[0].weight_kg).toBe(79)
  })

  it('një ndryshim gjatë dërgimit në të njëjtën milisekondë (ose me orën mbrapa) nuk humbet', async () => {
    const phone = device(remote)
    const row = await phone.store.put('body_measurements', { date: '2026-11-30', weight_kg: 80 })
    const upsert = remote.upsert.bind(remote)
    remote.upsert = async (table, rows) => {
      // Pa lëvizur orën: dy shkrime në të njëjtën milisekondë, ose ora e telefonit u kthye mbrapa.
      await phone.store.put('body_measurements', { id: row.id, weight_kg: 79 })
      return upsert(table, rows)
    }
    await phone.sync.run()
    remote.upsert = upsert

    expect(await phone.db.body_measurements.get(row.id)).toMatchObject({ weight_kg: 79, _dirty: PENDING })
    await phone.sync.run()
    expect(remote.rows('body_measurements')[0].weight_kg).toBe(79)
  })

  it('pa përdorues nuk prek rrjetin', async () => {
    const phone = device(remote, { userId: null })
    expect(await phone.sync.run()).toMatchObject({ status: 'signed_out' })
    expect(remote.calls).toEqual([])
  })

  it('dy thirrje njëkohësisht bëjnë një sinkronizim të vetëm', async () => {
    const phone = device(remote)
    await phone.store.put('programs', { name: 'STS' })
    const [first, second] = await Promise.all([phone.sync.run(), phone.sync.run()])
    expect(first).toBe(second)
    expect(remote.calls.filter((call) => call.op === 'upsert')).toHaveLength(1)
  })

  it('shënon që të dhënat e përdoruesit janë marrë të paktën një herë', async () => {
    const phone = device(remote)
    expect(await phone.sync.pulledFor()).toBeNull()
    remote.offline = true
    await phone.sync.run()
    expect(await phone.sync.pulledFor()).toBeNull()
    remote.offline = false
    await phone.sync.run()
    expect(await phone.sync.pulledFor()).toBe(USER)
  })

  it('ruan kohën dhe gjendjen e sinkronizimit të fundit', async () => {
    const phone = device(remote)
    await phone.sync.run()
    expect(await phone.sync.lastResult()).toMatchObject({ status: 'ok', at: '2026-11-30T08:00:00.000Z' })
  })
})
