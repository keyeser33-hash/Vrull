// Të zakonshmet e Listës së Vrullit (V61): rreth 1 000 ushqimet më të zakonshme që përputhen mes burimeve dhe mbahen një herë.
// Skedarët te `common/*.json` (001.json…): lista me { key, rank, name_sq, name_en, group, preferred, also, reason? }.
//   key        çelës i qëndrueshëm ("egg-whole-raw"), unik; rank: numër i plotë > 0, unik (1 = më i zakonshmi)
//   name_sq    emri shqip (përkthim i pakontrolluar: `name_sq_checked` del false); name_en, group: për njeriun që e lexon
//   preferred  ID e rreshtit të katalogut që mbahet; also: ID-të e të njëjtit ushqim te burimet e tjera (hiqen nga dalja)
//   reason     kur preferred nuk është i pari sipas radhës së burimeve (p.sh. "USDA ka vetëm të gatuarin")
// Emri i skedarit është `common-list.mjs`, sepse `common.mjs` ekziston tashmë (ndihmësit e burimeve).
//
// Përdorimi (vetëm vërtetimi): node tools/food-catalog/common-list.mjs <catalog-all.jsonl> [<dosja e të zakonshmeve>]
//   (jo catalog.jsonl: ai nuk i ka më rreshtat `also` që u hoqën)
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SOURCE_ORDER } from './candidates.mjs'

export const COMMON_DIR = fileURLToPath(new URL('./common/', import.meta.url))
/** Kur kcal e një `also` ndryshon më shumë se kaq nga i preferuari, vërtetimi shënon (nuk e ndalon). */
export const KCAL_DIFF_NOTE = 0.25

const sourceRank = (source) => {
  const at = SOURCE_ORDER.indexOf(source)
  return at < 0 ? SOURCE_ORDER.length : at
}

/** Lexon dhe bashkon të gjithë `*.json` e dosjes (në radhën e emrit); çdo skedar është një listë. */
export function readCommonDir(dir = COMMON_DIR) {
  const files = readdirSync(dir).filter((name) => name.endsWith('.json')).sort()
  return files.flatMap((name) => {
    const list = JSON.parse(readFileSync(join(dir, name), 'utf8'))
    if (!Array.isArray(list)) throw new Error(`${name}: duhet të jetë listë`)
    return list.map((entry) => ({ ...entry, file: name }))
  })
}

/**
 * Vërteton të zakonshmet kundrejt rreshtave të katalogut. Kthen { errors, notes }, secili { key, rule, message }.
 * Gabim: çelës ose ID e dyfishtë, ID që nuk ekziston, name_sq bosh, preferred jo sipas radhës pa reason.
 * Shënim: kcal e një `also` ndryshon mbi 25 % nga i preferuari (ose i preferuari pa reason ka kcal të flamurosur).
 */
export function validateCommon(list, rows) {
  const errors = []
  const notes = []
  const byId = new Map(rows.map((row) => [row.id, row]))
  const fail = (entry, rule, message) => errors.push({ key: entry?.key ?? null, rule, message })
  const note = (entry, rule, message) => notes.push({ key: entry.key, rule, message })
  const keys = new Set()
  const ranks = new Set()
  const ids = new Map()

  for (const entry of list) {
    if (typeof entry.key !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(entry.key)) fail(entry, 'key', `çelës i pavlefshëm: ${entry.key}`)
    else if (keys.has(entry.key)) fail(entry, 'key_duplicate', `çelës i dyfishtë: ${entry.key}`)
    keys.add(entry.key)
    if (!Number.isInteger(entry.rank) || entry.rank < 1) fail(entry, 'rank', `rank duhet të jetë numër i plotë > 0: ${entry.rank}`)
    else if (ranks.has(entry.rank)) fail(entry, 'rank_duplicate', `rank i dyfishtë: ${entry.rank}`)
    ranks.add(entry.rank)
    if (typeof entry.name_sq !== 'string' || entry.name_sq.trim() === '') fail(entry, 'name_sq', 'name_sq bosh')
    else if (entry.name_sq.length > 200) fail(entry, 'name_sq', 'name_sq mbi 200 shenja')
    if (typeof entry.name_en !== 'string' || entry.name_en.trim() === '') fail(entry, 'name_en', 'name_en bosh')
    if (typeof entry.group !== 'string' || entry.group.trim() === '') fail(entry, 'group', 'group bosh')
    if (!Array.isArray(entry.also)) {
      fail(entry, 'also', 'also duhet të jetë listë')
      continue
    }
    if (entry.reason !== undefined && (typeof entry.reason !== 'string' || entry.reason.trim() === '')) fail(entry, 'reason', 'reason bosh')

    const members = [entry.preferred, ...entry.also]
    let known = true
    for (const id of members) {
      if (typeof id !== 'string' || !byId.has(id)) {
        fail(entry, 'id_missing', `ID që nuk ekziston te katalogu: ${id}`)
        known = false
      } else if (ids.has(id)) fail(entry, 'id_duplicate', `ID e përdorur edhe te ${ids.get(id)}: ${id}`)
      else ids.set(id, entry.key)
    }
    if (new Set(members).size !== members.length) fail(entry, 'id_duplicate', 'ID e përsëritur brenda të njëjtit ushqim')
    if (!known) continue

    const preferred = byId.get(entry.preferred)
    const best = Math.min(...members.map((id) => sourceRank(byId.get(id).source)))
    if (sourceRank(preferred.source) > best && !entry.reason)
      fail(entry, 'order', `preferred (${preferred.source}) nuk është i pari sipas radhës së burimeve dhe nuk ka reason`)
    for (const id of entry.also) {
      const other = byId.get(id)
      if (preferred.kcal > 0 ? Math.abs(other.kcal - preferred.kcal) / preferred.kcal > KCAL_DIFF_NOTE : other.kcal > 0)
        note(entry, 'kcal_differs', `${id} ka ${other.kcal} kcal, preferred ${preferred.kcal} (mbi 25 %)`)
    }
  }
  return { errors, notes }
}

/**
 * Zbaton të zakonshmet: preferred merr name_sq, name_sq_checked false, also_in dhe common_rank; rreshtat `also` hiqen.
 * Kthen { rows, common, removed }; rreshtat në radhën origjinale, asnjë ndryshim te vlerat e burimit.
 */
export function applyCommon(rows, list) {
  const byPreferred = new Map(list.map((entry) => [entry.preferred, entry]))
  const removedIds = new Set(list.flatMap((entry) => entry.also))
  const out = []
  for (const row of rows) {
    if (removedIds.has(row.id)) continue
    const entry = byPreferred.get(row.id)
    out.push(
      entry
        ? { ...row, name_sq: entry.name_sq, name_sq_checked: false, also_in: [...entry.also], common_rank: entry.rank }
        : row,
    )
  }
  return { rows: out, common: byPreferred.size, removed: removedIds.size }
}

function main() {
  const [catalog, dir] = process.argv.slice(2)
  if (!catalog) {
    console.error('Përdorimi: node tools/food-catalog/common-list.mjs <catalog-all.jsonl> [<dosja e të zakonshmeve>]')
    process.exit(1)
  }
  const rows = readFileSync(catalog, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line))
  const list = readCommonDir(dir)
  const { errors, notes } = validateCommon(list, rows)
  console.log(`${list.length} të zakonshme, ${errors.length} gabime, ${notes.length} shënime`)
  for (const error of errors) console.log(`GABIM ${error.rule} ${error.key}: ${error.message}`)
  for (const item of notes) console.log(`SHËNIM ${item.rule} ${item.key}: ${item.message}`)
  process.exit(errors.length ? 1 : 0)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
