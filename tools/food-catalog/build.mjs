// Ndërton Listën e Vrullit nga shkarkimet e burimeve (USDA FoodData Central dhe burimet e tjera te sources.json).
//
// Përdorimi: node tools/food-catalog/build.mjs <dosja e burimeve> <dosja e daljes> [--list-version N]
//   <dosja e burimeve>: ajo e tools/food-catalog/download.mjs (p.sh. /tmp/food-src)
//   <dosja e daljes>:   shkruhen catalog.jsonl dhe summary.json (asgjë nuk shkruhet te src/ në këtë valë)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { checkCatalog } from './check.mjs'
import { readCiqual } from './ciqual.mjs'
import { readCofid } from './cofid.mjs'
import { readLivsmedelsverket } from './livsmedelsverket.mjs'
import { applyCommon, COMMON_DIR, readCommonDir, validateCommon } from './common-list.mjs'
import { readDataset } from './usda.mjs'

const SOURCES = fileURLToPath(new URL('./sources.json', import.meta.url))

/** Lexuesi i secilit burim: (dosja e shpaketuar, version i listës) → { rows, dropped, adjusted }. */
export const READERS = {
  usda_foundation: (dir, listVersion) => readDataset('usda_foundation', dir, listVersion),
  usda_sr_legacy: (dir, listVersion) => readDataset('usda_sr_legacy', dir, listVersion),
  usda_fndds: (dir, listVersion) => readDataset('usda_fndds', dir, listVersion),
  ciqual: readCiqual,
  cofid: (dir, listVersion) => readCofid(join(dir, 'cofid-2021.xlsx'), listVersion),
  livsmedelsverket: (dir, listVersion) => readLivsmedelsverket(readFileSync(join(dir, 'livsmedelsverket.json'), 'utf8'), listVersion),
}

/**
 * Bashkon daljen e burimeve (në radhën e sources.json), zbaton të zakonshmet (V61) dhe e kalon nga roja.
 * `common`: lista e bashkuar e `common/*.json`; vërtetohet para zbatimit, dhe gabimet e saj hyjnë te `errors`.
 * Funksion i pastër, i provueshëm.
 */
export function assemble(parts, common = []) {
  const sourceRows = parts.flatMap((part) => part.rows)
  const validation = validateCommon(common, sourceRows)
  const applied = applyCommon(sourceRows, common)
  const rows = applied.rows
  const { errors: checkErrors, notes } = checkCatalog(rows)
  const errors = [...checkErrors, ...validation.errors.map((error) => ({ id: error.key, rule: `common_${error.rule}`, message: error.message }))]
  const jsonl = rows.map((row) => JSON.stringify(row)).join('\n') + '\n'
  const bySource = {}
  for (const part of parts) bySource[part.source] = { rows: part.rows.length, dropped: part.dropped, adjusted: part.adjusted, version: part.version }
  const noteCounts = {}
  for (const note of notes) noteCounts[note.rule] = (noteCounts[note.rule] ?? 0) + 1
  const summary = {
    listVersion: parts[0]?.rows[0]?.list_version ?? null,
    total: rows.length,
    sourceTotal: sourceRows.length,
    bySource,
    check: {
      errors: errors.length,
      notes: noteCounts,
      firstErrors: errors.slice(0, 20),
      firstNotes: notes.slice(0, 10),
    },
    common: {
      count: applied.common,
      removedAsDuplicates: applied.removed,
      errors: validation.errors.length,
      notes: validation.notes,
    },
    bytes: Buffer.byteLength(jsonl),
    gzipBytes: gzipSync(jsonl, { level: 9 }).length,
  }
  return { jsonl, summary, errors }
}

function main() {
  const args = process.argv.slice(2)
  const versionAt = args.indexOf('--list-version')
  const listVersion = versionAt >= 0 ? Number(args.splice(versionAt, 2)[1]) : 1
  const [sourceDir, outDir] = args
  if (!sourceDir || !outDir || !Number.isInteger(listVersion) || listVersion < 1) {
    console.error('Përdorimi: node tools/food-catalog/build.mjs <dosja e burimeve> <dosja e daljes> [--list-version N]')
    process.exit(1)
  }
  const config = JSON.parse(readFileSync(SOURCES, 'utf8'))
  const parts = config.files.map((file) => {
    const read = READERS[file.id]
    if (!read) throw new Error(`Nuk ka lexues për burimin ${file.id}`)
    const { rows, dropped, adjusted } = read(join(sourceDir, file.id), listVersion)
    return { source: file.id, version: file.version, rows, dropped, adjusted }
  })
  const { jsonl, summary, errors } = assemble(parts, readCommonDir(COMMON_DIR))
  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, 'catalog.jsonl'), jsonl)
  writeFileSync(join(outDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`)
  console.log(JSON.stringify(summary, null, 2))
  if (errors.length) {
    console.error(`${errors.length} gabime nga roja; shih summary.json`)
    process.exit(1)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
