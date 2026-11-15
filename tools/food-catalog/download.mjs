// Shkarkon skedarët e USDA FoodData Central (tools/food-catalog/sources.json) në një dosje jashtë repo-s,
// kontrollon sha256 dhe i shpaketon te <dosja>/<id>/. Nuk shkarkon dy herë: një skedar që ekziston me sha256 të
// njëjtë kapërcehet. Herën e parë (sha256 bosh te sources.json) e shkruan sha256 aty; më pas një ndryshim është gabim.
//
// Përdorimi: node tools/food-catalog/download.mjs <dosja>   (p.sh. /tmp/food-src)
// Rrjeti pas proxy-t: NODE_USE_ENV_PROXY=1 (Node 22.21+).
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SOURCES = fileURLToPath(new URL('./sources.json', import.meta.url))

export function sha256Of(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

/** Krahason sha256 të shkarkuar me atë të regjistruar. Kthen { ok, record } ku record = sha256 i ri për t'u shkruar. */
export function verifySha(expected, actual) {
  if (!expected) return { ok: true, record: actual }
  return { ok: expected === actual, record: null }
}

async function main() {
  const dir = process.argv[2]
  if (!dir) {
    console.error('Përdorimi: node tools/food-catalog/download.mjs <dosja jashtë repo-s>')
    process.exit(1)
  }
  mkdirSync(dir, { recursive: true })
  const config = JSON.parse(readFileSync(SOURCES, 'utf8'))
  let changed = false
  for (const file of config.files) {
    const zip = join(dir, `${file.id}.zip`)
    let bytes = existsSync(zip) ? readFileSync(zip) : null
    if (bytes && file.sha256 && sha256Of(bytes) === file.sha256) {
      console.log(`${file.id}: ekziston, sha256 i njëjtë, kapërcehet`)
    } else {
      console.log(`${file.id}: po shkarkohet ${file.url}`)
      const response = await fetch(file.url)
      if (!response.ok) throw new Error(`${file.id}: HTTP ${response.status}`)
      bytes = Buffer.from(await response.arrayBuffer())
      writeFileSync(zip, bytes)
    }
    const actual = sha256Of(bytes)
    const check = verifySha(file.sha256, actual)
    if (!check.ok) throw new Error(`${file.id}: sha256 ${actual} nuk përputhet me sources.json (${file.sha256})`)
    if (check.record) {
      file.sha256 = check.record
      changed = true
      console.log(`${file.id}: sha256 i regjistruar ${actual}`)
    }
    const target = join(dir, file.id)
    mkdirSync(target, { recursive: true })
    execFileSync('unzip', ['-o', '-q', zip, '-d', target])
  }
  if (changed) writeFileSync(SOURCES, `${JSON.stringify(config, null, 2)}\n`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main()
