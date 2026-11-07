import { offProductFromJson, offSearchFromJson } from './off'

const PRODUCT = {
  code: '3017620422003',
  product_name: 'Nutella',
  brands: 'Ferrero,Nutella',
  serving_quantity: 15,
  serving_size: '15 g',
  nutriments: { 'energy-kcal_100g': 539, proteins_100g: 6.3, carbohydrates_100g: 57.5, fat_100g: 30.9, fiber_100g: 0 },
}

describe('Open Food Facts', () => {
  it('produkti: emri, marka e parë, makrot për 100 g dhe porcioni', () => {
    expect(offProductFromJson({ status: 1, product: PRODUCT })).toEqual({
      source: 'off',
      sourceId: '3017620422003',
      name: 'Nutella',
      brand: 'Ferrero',
      kcal: 539,
      proteinG: 6.3,
      carbsG: 57.5,
      fatG: 30.9,
      fiberG: 0,
      servingG: 15,
      servingLabel: '15 g',
    })
  })

  it('kcal nga kJ kur mungojnë; emri në gjuhë tjetër kur mungon emri kryesor', () => {
    const product = { code: '1', product_name_en: 'Oats', nutriments: { energy_100g: 1550, proteins_100g: 13, carbohydrates_100g: 60, fat_100g: 7 } }
    expect(offProductFromJson({ status: 1, product })).toMatchObject({ name: 'Oats', kcal: 370.5, brand: null, fiberG: null, servingG: null })
  })

  it('produkt që nuk gjendet ose pa makro: null', () => {
    expect(offProductFromJson({ status: 0, status_verbose: 'product not found' })).toBeNull()
    expect(offProductFromJson({ status: 1, product: { code: '2', product_name: 'Ujë', nutriments: {} } })).toBeNull()
    expect(offProductFromJson({ status: 1, product: { code: '3', nutriments: PRODUCT.nutriments } })).toBeNull()
  })

  it('kërkimi kthen vetëm produktet me emër dhe makro', () => {
    expect(offSearchFromJson({ products: [PRODUCT, { code: '2', product_name: 'Pa makro', nutriments: {} }] }).map((food) => food.name)).toEqual(['Nutella'])
    expect(offSearchFromJson({})).toEqual([])
  })
})
