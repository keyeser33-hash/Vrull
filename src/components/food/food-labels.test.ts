import { i18nFor } from '@/i18n'
import { portionLabel, servingCount, sourceKey, unitNoun } from './food-labels'

// Etiketat e rreshtave të kërkimit (V59): burimi i shkurtër, njësia e porcionit dhe porcioni si tekst.
describe('etiketat e ushqimit', () => {
  it('unitNoun heq numrin e etiketës; vetëm gramë ose pa etiketë jep null', () => {
    expect(unitNoun('1 vezë e madhe')).toBe('vezë e madhe')
    expect(unitNoun('½ pjepër')).toBe('pjepër')
    expect(unitNoun('15 g')).toBeNull()
    expect(unitNoun('')).toBeNull()
    expect(unitNoun(null)).toBeNull()
  })

  it('servingCount: shumëfishat e gjysmës së porcionit, përndryshe null', () => {
    expect(servingCount(150, 50)).toBe(3)
    expect(servingCount(75, 50)).toBe(1.5)
    expect(servingCount(60, 50)).toBeNull()
    expect(servingCount(100, null)).toBeNull()
    expect(servingCount(0, 50)).toBeNull()
  })

  it('sourceKey: plani, makrot e shpejta, suplementi, USDA, produkti dhe i yti', () => {
    expect(sourceKey({ source: 'template', sourceId: 'jim:tuna' })).toBe('foodsearch.source.plan')
    expect(sourceKey({ source: 'template', sourceId: 'pdf:salmon' })).toBe('foodsearch.source.plan')
    expect(sourceKey({ source: null, sourceId: 'quick:abc' })).toBe('foodsearch.source.quick')
    expect(sourceKey({ source: 'custom', sourceId: 'supplement:protein' })).toBe('foodsearch.source.supplement')
    expect(sourceKey({ source: 'usda', sourceId: '171477' })).toBe('foodsearch.source.usda')
    expect(sourceKey({ source: 'off', sourceId: '3017620422003' })).toBe('foodsearch.source.product')
    expect(sourceKey({ source: 'custom', sourceId: null })).toBe('foodsearch.source.mine')
    expect(sourceKey({ source: 'catalog', sourceId: 'usda-fdc-171287' })).toBe('foodsearch.source.usda')
    expect(sourceKey({ source: 'catalog', sourceId: 'ciqual-22000' })).toBe('foodsearch.source.ciqual')
    expect(sourceKey({ source: 'catalog', sourceId: 'cofid-13-520' })).toBe('foodsearch.source.cofid')
    expect(sourceKey({ source: 'catalog', sourceId: 'livsmedelsverket-4612' })).toBe('foodsearch.source.livsmedelsverket')
  })

  it('portionLabel: njësia me numër, gramët, ose porcioni i makrove të shpejta; në të dyja gjuhët', () => {
    const sq = i18nFor('sq')
    const en = i18nFor('en')
    const egg = { grams: 100, servings: null, servingG: 50, servingLabel: '1 vezë e madhe' }
    expect(portionLabel(sq, egg)).toBe('2 vezë e madhe')
    expect(portionLabel(sq, { ...egg, grams: 75 })).toBe('1,5 vezë e madhe')
    expect(portionLabel(en, { ...egg, grams: 75 })).toBe('1.5 vezë e madhe')
    expect(portionLabel(sq, { ...egg, grams: 62 })).toBe('62 g')
    expect(portionLabel(sq, { grams: 30, servings: null, servingG: 15, servingLabel: '15 g' })).toBe('30 g')
    expect(portionLabel(sq, { grams: null, servings: 2, servingG: null, servingLabel: null })).toBe('2 porcion')
    expect(portionLabel(en, { grams: null, servings: 1, servingG: null, servingLabel: null })).toBe('1 serving')
  })
})
