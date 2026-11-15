// Shkarkon skedarët e burimeve (tools/food-catalog/sources.json) në një dosje jashtë repo-s, kontrollon sha256 dhe i
// shpaketon (zip) te <dosja>/<id>/. Nuk shkarkon dy herë: një skedar që ekziston me sha256 të njëjtë kapërcehet. Herën e
// parë (sha256 bosh te sources.json) e shkruan sha256 aty; më pas një ndryshim është gabim.
//
// Llojet (`kind` te sources.json): `zip` (parazgjedhja: një zip, shpaketohet), `file` (një skedar te <dosja>/<id>/<name>),
// `parts` (disa skedarë me `name`, `url`, `sha256` secili), `api` (Livsmedelsverket: paketa JSON e ndërtuar nga API zyrtare).
// Shkarkimet vetëm nga URL-të e faqeve zyrtare që janë te sources.json; asnjë ridrejtim jashtë tyre nuk anashkalohet.
//
// Përdorimi: node tools/food-catalog/download.mjs <dosja> [id ...]   (p.sh. /tmp/food-src; me id, vetëm ato burime)
// Rrjeti pas proxy-t: NODE_USE_ENV_PROXY=1 (Node 22.21+).
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchLivsmedelsverketBundle } from './livsmedelsverket.mjs'

const SOURCES = fileURLToPath(new URL('./sources.json', import.meta.url))

export function sha256Of(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

/** Krahason sha256 të shkarkuar me atë të regjistruar. Kthen { ok, record } ku record = sha256 i ri për t'u shkruar. */
export function verifySha(expected, actual) {
  if (!expected) return { ok: true, record: actual }
  return { ok: expected === actual, record: null }
}

/** Skedarët që duhen për një hyrje të sources.json: [{ item, path }]; item mban url dhe sha256 (shkruhet aty). */
export function itemsOf(file, dir) {
  const kind = file.kind ?? 'zip'
  if (kind === 'zip') return [{ item: file, path: join(dir, `${file.id}.zip`) }]
  if (kind === 'parts') return file.parts.map((item) => ({ item, path: join(dir, file.id, item.name) }))
  return [{ item: file, path: join(dir, file.id, file.filename ?? `${file.id}.dat`) }]
}

async function fetchBytes(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`HTTP ${response.status} për ${url}`)
  return Buffer.from(await response.arrayBuffer())
}

async function main() {
  const [dir, ...only] = process.argv.slice(2)
  if (!dir) {
    console.error('Përdorimi: node tools/food-catalog/download.mjs <dosja jashtë repo-s> [id ...]')
    process.exit(1)
  }
  mkdirSync(dir, { recursive: true })
  const config = JSON.parse(readFileSync(SOURCES, 'utf8'))
  let changed = false
  for (const file of config.files) {
    if (only.length && !only.includes(file.id)) continue
    const kind = file.kind ?? 'zip'
    mkdirSync(join(dir, file.id), { recursive: true })
    for (const { item, path } of itemsOf(file, dir)) {
      const label = item === file ? file.id : `${file.id}/${item.name}`
      let bytes = existsSync(path) ? readFileSync(path) : null
      if (bytes && item.sha256 && sha256Of(bytes) === item.sha256) {
        console.log(`${label}: ekziston, sha256 i njëjtë, kapërcehet`)
      } else {
        console.log(`${label}: po shkarkohet ${item.url}`)
        bytes = kind === 'api' ? await fetchLivsmedelsverketBundle(file.url) : await fetchBytes(item.url)
        writeFileSync(path, bytes)
      }
      const actual = sha256Of(bytes)
      const check = verifySha(item.sha256, actual)
      if (!check.ok) throw new Error(`${label}: sha256 ${actual} nuk përputhet me sources.json (${item.sha256})`)
      if (check.record) {
        item.sha256 = check.record
        item.bytes ??= bytes.length
        changed = true
        console.log(`${label}: sha256 i regjistruar ${actual}`)
      }
      if (kind === 'zip') execFileSync('unzip', ['-o', '-q', path, '-d', join(dir, file.id)])
    }
  }
  if (changed) writeFileSync(SOURCES, `${JSON.stringify(config, null, 2)}\n`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main()
