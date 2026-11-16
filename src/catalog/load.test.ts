import { buildAppFiles } from '../../tools/food-catalog/app-file.mjs'
import { createDatabase } from '@/data/db'
import { decodeFile } from './decode'
import { loadCommon, loadRest, type CatalogFiles } from './load'
import type { CatalogFile } from './types'

// Pjesa tjetër e listës ngarkohet nga skedari një herë dhe ruhet te Dexie me versionin; pas kësaj lexohet nga baza.
const row = (n: number, overrides: Record<string, unknown> = {}) => ({
  id: `usda-fdc-${n}`,
  source: 'usda_sr_legacy',
  source_id: String(n),
  license: 'CC0-1.0',
  name_en: `Food ${n}`,
  food_group: 'Group',
  kcal: 100 + n,
  protein_g: 1,
  carbs_g: 2,
  fat_g: 3,
  fiber_g: null,
  portions: [],
  list_version: 1,
  ...overrides,
})
const rows = [row(1, { name_sq: 'Ushqimi një', name_sq_checked: false, also_in: [], common_rank: 1 }), ...Array.from({ length: 2500 }, (_, i) => row(i + 2))]

function files(version = 1) {
  const built = buildAppFiles(rows.map((item) => ({ ...item, list_version: version })))
  const calls = { common: 0, rest: 0 }
  const source: CatalogFiles = {
    meta: { version, total: rows.length, common: { count: 1, bytes: 0, gzipBytes: 0 }, rest: { count: 2500, bytes: 0, gzipBytes: 0 }, bySource: {} as never },
    common: async () => (calls.common++, built.common as CatalogFile),
    rest: async () => (calls.rest++, built.rest as CatalogFile),
  }
  return { source, calls, built }
}

describe('ngarkimi i listës', () => {
  it('të zakonshmet vijnë nga skedari i tyre, pa prekur bazën', async () => {
    const { source, calls } = files()
    const foods = await loadCommon(source)
    expect(foods.map((food) => food.id)).toEqual(['usda-fdc-1'])
    expect(calls).toEqual({ common: 1, rest: 0 })
  })

  it('herën e parë pjesa tjetër merret nga skedari dhe ruhet; herën tjetër lexohet nga baza pa skedar', async () => {
    const db = createDatabase(`catalog-${crypto.randomUUID()}`)
    const { source, calls, built } = files()
    const first = await loadRest(db, source)
    expect(first.from).toBe('file')
    expect(first.foods).toHaveLength(2500)
    expect(first.foods).toEqual(decodeFile(built.rest as CatalogFile))
    expect(calls.rest).toBe(1)

    const second = await loadRest(db, source)
    expect(second.from).toBe('database')
    expect(calls.rest).toBe(1)
    expect(second.foods).toEqual(first.foods)
  })

  it('një version i ri i listës e zëvendëson të vjetrin pa lënë copa të vjetra', async () => {
    const db = createDatabase(`catalog-${crypto.randomUUID()}`)
    await loadRest(db, files(1).source)
    const next = files(2)
    // Versioni i ri ka më pak rreshta: copat e tepërta të versionit 1 nuk mbeten.
    const smaller = buildAppFiles(rows.slice(0, 1200).map((item) => ({ ...item, list_version: 2 })))
    next.source.rest = async () => smaller.rest as CatalogFile
    next.source.meta = { ...next.source.meta, rest: { count: 1199, bytes: 0, gzipBytes: 0 } }
    const result = await loadRest(db, next.source)
    expect(result.from).toBe('file')
    expect(result.foods).toHaveLength(1199)
    const chunks = (await db._catalog.toArray()).filter((record) => record.id.startsWith('rest:'))
    expect(chunks.flatMap((record) => record.rows ?? [])).toHaveLength(1199)
    expect((await db._catalog.get('head'))?.version).toBe(2)
  })

  it('një shkrim që nuk mbaroi (pa kokë) rifillon nga skedari', async () => {
    const db = createDatabase(`catalog-${crypto.randomUUID()}`)
    const { source, calls } = files()
    await loadRest(db, source)
    await db._catalog.delete('head')
    const again = await loadRest(db, source)
    expect(again.from).toBe('file')
    expect(calls.rest).toBe(2)
  })
})
