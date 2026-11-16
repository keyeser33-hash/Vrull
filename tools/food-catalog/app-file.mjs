// Skedari i Listës së Vrullit për telefonin (V2-E3-27, vala 5; SPEC §0.3h): nga `catalog.jsonl` i ndërtimit nxjerr vetëm
// fushat që i duhen kërkimit, në rreshta të ngjeshur (tuple), në dy skedarë:
//   foods-common.json  rreshtat me `common_rank` (të zakonshmet): hyjnë menjëherë në kërkim;
//   foods-rest.json    pjesa tjetër: ngarkohet me `import()` të vonuar dhe ruhet një herë te Dexie me versionin;
//   foods-meta.json    versioni, numrat dhe madhësitë (faqja "Burimet", raporti).
// Dekoduesi te telefoni: `src/catalog/decode.ts`; testi i rrethit (kodim → dekodim) është te `src/catalog/decode.test.ts`.
//
// Përdorimi: node tools/food-catalog/app-file.mjs <catalog.jsonl> <dosja e daljes>   (p.sh. src/catalog/data)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { SOURCE_LICENSES } from './check.mjs'

/** Radha e fushave të çdo rreshti; të rrallat (vetëm të zakonshmet) në fund, që rreshtat pa to ta shkurtojnë bishtin. */
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
]

/** Parashtesa e ID-së sipas burimit (ID e rreshtit = parashtesa + source_id, e kontrolluar gjatë kodimit). */
export const ID_PREFIX = {
  usda_foundation: 'usda-fdc-',
  usda_sr_legacy: 'usda-fdc-',
  usda_fndds: 'usda-fdc-',
  ciqual: 'ciqual-',
  cofid: 'cofid-',
  livsmedelsverket: 'livsmedelsverket-',
}

/** Burimet sipas radhës së preferencës (SPEC §0.3h); indeksi i tyre vendoset te rreshti. */
export const SOURCES = Object.keys(SOURCE_LICENSES)

const isEmpty = (value) => value === null || value === undefined || (Array.isArray(value) && value.length === 0)

/** Një rresht i `catalog.jsonl` si tuple; groups është lista e grupeve që plotësohet gjatë kodimit. */
export function encodeRow(row, groups) {
  const prefix = ID_PREFIX[row.source]
  if (!prefix) throw new Error(`Burim i panjohur: ${row.source} (${row.id})`)
  if (row.id !== prefix + row.source_id) throw new Error(`ID nuk del nga burimi: ${row.id} kundrejt ${prefix}${row.source_id}`)
  if (row.license !== SOURCE_LICENSES[row.source]) throw new Error(`Licenca nuk përputhet me burimin: ${row.id} ${row.license}`)
  let group = groups.indexOf(row.food_group ?? '')
  if (group < 0) group = groups.push(row.food_group ?? '') - 1
  const values = [
    row.source_id,
    row.name_en,
    SOURCES.indexOf(row.source),
    group,
    row.kcal,
    row.protein_g,
    row.carbs_g,
    row.fat_g,
    row.fiber_g ?? null,
    row.portions.map((portion) => [portion.label_en, portion.grams]),
    row.name_sq ?? null,
    row.name_sq === undefined ? null : row.name_sq_checked ? 1 : 0,
    row.also_in ?? null,
    row.common_rank ?? null,
  ]
  // Bishti bosh (null ose []) shkurtohet; dekoduesi e plotëson.
  let end = values.length
  while (end > 0 && isEmpty(values[end - 1])) end -= 1
  return values.slice(0, end)
}

function encodeFile(rows, groups, meta) {
  return { ...meta, fields: FIELDS, rows: rows.map((row) => encodeRow(row, groups)) }
}

/**
 * Kodon të gjithë rreshtat: { common, rest, meta } me objektet e gatshme për JSON. Versioni i listës duhet të jetë një.
 * `groups` ndahet mes dy skedarëve (në `meta.groups`), që rreshtat të marrin të njëjtin indeks.
 */
export function buildAppFiles(rows) {
  const versions = new Set(rows.map((row) => row.list_version))
  if (versions.size !== 1) throw new Error(`Rreshtat kanë ${versions.size} versione të listës`)
  const [version] = versions
  const groups = []
  const common = rows.filter((row) => row.common_rank != null).sort((a, b) => a.common_rank - b.common_rank)
  const rest = rows.filter((row) => row.common_rank == null)
  const shared = { version, sources: SOURCES, licenses: SOURCES.map((source) => SOURCE_LICENSES[source]), idPrefixes: SOURCES.map((source) => ID_PREFIX[source]) }
  const commonFile = encodeFile(common, groups, { ...shared, part: 'common', count: common.length })
  const restFile = encodeFile(rest, groups, { ...shared, part: 'rest', count: rest.length })
  // Grupet shkruhen në të dyja skedarët pasi të dy rreshtat janë kodimuar (lista e plotë).
  commonFile.groups = groups
  restFile.groups = groups
  return { common: commonFile, rest: restFile, groups, version, total: rows.length }
}

const sizes = (text) => ({ bytes: Buffer.byteLength(text), gzipBytes: gzipSync(text).length })

/** Versioni i të dhënave të çdo burimi nga `summary.json` i ndërtimit (p.sh. { usda_foundation: '2026-04-30' }); bosh pa të. */
export function sourceVersions(summaryPath) {
  if (!summaryPath || !existsSync(summaryPath)) return {}
  const summary = JSON.parse(readFileSync(summaryPath, 'utf8'))
  return Object.fromEntries(SOURCES.filter((source) => summary.bySource?.[source]?.version).map((source) => [source, summary.bySource[source].version]))
}

/** Shkruan foods-common.json, foods-rest.json dhe foods-meta.json; kthen metën me madhësitë. `summaryPath`: summary.json i ndërtimit (versionet e burimeve). */
export function writeAppFiles(rows, outDir, summaryPath) {
  const built = buildAppFiles(rows)
  const commonText = JSON.stringify(built.common)
  const restText = JSON.stringify(built.rest)
  const meta = {
    version: built.version,
    total: built.total,
    common: { count: built.common.count, ...sizes(commonText) },
    rest: { count: built.rest.count, ...sizes(restText) },
    bySource: Object.fromEntries(SOURCES.map((source) => [source, rows.filter((row) => row.source === source).length])),
    sourceVersions: sourceVersions(summaryPath),
  }
  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, 'foods-common.json'), commonText)
  writeFileSync(join(outDir, 'foods-rest.json'), restText)
  writeFileSync(join(outDir, 'foods-meta.json'), `${JSON.stringify(meta, null, 2)}\n`)
  return meta
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [input, outDir] = process.argv.slice(2)
  if (!input || !outDir) {
    console.error('Përdorimi: node tools/food-catalog/app-file.mjs <catalog.jsonl> <dosja e daljes>')
    process.exit(2)
  }
  const rows = readFileSync(input, 'utf8').trim().split('\n').map((line) => JSON.parse(line))
  const meta = writeAppFiles(rows, outDir, join(dirname(input), 'summary.json'))
  const kb = (bytes) => `${(bytes / 1024).toFixed(0)} kB`
  console.log(`Versioni ${meta.version}, ${meta.total} rreshta`)
  console.log(`  të zakonshmet: ${meta.common.count} rreshta, ${kb(meta.common.bytes)} (gzip ${kb(meta.common.gzipBytes)})`)
  console.log(`  pjesa tjetër:  ${meta.rest.count} rreshta, ${kb(meta.rest.bytes)} (gzip ${kb(meta.rest.gzipBytes)})`)
}
