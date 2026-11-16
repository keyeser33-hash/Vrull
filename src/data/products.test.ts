import type { ExternalFood } from '@/nutrition/off'
import { createDatabase } from './db'
import { findProduct, OFF_ATTRIBUTION, productRowFrom, saveProductFood, searchProducts, shareProduct } from './products'
import { createLocalStore } from './store'

const USER = '11111111-1111-4111-8111-111111111111'
const OTHER = '22222222-2222-4222-8222-222222222222'
const NUTELLA: ExternalFood = { source: 'off', sourceId: '3017620422003', name: 'Nutella', brand: 'Ferrero', kcal: 539, proteinG: 6.3, carbsG: 57.5, fatG: 30.9, fiberG: 0, servingG: 15, servingLabel: '15 g' }

function phone(userId = USER) {
  return createLocalStore(createDatabase(`products-${crypto.randomUUID()}`), { userId: () => userId })
}

describe('produktet e grupit', () => {
  it('produkti i Open Food Facts bëhet rresht i food_products me burimin dhe licencën ODbL', () => {
    expect(productRowFrom(NUTELLA)).toEqual({
      barcode: '3017620422003',
      source: 'open_food_facts',
      license: 'ODbL-1.0',
      name: 'Nutella',
      brand: 'Ferrero',
      kcal: 539,
      protein_g: 6.3,
      carbs_g: 57.5,
      fat_g: 30.9,
      fiber_g: 0,
      serving_g: 15,
      serving_label: '15 g',
    })
    expect(OFF_ATTRIBUTION).toBe('Contains data from Open Food Facts, available under the Open Database License')
  })

  it('një produkt që serveri do ta refuzonte nuk ndahet me grupin (barkod, kcal, makro, gjatësi, porcion)', () => {
    expect(productRowFrom({ ...NUTELLA, sourceId: '12345' })).toBeNull()
    expect(productRowFrom({ ...NUTELLA, sourceId: '123456789012345' })).toBeNull()
    expect(productRowFrom({ ...NUTELLA, sourceId: '30176204220A3' })).toBeNull()
    expect(productRowFrom({ ...NUTELLA, kcal: 951 })).toBeNull()
    expect(productRowFrom({ ...NUTELLA, carbsG: 100.5 })).toBeNull()
    expect(productRowFrom({ ...NUTELLA, proteinG: -1 })).toBeNull()
    expect(productRowFrom({ ...NUTELLA, fiberG: 101 })).toBeNull()
    expect(productRowFrom({ ...NUTELLA, servingG: 0 })).toBeNull()
    expect(productRowFrom({ ...NUTELLA, servingG: 1_000_000 })).toBeNull()
    expect(productRowFrom({ ...NUTELLA, name: 'x'.repeat(201) })).toBeNull()
    expect(productRowFrom({ ...NUTELLA, brand: 'x'.repeat(121) })).toBeNull()
    expect(productRowFrom({ ...NUTELLA, servingLabel: 'x'.repeat(81) })).toBeNull()
    expect(productRowFrom({ ...NUTELLA, source: 'usda' })).toBeNull()
  })

  it('vlerat rrumbullakosen në një shifër dhjetore si kolonat e serverit', () => {
    expect(productRowFrom({ ...NUTELLA, kcal: 539.26, proteinG: 6.34, servingG: 15.04 })).toMatchObject({ kcal: 539.3, protein_g: 6.3, serving_g: 15 })
  })

  it('shkruhet një herë; një produkt që grupi e ka tashmë nuk shkruhet përsëri', async () => {
    const store = phone()
    const first = await shareProduct(store, NUTELLA)
    expect(first).not.toBeNull()
    expect(await shareProduct(store, { ...NUTELLA, name: 'Nutella 2' })).toBeNull()
    const rows = await store.all('food_products')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ barcode: '3017620422003', name: 'Nutella', _dirty: 1 })
    expect(await shareProduct(store, { ...NUTELLA, sourceId: '12345' })).toBeNull()
  })

  it('barkodi gjendet te grupi (pa Open Food Facts): edhe produkti që e shtoi një tjetër, i ardhur me marrjen', async () => {
    const store = phone()
    expect(await findProduct(store, '3017620422003')).toBeNull()
    const db = createDatabase(`products-${crypto.randomUUID()}`)
    const mine = createLocalStore(db, { userId: () => USER })
    // Rreshti i një tjetri vjen nga serveri (marrja): pa user_id, me server_updated_at.
    await db.food_products.put({ id: 'p-1', _dirty: 0, barcode: '5449000000996', source: 'open_food_facts', license: 'ODbL-1.0', name: 'Coca-Cola', brand: 'Coca-Cola', kcal: 42, protein_g: 0, carbs_g: 10.6, fat_g: 0, fiber_g: null, serving_g: null, serving_label: null, created_at: '2026-11-15T10:00:00Z', updated_at: '2026-11-15T10:00:00Z', deleted_at: null, server_updated_at: '2026-11-15T10:00:01Z' } as never)
    expect(await findProduct(mine, '5449000000996')).toMatchObject({ name: 'Coca-Cola', brand: 'Coca-Cola', kcal: 42, source: 'open_food_facts', servingG: null })
    expect(await findProduct(mine, '0000000000000')).toBeNull()
  })

  it('një produkt i fshirë nuk gjendet', async () => {
    const store = phone()
    const id = await shareProduct(store, NUTELLA)
    await store.remove('food_products', id!)
    expect(await findProduct(store, NUTELLA.sourceId)).toBeNull()
    expect(await searchProducts(store, 'nutella')).toEqual([])
  })

  it('kërkimi te produktet e grupit: pa diakritika, emër ose markë, fillimi i emrit i pari', async () => {
    const store = phone()
    await shareProduct(store, NUTELLA)
    await shareProduct(store, { ...NUTELLA, sourceId: '8000500310427', name: 'Kinder Bueno', brand: 'Ferrero' })
    await shareProduct(store, { ...NUTELLA, sourceId: '4000417025005', name: 'Çokollatë me lajthi', brand: 'Milka' })
    expect((await searchProducts(store, 'ferrero')).map((product) => product.name)).toEqual(['Kinder Bueno', 'Nutella'])
    expect((await searchProducts(store, 'cokolla')).map((product) => product.name)).toEqual(['Çokollatë me lajthi'])
    expect((await searchProducts(store, 'nutella ferrero')).map((product) => product.name)).toEqual(['Nutella'])
    expect(await searchProducts(store, '')).toEqual([])
  })

  it('produkti i grupit ruhet te ushqimet e tua një herë: Open Food Facts si "off" me barkodin, etiketa si e jotja me label:', async () => {
    const store = phone()
    await shareProduct(store, NUTELLA)
    const [product] = await searchProducts(store, 'nutella')
    const id = await saveProductFood(store, product)
    expect(await saveProductFood(store, product)).toBe(id)
    expect(await store.get('foods', id)).toMatchObject({ source: 'off', source_id: '3017620422003', name: 'Nutella', brand: 'Ferrero', serving_g: 15 })
    const label = await saveProductFood(store, { ...product, id: 'p-2', barcode: '4000417025005', source: 'label', name: 'Bar proteine', brand: null })
    expect(await store.get('foods', label)).toMatchObject({ source: 'custom', source_id: 'label:4000417025005' })
  })

  it('dy përdorues: i dyti e gjen produktin e të parit pa e ditur kush e shtoi', async () => {
    const db = createDatabase(`products-${crypto.randomUUID()}`)
    const second = createLocalStore(db, { userId: () => OTHER })
    await db.food_products.put({ id: 'p-9', _dirty: 0, barcode: '3017620422003', source: 'open_food_facts', license: 'ODbL-1.0', name: 'Nutella', brand: 'Ferrero', kcal: 539, protein_g: 6.3, carbs_g: 57.5, fat_g: 30.9, fiber_g: 0, serving_g: 15, serving_label: '15 g', created_at: 'x', updated_at: 'x', deleted_at: null } as never)
    const found = await findProduct(second, '3017620422003')
    expect(found).not.toBeNull()
    expect(Object.keys(found!)).not.toContain('addedBy')
    expect(JSON.stringify(found)).not.toContain('added_by')
  })
})
