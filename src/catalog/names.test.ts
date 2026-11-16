import { catalogNames, catalogSavedName, sourceLabelOf, sourceLabelOfId } from './names'

const common = { nameEn: 'Egg, whole, raw, fresh', nameSq: 'Vezë', nameSqChecked: false }

describe('emrat e listës', () => {
  it('shqip i pakontrolluar: emri shqip dhe anglishti krahas', () => {
    expect(catalogNames('sq', common)).toEqual({ name: 'Vezë', aside: 'Egg, whole, raw, fresh' })
  })

  it('shqip i kontrolluar: vetëm emri shqip', () => {
    expect(catalogNames('sq', { ...common, nameSqChecked: true })).toEqual({ name: 'Vezë', aside: null })
  })

  it('pa emër shqip: emri anglisht, pa asnjë krahas', () => {
    expect(catalogNames('sq', { ...common, nameSq: null })).toEqual({ name: 'Egg, whole, raw, fresh', aside: null })
  })

  it('në anglisht gjithmonë emri anglisht', () => {
    expect(catalogNames('en', common)).toEqual({ name: 'Egg, whole, raw, fresh', aside: null })
  })

  it('emri i ruajtur ndjek gjuhën', () => {
    expect(catalogSavedName('sq', common)).toBe('Vezë')
    expect(catalogSavedName('en', common)).toBe('Egg, whole, raw, fresh')
    expect(catalogSavedName('sq', { ...common, nameSq: null })).toBe('Egg, whole, raw, fresh')
  })

  it('burimi i shkurtër nga burimi dhe nga ID', () => {
    expect(sourceLabelOf('usda_fndds')).toBe('usda')
    expect(sourceLabelOf('cofid')).toBe('cofid')
    expect(sourceLabelOfId('usda-fdc-171287')).toBe('usda')
    expect(sourceLabelOfId('livsmedelsverket-4612')).toBe('livsmedelsverket')
    expect(sourceLabelOfId('jim:egg')).toBeNull()
  })
})
