import { createDatabase } from './db'
import { createLocalStore } from './store'
import { CLEAN, PENDING } from './tables'

const USER = '11111111-1111-4111-8111-111111111111'

function setup(options: { userId?: string | null } = {}) {
  const db = createDatabase(`store-${crypto.randomUUID()}`)
  let clock = Date.parse('2026-11-30T08:00:00.000Z')
  const tick = (ms = 1000) => {
    clock += ms
  }
  const store = createLocalStore(db, {
    userId: () => (options.userId === undefined ? USER : options.userId),
    now: () => new Date(clock),
  })
  return { db, store, tick }
}

describe('shkrimet lokale', () => {
  it('një rresht i ri merr id, pronarin, kohët dhe pret dërgimin', async () => {
    const { store } = setup()
    const row = await store.put('body_measurements', { date: '2026-11-30', weight_kg: 80 })

    expect(row.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(row).toMatchObject({
      user_id: USER,
      date: '2026-11-30',
      weight_kg: 80,
      created_at: '2026-11-30T08:00:00.000Z',
      updated_at: '2026-11-30T08:00:00.000Z',
      deleted_at: null,
      _dirty: PENDING,
    })
    expect(await store.get('body_measurements', row.id)).toEqual(row)
  })

  it('ndryshimi i pjesshëm ruan fushat e tjera, rrit updated_at dhe mban created_at', async () => {
    const { store, tick } = setup()
    const row = await store.put('body_measurements', { date: '2026-11-30', weight_kg: 80, waist_cm: 84 })
    tick()
    const updated = await store.put('body_measurements', { id: row.id, weight_kg: 79.5 })

    expect(updated).toMatchObject({ weight_kg: 79.5, waist_cm: 84, date: '2026-11-30' })
    expect(updated.created_at).toBe('2026-11-30T08:00:00.000Z')
    expect(updated.updated_at).toBe('2026-11-30T08:00:01.000Z')
  })

  it('një rresht i sinkronizuar që ndryshohet pret përsëri dërgimin', async () => {
    const { db, store } = setup()
    const row = await store.put('foods', { source: 'custom', name: 'Vezë', kcal: 143, protein_g: 12.6, carbs_g: 0.7, fat_g: 9.5 })
    await db.foods.update(row.id, { _dirty: CLEAN })
    const updated = await store.put('foods', { id: row.id, name: 'Vezë e zier' })
    expect(updated._dirty).toBe(PENDING)
  })

  it('fshirja është e butë: rreshti mbetet për sinkronizim, por nuk shfaqet', async () => {
    const { db, store, tick } = setup()
    const keep = await store.put('diary_entries', { date: '2026-11-30', meal: 'lunch', kcal: 500 })
    const gone = await store.put('diary_entries', { date: '2026-11-30', meal: 'dinner', kcal: 700 })
    tick()
    await store.remove('diary_entries', gone.id)

    expect(await store.get('diary_entries', gone.id)).toBeUndefined()
    expect((await store.all('diary_entries')).map((row) => row.id)).toEqual([keep.id])
    expect((await store.where('diary_entries', 'date', '2026-11-30')).map((row) => row.id)).toEqual([keep.id])

    const stored = await db.diary_entries.get(gone.id)
    expect(stored).toMatchObject({ deleted_at: '2026-11-30T08:00:01.000Z', updated_at: '2026-11-30T08:00:01.000Z', _dirty: PENDING })
  })

  it('kërkon përdoruesin: pa hyrje nuk shkruan asgjë', async () => {
    const { store } = setup({ userId: null })
    await expect(store.put('foods', { name: 'Vezë' })).rejects.toThrow('Pa përdorues')
  })

  it('nuk lejon të ndryshohen id, pronari, created_at ose kursori i serverit', async () => {
    const { store } = setup()
    const row = await store.put('programs', { name: 'Shortcut to Size' })
    const updated = await store.put('programs', {
      id: row.id,
      user_id: 'someone-else',
      created_at: '2000-01-01T00:00:00.000Z',
      server_updated_at: '2000-01-01T00:00:00.000Z',
      name: 'STS',
    })
    expect(updated).toMatchObject({ user_id: USER, created_at: row.created_at, name: 'STS' })
    expect(updated.server_updated_at).toBeUndefined()
  })

  it('njofton dëgjuesit pas çdo shkrimi', async () => {
    const { store } = setup()
    const changes: string[] = []
    const stop = store.subscribe((table) => changes.push(table))
    const row = await store.put('supplements', { name: 'Creatine' })
    await store.remove('supplements', row.id)
    stop()
    await store.put('supplements', { name: 'ZMA' })
    expect(changes).toEqual(['supplements', 'supplements'])
  })
})

describe('shumë rreshta njëherësh', () => {
  it('të gjithë ruhen si të rinj, presin dërgimin, dhe njoftohet një herë', async () => {
    const { store, db } = setup()
    const notified: string[] = []
    store.subscribe((table) => notified.push(table))
    const rows = await store.insertMany('program_days', [
      { id: '00000000-0000-4000-8000-000000000001', program_id: 'p', position: 0, name: 'A' },
      { program_id: 'p', position: 1, name: 'B' },
    ])
    expect(rows.map((row) => row.name)).toEqual(['A', 'B'])
    expect(rows[0].id).toBe('00000000-0000-4000-8000-000000000001')
    expect(rows[1].id).toMatch(/^[0-9a-f-]{36}$/)
    expect(await db.program_days.where('_dirty').equals(PENDING).count()).toBe(2)
    expect(rows[1]).toMatchObject({ user_id: USER, deleted_at: null, created_at: '2026-11-30T08:00:00.000Z' })
    expect(notified).toEqual(['program_days'])
  })
})
