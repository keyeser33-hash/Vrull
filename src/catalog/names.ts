import type { CatalogFood, CatalogSource } from './types'

// Si del emri i një ushqimi të listës te ekrani (SPEC §0.3h): në anglisht emri i burimit; në shqip emri shqip, dhe kur është
// i pakontrolluar (`name_sq_checked` false) emri anglisht del krahas; pa emër shqip, emri anglisht.

export type CatalogLanguage = 'sq' | 'en'

export function catalogNames(language: CatalogLanguage, food: Pick<CatalogFood, 'nameEn' | 'nameSq' | 'nameSqChecked'>): { name: string; aside: string | null } {
  if (language === 'en' || !food.nameSq) return { name: food.nameEn, aside: null }
  return { name: food.nameSq, aside: food.nameSqChecked ? null : food.nameEn }
}

/** Emri që ruhet te ushqimet e përdoruesit kur ushqimi shtohet (një emër, në gjuhën e atij çasti). */
export const catalogSavedName = (language: CatalogLanguage, food: Pick<CatalogFood, 'nameEn' | 'nameSq'>) => (language === 'sq' && food.nameSq ? food.nameSq : food.nameEn)

/** Burimi i shkurtër i etiketës: tre datasetet e USDA-së janë një "USDA". */
export type SourceLabel = 'usda' | 'ciqual' | 'cofid' | 'livsmedelsverket'

export const sourceLabelOf = (source: CatalogSource): SourceLabel => (source.startsWith('usda') ? 'usda' : (source as SourceLabel))

/** Burimi nga ID e ushqimit të listës ("ciqual-22000" → ciqual); null kur ID nuk është e listës. */
export function sourceLabelOfId(id: string): SourceLabel | null {
  if (id.startsWith('usda-fdc-')) return 'usda'
  if (id.startsWith('ciqual-')) return 'ciqual'
  if (id.startsWith('cofid-')) return 'cofid'
  if (id.startsWith('livsmedelsverket-')) return 'livsmedelsverket'
  return null
}
