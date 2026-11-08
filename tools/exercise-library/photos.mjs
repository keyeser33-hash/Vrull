// Fotot e ushtrimeve të Shortcut to Size, të paketuara në app që të shfaqen pa internet (SPEC §0.3a,
// "Fotot e ushtrimeve"; V10). Burimi: free-exercise-db (github.com/yuhonas/free-exercise-db,
// Unlicense, domain publik), në të njëjtin commit si library.json. Për çdo ushtrim të programit me ID
// në bibliotekë merret foto e parë (0.jpg, 850 × 567), bëhet bardh e zi dhe 640 px e gjerë (JPEG 72,
// pa metadata, me ImageMagick), dhe shkruhet te public/exercise-photos/<id>.jpg. Fotot e ushtrimeve
// të tjera i merr app-i nga i njëjti commit kur ka internet dhe i ruan në telefon (lib/exercise-photo.ts).
//
// Përdorimi: node tools/exercise-library/photos.mjs   (kërkon internet dhe `convert` të ImageMagick)
// Shkruan public/exercise-photos/ dhe src/program/exercise-photos.json (lista që app-i di se i ka).
import { execFileSync } from 'node:child_process'
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../', import.meta.url))
const { source } = JSON.parse(readFileSync(join(root, 'src/program/library.json'), 'utf8'))
const commit = source.replace(/^free-exercise-db@/, '')
if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error(`Commit-i i bibliotekës nuk lexohet: ${source}`)

// Node 22 i heq vetë tipet e TypeScript-it; skedari i programit importon vetëm tipe.
const { SHORTCUT_TO_SIZE } = await import(join(root, 'src/program/shortcut-to-size.ts'))
const ids = [...new Set(SHORTCUT_TO_SIZE.exercises.map((exercise) => exercise.libraryId).filter(Boolean))].sort()

const out = join(root, 'public/exercise-photos')
rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })
const work = join(out, '.download')
mkdirSync(work)

for (const id of ids) {
  const url = `https://raw.githubusercontent.com/yuhonas/free-exercise-db/${commit}/exercises/${encodeURIComponent(id)}/0.jpg`
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${id}: ${response.status} ${url}`)
  const original = join(work, `${id}.jpg`)
  writeFileSync(original, Buffer.from(await response.arrayBuffer()))
  execFileSync('convert', [original, '-strip', '-colorspace', 'Gray', '-resize', '640x', '-quality', '72', '-interlace', 'JPEG', join(out, `${id}.jpg`)])
}
rmSync(work, { recursive: true, force: true })

writeFileSync(
  join(out, 'SOURCE.txt'),
  `Fotot e ushtrimeve: free-exercise-db (https://github.com/yuhonas/free-exercise-db), commit ${commit}.\n` +
    'Unlicense: domain publik. Bardh e zi dhe 640 px nga tools/exercise-library/photos.mjs.\n',
)
const bytes = ids.reduce((total, id) => total + statSync(join(out, `${id}.jpg`)).size, 0)
writeFileSync(join(root, 'src/program/exercise-photos.json'), JSON.stringify({ source, ids }, null, 2) + '\n')
console.log(`${readdirSync(out).length - 1} foto, ${(bytes / 1024).toFixed(0)} kB → ${out}`)
