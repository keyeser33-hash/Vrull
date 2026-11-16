import { buildAppFiles } from '../../tools/food-catalog/app-file.mjs'
import { createDatabase } from '@/data/db'
import type { CatalogFiles } from './load'
import { searchCatalog } from './search'
import { createCatalogLoader } from './state'

const row = (n: number, overrides: Record<string, unknown> = {}) => ({
  id: `usda-fdc-${n}`,
  source: 'usda_sr_legacy',
  source_id: String(n),
  license: 'CC0-1.0',
  name_en: `Food ${n}`,
  food_group: 'G',
  kcal: 100,
  protein_g: 1,
  carbs_g: 2,
  fat_g: 3,
  fiber_g: null,
  portions: [],
  list_version: 1,
  ...overrides,
})
const built = buildAppFiles([row(1, { name_en: 'Egg', name_sq: 'Vezë', name_sq_checked: false, also_in: [], common_rank: 1 }), row(2, { name_en: 'Eggplant' })])

function files(rest: CatalogFiles['rest']): CatalogFiles {
  return {
    meta: { version: 1, total: 2, common: { count: 1, bytes: 0, gzipBytes: 0 }, rest: { count: 1, bytes: 0, gzipBytes: 0 }, bySource: {} as never },
    common: async () => built.common as never,
    rest,
  }
}

describe('gjendja e listës', () => {
  it('të zakonshmet hyjnë në kërkim para se pjesa tjetër të mbarojë', async () => {
    let release: () => void = () => undefined
    const gate = new Promise<void>((resolve) => (release = resolve))
    const loader = createCatalogLoader(createDatabase(`state-${crypto.randomUUID()}`), files(async () => (await gate, built.rest as never)))
    const done = loader.start()
    await vi.waitFor(() => expect(loader.getState().index).not.toBeNull())
    expect(loader.getState().complete).toBe(false)
    expect(searchCatalog(loader.getState().index!, 'veze').map((food) => food.id)).toEqual(['usda-fdc-1'])
    release()
    await done
    expect(loader.getState().complete).toBe(true)
    expect(searchCatalog(loader.getState().index!, 'egg').map((food) => food.id)).toEqual(['usda-fdc-1', 'usda-fdc-2'])
  })

  it('nis një herë; një dështim të pjesës tjetër lë kërkimin me të zakonshmet', async () => {
    const rest = vi.fn().mockRejectedValue(new Error('skedar i prishur'))
    const loader = createCatalogLoader(createDatabase(`state-${crypto.randomUUID()}`), files(rest))
    await Promise.all([loader.start(), loader.start()])
    expect(rest).toHaveBeenCalledTimes(1)
    expect(loader.getState()).toMatchObject({ complete: false, failed: true })
    expect(searchCatalog(loader.getState().index!, 'veze')).toHaveLength(1)
  })

  it('njofton dëgjuesit kur ndryshon gjendja', async () => {
    const loader = createCatalogLoader(createDatabase(`state-${crypto.randomUUID()}`), files(async () => built.rest as never))
    const listener = vi.fn()
    loader.subscribe(listener)
    await loader.start()
    expect(listener).toHaveBeenCalledTimes(2)
  })
})
