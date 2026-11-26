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

  it('pjata shqiptare: emri shqip dhe anglishti krahas në të dyja gjuhët (emri i pjatës është shqip)', () => {
    const dish = { nameEn: 'Spinach byrek', nameSq: 'Byrek me spinaq', nameSqChecked: true, dish: {} as never }
    expect(catalogNames('sq', dish)).toEqual({ name: 'Byrek me spinaq', aside: 'Spinach byrek', asideLang: 'en' })
    expect(catalogNames('en', dish)).toEqual({ name: 'Spinach byrek', aside: 'Byrek me spinaq', asideLang: 'sq' })
    expect(catalogSavedName('sq', dish)).toBe('Byrek me spinaq')
    expect(catalogSavedName('en', dish)).toBe('Spinach byrek')
    // Emri i njëjtë në të dyja gjuhët (Flija): pa emër krahas.
    expect(catalogNames('sq', { ...dish, nameEn: 'Flija', nameSq: 'Flija' })).toEqual({ name: 'Flija', aside: null })
  })

  it('burimi i shkurtër nga burimi dhe nga ID', () => {
    expect(sourceLabelOf('vrull_recipe')).toBe('dish')
    expect(sourceLabelOfId('vrull-dish-tave-kosi')).toBe('dish')
    expect(sourceLabelOf('usda_fndds')).toBe('usda')
    expect(sourceLabelOf('cofid')).toBe('cofid')
    expect(sourceLabelOfId('usda-fdc-171287')).toBe('usda')
    expect(sourceLabelOfId('livsmedelsverket-4612')).toBe('livsmedelsverket')
    expect(sourceLabelOfId('jim:egg')).toBeNull()
  })
})
