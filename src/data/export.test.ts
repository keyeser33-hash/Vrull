import { createDatabase } from './db'
import { buildExport, exportFileName } from './export'
import { createLocalStore } from './store'
import { USER_TABLES } from './tables'

const USER = '11111111-1111-4111-8111-111111111111'

describe('eksporti i të dhënave', () => {
  it('përmban çdo tabelë të përdoruesit (jo produktet e grupit), pa rreshtat e fshirë dhe pa fushat lokale', async () => {
    const db = createDatabase(`export-${crypto.randomUUID()}`)
    const store = createLocalStore(db, { userId: () => USER, now: () => new Date('2026-11-30T08:00:00.000Z') })
    const kept = await store.put('body_measurements', { date: '2026-11-30', weight_kg: 80 })
    const gone = await store.put('body_measurements', { date: '2026-11-29', weight_kg: 81 })
    await store.remove('body_measurements', gone.id)
    await store.put('supplements', { name: 'Creatine' })

    const file = await buildExport(db, { version: '0.1.0', userId: USER, now: () => new Date('2026-11-30T09:15:00.000Z') })

    expect(file).toMatchObject({ app: 'Vrull', version: '0.1.0', exported_at: '2026-11-30T09:15:00.000Z', user_id: USER })
    expect(Object.keys(file.tables)).toEqual([...USER_TABLES])
    expect(file.tables.body_measurements).toEqual([
      expect.objectContaining({ id: kept.id, weight_kg: 80 }),
    ])
    expect(file.tables.supplements).toHaveLength(1)
    expect(file.tables.programs).toEqual([])
    const keys = Object.values(file.tables).flat().flatMap((row) => Object.keys(row))
    expect(keys.filter((key) => key.startsWith('_'))).toEqual([])
  })

  it('emri i skedarit mban datën lokale', () => {
    expect(exportFileName(new Date(2026, 10, 30, 23, 30))).toBe('vrull-2026-11-30.json')
  })
})
