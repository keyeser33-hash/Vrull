// Kandidatët për një ushqim te catalog.jsonl: për të zgjedhur rreshtin e preferuar të një "të zakonshmi" (common/*.json).
//
// Përdorimi: node tools/food-catalog/candidates.mjs "<emri anglisht>" [--source <s>] [--limit N] [--catalog <skedari>]
//   --catalog: parazgjedhja /tmp/food-out/catalog.jsonl; --source: një nga burimet (usda_foundation, ciqual…); --limit: 15.
//   Kërkimi bëhet sipas fjalëve të emrit (pa dallim shkronjash, pa theksa): çdo fjalë duhet të jetë fillim fjale te emri.
//   Fjala me "-" përpara ("-canned") përjashton. Radha: burimi sipas radhës së preferencës, pastaj emri më i shkurtër.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const DEFAULT_CATALOG = '/tmp/food-out/catalog.jsonl'
/** Radha e preferencës së burimeve për të njëjtin ushqim (V61). */
export const SOURCE_ORDER = ['usda_foundation', 'usda_sr_legacy', 'usda_fndds', 'ciqual', 'cofid', 'livsmedelsverket']

const normalize = (text) =>
  String(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

/** Fjalët e emrit, pa ndarësit; fjala me "-" përpara është përjashtim. */
export function queryTerms(query) {
  const words = normalize(query).split(/[^a-z0-9-]+/).filter(Boolean)
  return {
    include: words.filter((word) => !word.startsWith('-')),
    exclude: words.filter((word) => word.startsWith('-') && word.length > 1).map((word) => word.slice(1)),
  }
}

const nameWords = (name) => normalize(name).split(/[^a-z0-9]+/).filter(Boolean)

/**
 * Kandidatët mbi një listë rreshtash: { id, source, name_en, kcal, protein_g, carbs_g, fat_g }, të renditur.
 * Çdo fjalë e kërkimit duhet të jetë fillim i një fjale të emrit; përjashtimet nuk duhet të dalin.
 */
export function findCandidates(rows, query, { source = null, limit = 15 } = {}) {
  const { include, exclude } = queryTerms(query)
  if (!include.length) return []
  const rank = (row) => {
    const at = SOURCE_ORDER.indexOf(row.source)
    return at < 0 ? SOURCE_ORDER.length : at
  }
  const matches = []
  for (const row of rows) {
    if (source && row.source !== source) continue
    const words = nameWords(row.name_en)
    if (!include.every((term) => words.some((word) => word.startsWith(term)))) continue
    if (exclude.some((term) => words.some((word) => word.startsWith(term)))) continue
    matches.push(row)
  }
  matches.sort((a, b) => rank(a) - rank(b) || a.name_en.length - b.name_en.length || a.id.localeCompare(b.id))
  return matches.slice(0, limit)
}

export const readCatalog = (file) =>
  readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))

/** Një rresht teksti: id, burimi, emri, kcal/P/K/Y për 100 g. */
export function formatCandidate(row) {
  return `${row.id}\t${row.source}\t${row.name_en}\t${row.kcal} kcal  P ${row.protein_g}  K ${row.carbs_g}  Y ${row.fat_g}`
}

function main() {
  const args = process.argv.slice(2)
  const take = (flag) => {
    const at = args.indexOf(flag)
    return at >= 0 ? args.splice(at, 2)[1] : null
  }
  const source = take('--source')
  const limit = take('--limit')
  const catalog = take('--catalog') ?? DEFAULT_CATALOG
  const query = args.join(' ')
  if (!query || (limit !== null && !(Number(limit) > 0))) {
    console.error('Përdorimi: node tools/food-catalog/candidates.mjs "<emri anglisht>" [--source <s>] [--limit N] [--catalog <skedari>]')
    process.exit(1)
  }
  const found = findCandidates(readCatalog(catalog), query, { source, limit: limit === null ? 15 : Number(limit) })
  for (const row of found) console.log(formatCandidate(row))
  if (!found.length) console.error('Asnjë kandidat')
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
