// Biblioteka e ushtrimeve nga free-exercise-db (github.com/yuhonas/free-exercise-db, Unlicense,
// domain publik). Mban vetëm ushtrimet e forcës dhe fushat që përdor app-i; muskujt mbeten si
// grupe të free-exercise-db dhe kthehen në çelësa sipas Shtojcës D (src/program/library.ts).
//
// Përdorimi: node tools/exercise-library/build.mjs <dosja e free-exercise-db>
// Shkruan src/program/library.json. Versioni i burimit shënohet te skedari.
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const source = process.argv[2]
if (!source) {
  console.error('Përdorimi: node tools/exercise-library/build.mjs <dosja e free-exercise-db>')
  process.exit(1)
}

const KEEP = new Set(['strength', 'powerlifting', 'olympic weightlifting', 'strongman', 'plyometrics'])
const EQUIPMENT = {
  barbell: 'barbell',
  'e-z curl bar': 'ez_bar',
  dumbbell: 'dumbbell',
  cable: 'cable',
  machine: 'machine',
  'body only': 'bodyweight',
  kettlebells: 'kettlebell',
  bands: 'band',
}

const all = JSON.parse(readFileSync(join(source, 'dist/exercises.json'), 'utf8'))
const commit = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const exercises = all
  .filter((exercise) => KEEP.has(exercise.category))
  .map((exercise) => ({
    id: exercise.id,
    name: exercise.name,
    equipment: EQUIPMENT[exercise.equipment] ?? 'other',
    primary: exercise.primaryMuscles,
    secondary: exercise.secondaryMuscles,
  }))
  .sort((a, b) => a.name.localeCompare(b.name))

const out = fileURLToPath(new URL('../../src/program/library.json', import.meta.url))
writeFileSync(out, JSON.stringify({ source: `free-exercise-db@${commit}`, exercises }) + '\n')
console.log(`${exercises.length} ushtrime nga ${all.length} → ${out}`)
