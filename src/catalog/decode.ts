import type { CatalogFile, CatalogFood, CatalogHeader, CatalogSource } from './types'

// Dekoduesi i skedarit të app-it (tools/food-catalog/app-file.mjs): rreshtat e ngjeshur bëhen `CatalogFood`.
// Fushat kontrollohen kundrejt radhës së ndërtuesit, që një skedar i ndërtuar me radhë tjetër të mos lexohet gabim.

/** Radha e fushave të rreshtit; e njëjta me `FIELDS` te tools/food-catalog/app-file.mjs (decode.test.ts i krahason). */
export const FIELDS = [
  'source_id',
  'name_en',
  'source',
  'group',
  'kcal',
  'protein_g',
  'carbs_g',
  'fat_g',
  'fiber_g',
  'portions',
  'name_sq',
  'name_sq_checked',
  'also_in',
  'common_rank',
] as const

const at = (fields: readonly string[], name: string) => fields.indexOf(name)

/** Rreshtat e ngjeshur me kokën e tyre (versioni, burimet, grupet) → ushqimet. */
export function decodeRows(header: CatalogHeader, rows: readonly unknown[][]): CatalogFood[] {
  if (header.fields.length !== FIELDS.length || header.fields.some((field, index) => field !== FIELDS[index])) {
    throw new Error(`Fushat e skedarit të listës nuk përputhen me dekoduesin: ${header.fields.join(',')}`)
  }
  const col = Object.fromEntries(FIELDS.map((field) => [field, at(FIELDS, field)])) as Record<(typeof FIELDS)[number], number>
  return rows.map((row) => {
    const source = row[col.source] as number
    const sq = (row[col.name_sq] as string | null | undefined) ?? null
    const portions = (row[col.portions] as [string, number][] | undefined) ?? []
    return {
      id: header.idPrefixes[source] + String(row[col.source_id]),
      nameEn: row[col.name_en] as string,
      nameSq: sq,
      nameSqChecked: sq !== null && row[col.name_sq_checked] === 1,
      group: header.groups[row[col.group] as number] ?? '',
      source: header.sources[source] as CatalogSource,
      license: header.licenses[source],
      kcal: row[col.kcal] as number,
      proteinG: row[col.protein_g] as number,
      carbsG: row[col.carbs_g] as number,
      fatG: row[col.fat_g] as number,
      fiberG: (row[col.fiber_g] as number | null | undefined) ?? null,
      portions: portions.map(([label, grams]) => ({ label, grams })),
      alsoIn: (row[col.also_in] as string[] | undefined) ?? [],
      commonRank: (row[col.common_rank] as number | null | undefined) ?? null,
    }
  })
}

export function decodeFile(file: CatalogFile): CatalogFood[] {
  const { rows, ...header } = file
  return decodeRows(header, rows)
}
