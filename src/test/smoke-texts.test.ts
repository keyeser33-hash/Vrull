// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseSync } from 'vite'
import { describe, expect, it } from 'vitest'
import { en } from '@/i18n/en'
import { LANGUAGE_NAMES } from '@/i18n/language'
import { sq } from '@/i18n/sq'
import library from '@/program/library.json'
import { SHORTCUT_TO_SIZE } from '@/program/shortcut-to-size'

// Roja e provës së Android-it (docs/MESIMET.md › Prova e Android-it; docs/research/optimizimi-i-ndertimeve.md R1):
// çdo tekst që `scripts/android-smoke.mjs` pret ose prek vjen nga katalogu `src/i18n`. Kur një ekran ridizajnohet
// dhe teksti ndryshon, kjo provë bie te CI-ja në sekonda, jo emulatori pas 8–18 minutash. Pjesët A dhe B të skriptit
// prekin v1 0.16.0, një APK e ngrirë me tekstet e veta, ndaj nuk kontrollohen.

const SCRIPT = 'scripts/android-smoke.mjs'
const root = fileURLToPath(new URL('../..', import.meta.url))

/** Ndihmësit e skriptit dhe argumentet e tyre që janë tekst i app-it. */
const HELPERS: Record<string, number[]> = {
  waitForText: [1],
  waitForHeading: [1],
  hasText: [1],
  hasButton: [1],
  clickButton: [1],
  clickButtonStarting: [1],
  notificationButton: [0],
  tapNotificationButton: [0, 1],
  waitForNotificationTitle: [1],
  tapSave: [1],
}

/** Tekste që nuk vijnë nga katalogu, secili me arsyen. */
const NOT_CATALOG: Record<string, string> = {
  'Prova e ritmit': 'kënga e luajtësit të provës (android-test/)',
  'Kënga e dytë': 'kënga e luajtësit të provës (android-test/)',
  'Pulë e pjekur': 'ushqim nga përgjigjja e imituar e AI-së (fakeResponse te skripti)',
  'Makarona me karkaleca': 'ushqim nga përgjigjja e imituar e AI-së (fakeResponse te skripti)',
}

type Node = { type: string; start: number; [key: string]: unknown }
const isNode = (value: unknown): value is Node => typeof value === 'object' && value !== null && typeof (value as Node).type === 'string'
const children = (node: Node): Node[] =>
  Object.entries(node).flatMap(([key, value]) => (key === 'type' ? [] : Array.isArray(value) ? value.filter(isNode) : isNode(value) ? [value] : []))

/** Vargjet e shkruara që një argument mund të japë: vetë vargu ose degët e një kushti. */
function literals(node: Node): string[] {
  if (node.type === 'Literal') return typeof node.value === 'string' ? [node.value] : []
  if (node.type === 'ConditionalExpression') return [...literals(node.consequent as Node), ...literals(node.alternate as Node)]
  if (node.type === 'LogicalExpression') return [...literals(node.left as Node), ...literals(node.right as Node)]
  return []
}

/** Tekstet e app-it që skripti pret, me rreshtin. */
function scriptTexts(): { text: string; line: number }[] {
  const code = readFileSync(`${root}${SCRIPT}`, 'utf8')
  const { program, errors } = parseSync(SCRIPT, code, { lang: 'js' })
  if (errors.length > 0) throw new Error(`${SCRIPT} nuk lexohet: ${errors[0].message}`)
  const lines = code.split('\n')
  const marker = (prefix: string) => lines.findIndex((line) => line.trimStart().startsWith(prefix)) + 1
  const [v1Start, v1End] = [marker('// ==== A.'), marker('// ==== C.')]
  if (v1Start === 0 || v1End <= v1Start) throw new Error(`${SCRIPT}: shenjat "// ==== A." dhe "// ==== C." mungojnë`)
  const found: { text: string; line: number }[] = []
  const visit = (node: Node) => {
    const callee = node.type === 'CallExpression' ? (node.callee as Node) : null
    const positions = callee?.type === 'Identifier' ? HELPERS[callee.name as string] : undefined
    if (positions) {
      const args = node.arguments as Node[]
      for (const position of positions) {
        const arg = args.at(position)
        const line = code.slice(0, node.start).split('\n').length
        if (arg && (line < v1Start || line >= v1End)) for (const text of literals(arg)) found.push({ text, line })
      }
    }
    children(node).forEach(visit)
  }
  visit(program as unknown as Node)
  return found
}

/** Çdo mesazh i katalogut, në të dyja gjuhët; shumësi jep secilën formë. */
function leaves(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (typeof value === 'object' && value !== null) return Object.values(value).flatMap(leaves)
  return []
}

// Numrat (62,5 · 2 900 · 0.23.2) dhe parametrat ({count}) bëhen #, që "Seti 2 nga 3" të gjejë "Seti {n} nga {total}".
const NUMBER = /\d+(?:[.,   ]\d+)*/g
const skeleton = (text: string) => text.replace(/[  ]/g, ' ').replace(/\{[^{}]+\}/g, '#').replace(NUMBER, '#')
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const messages = [...leaves(sq), ...leaves(en)].map(skeleton)
// Një mesazh i tërë me parametra ("Rrit peshën me {weight}" → "Rrit peshën me # kg"); vetëm ai që ka tekst të vetin,
// që "{name}" të mos pranojë çdo gjë.
const patterns = messages.filter((message) => (message.match(/\p{L}/gu) ?? []).length >= 4).map((message) => new RegExp(`^${message.split('#').map(escape).join('.+')}$`))
// fmt.unit: "85 cm", "62,5 kg".
const UNIT = /^# (kg|cm|kcal|g|ml|min)$/
// Emrat e ushtrimeve dhe të gjuhëve janë jashtë katalogut (CLAUDE.md › Tekstet në dy gjuhë).
const names = new Set([
  ...(library as { exercises: { name: string }[] }).exercises.map((exercise) => exercise.name),
  ...SHORTCUT_TO_SIZE.exercises.map((exercise) => exercise.name),
  ...Object.values(LANGUAGE_NAMES),
])
// Emri i ushtrimit para tekstit të katalogut, si te njoftimi i seancës ("Bench Press · Seti 3 nga 3").
const withExercise = (text: string) => [...names].find((name) => text.startsWith(`${name} · `))

function fromCatalog(text: string): boolean {
  const exercise = withExercise(text)
  if (exercise) return fromCatalog(text.slice(exercise.length + 3))
  const shape = skeleton(text)
  return UNIT.test(shape) || names.has(text) || messages.some((message) => message.includes(shape)) || patterns.some((pattern) => pattern.test(shape))
}

describe('tekstet e provës së Android-it', () => {
  const texts = scriptTexts()

  it('gjen tekstet te skripti', () => {
    expect(texts.length).toBeGreaterThan(50)
  })

  it('çdo tekst që pret skripti vjen nga katalogu i18n', () => {
    const missing = texts.filter(({ text }) => !(text in NOT_CATALOG) && !fromCatalog(text)).map(({ text, line }) => `${SCRIPT}:${line} ${JSON.stringify(text)}`)
    expect(missing).toEqual([])
  })

  it('çdo përjashtim përdoret ende nga skripti', () => {
    const used = new Set(texts.map(({ text }) => text))
    expect(Object.keys(NOT_CATALOG).filter((text) => !used.has(text))).toEqual([])
  })

  it('kap një tekst që app-i nuk e ka, dhe pranon parametrat, njësitë dhe ushtrimet', () => {
    expect(fromCatalog('Ruaj ushtrimin e vjetër që nuk ekziston')).toBe(false)
    expect(fromCatalog('Seti 2 nga 3')).toBe(true)
    expect(fromCatalog('Rrit peshën me 2,5 kg')).toBe(true)
    expect(fromCatalog('85 cm')).toBe(true)
    expect(fromCatalog('Bench Press')).toBe(true)
  })
})
