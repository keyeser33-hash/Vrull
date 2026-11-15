// Lexues minimal i skedarëve XLSX (Office Open XML) për Listën e Vrullit, pa varësi të reja: `unzip -p` nxjerr pjesët,
// pjesa tjetër është leximi i XML-it të thjeshtë të fletëve (qelizat `<c r="B3" t="s"><v>…</v></c>`, vargjet e përbashkëta,
// vargjet brenda qelizës). Mjafton për tabelat e CoFID dhe Frida; nuk lexon formula, data me stil, as fletë të mëdha me
// qeliza të bashkuara. Qelizat bosh nuk kthehen; rreshti është objekt { A: ..., B: ... } sipas shkronjës së kolonës.
import { execFileSync } from 'node:child_process'

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

export function decodeXml(text) {
  return text.replace(/&(?:#(\d+)|#x([0-9a-fA-F]+)|(amp|lt|gt|quot|apos));/g, (_, dec, hex, name) =>
    name ? ENTITIES[name] : String.fromCodePoint(dec ? Number(dec) : parseInt(hex, 16)),
  )
}

function part(file, name) {
  return execFileSync('unzip', ['-p', file, name], { encoding: 'utf8', maxBuffer: 1024 * 1024 * 1024 })
}

/** Teksti i një `<si>` ose `<is>`: bashkon të gjitha `<t>` (vargjet me formatim kanë disa `<r><t>`), pa `<rPh>` (fonetika). */
function richText(xml) {
  const plain = xml.replace(/<rPh[\s>][\s\S]*?<\/rPh>/g, '')
  let out = ''
  for (const match of plain.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t\s*\/>/g)) out += match[1] ?? ''
  return decodeXml(out)
}

export function sharedStrings(file) {
  let xml
  try {
    xml = part(file, 'xl/sharedStrings.xml')
  } catch {
    return []
  }
  return [...xml.matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>|<si\s*\/>/g)].map((match) => richText(match[1] ?? ''))
}

/** Fletët e librit: [{ name, path }] sipas radhës te workbook.xml. */
export function sheetList(file) {
  const book = part(file, 'xl/workbook.xml')
  const rels = new Map(
    [...part(file, 'xl/_rels/workbook.xml.rels').matchAll(/<Relationship\s[^>]*>/g)].map((match) => {
      const tag = match[0]
      return [/\bId="([^"]+)"/.exec(tag)?.[1], /\bTarget="([^"]+)"/.exec(tag)?.[1]]
    }),
  )
  return [...book.matchAll(/<sheet\s[^>]*>/g)].map((match) => {
    const tag = match[0]
    const target = rels.get(/\br:id="([^"]+)"/.exec(tag)?.[1])
    return { name: decodeXml(/\bname="([^"]*)"/.exec(tag)?.[1] ?? ''), path: `xl/${String(target).replace(/^\/?(xl\/)?/, '')}` }
  })
}

/** Shkronja e kolonës te referenca e qelizës ("AB12" → "AB"). */
export const columnOf = (ref) => ref.replace(/\d+$/, '')

/** Rreshtat e një teksti XML fletë: gjeneratori kthen { row: numri, cells: { A: vlera } }. Vlerat janë tekst ose numër. */
export function* sheetRows(xml, strings) {
  for (const rowMatch of xml.matchAll(/<row\s([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const number = Number(/\br="(\d+)"/.exec(rowMatch[1])?.[1])
    const cells = {}
    for (const cell of (rowMatch[2] ?? '').matchAll(/<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cell[1]
      const body = cell[2] ?? ''
      const ref = /\br="([A-Z]+\d+)"/.exec(attrs)?.[1]
      if (!ref) continue
      const type = /\bt="([^"]+)"/.exec(attrs)?.[1]
      let value = null
      if (type === 'inlineStr') value = richText(/<is>([\s\S]*?)<\/is>/.exec(body)?.[1] ?? '')
      else {
        const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1]
        if (raw === undefined) continue
        if (type === 's') value = strings[Number(raw)] ?? null
        else if (type === 'str' || type === 'e') value = decodeXml(raw)
        else if (type === 'b') value = raw === '1'
        else value = Number(raw)
      }
      if (value !== null) cells[columnOf(ref)] = value
    }
    yield { row: number, cells }
  }
}

/** Lexon një fletë me emër (ose me shprehje të rregullt) si rreshta { row, cells }. */
export function readSheet(file, sheet, strings = sharedStrings(file)) {
  const found = sheetList(file).find((entry) => (sheet instanceof RegExp ? sheet.test(entry.name) : entry.name === sheet))
  if (!found) throw new Error(`Fleta ${sheet} nuk ekziston te ${file}`)
  return [...sheetRows(part(file, found.path), strings)]
}
