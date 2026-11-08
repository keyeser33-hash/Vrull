// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseSync } from 'vite'

// Roja e teksteve (V2-E1-16b, SPEC §0.3a "Gjuhët"): çdo tekst që sheh përdoruesi vjen nga katalogu
// `src/i18n`, që me anglishten asnjë ekran të mos tregojë shqip. Skanon me parser-in e Vite-it (oxc):
//   1. te `src/routes` dhe `src/components`: tekstin JSX dhe atributet e tekstit (`aria-label`,
//      `title`, `placeholder`, `label`, `detail`…) me shkronja jashtë `t()`, si tekst i shkruar ose
//      si degë e një kushti (`ok ? 'Po' : 'Jo'`) apo pjesë e një template literal-i;
//   2. te `src/routes`, `src/components`, `src/lib` dhe `src/reminders`: çdo varg me ë ose ç jashtë
//      komenteve, që kap edhe tekstet e funksioneve ndihmëse dhe të njoftimeve.
// Përjashtimet janë më poshtë, secila me arsyen. Mesazhet e gabimeve që vetëm logohen, emrat e
// ushtrimeve dhe të dhënat që ruhen shqip në bazë (`src/nutrition`, `src/program`) janë jashtë
// skanimit; këto të fundit i përkthen `@/i18n/domain`.

const root = fileURLToPath(new URL('../..', import.meta.url))

/** Skedarë të tërë jashtë rregullit. */
const SKIP_FILES: Record<string, string> = {
  // Faqja e brendshme e sistemit të dizajnit: pa lidhje nga app-i, me tekste mostre për bordet.
  'src/routes/dev-ds.tsx': 'faqe e brendshme',
  // Mesazhet e gabimit të kontrastit dalin vetëm te provat e tokenave dhe te konsola.
  'src/lib/contrast.ts': 'gabime që vetëm logohen',
}

/** Tekste që janë të njëjta në të dyja gjuhët: njësitë, shkurtimet dhe emrat e përveçëm. */
const NEUTRAL = new Set(['kg', 'kcal', 'cm', 'min', 'e1RM', 'RIR', 'BPM', 'JSON', 'Open Food Facts', 'USDA'])

const TEXT_ATTRIBUTES = new Set([
  'aria-label',
  'aria-description',
  'aria-valuetext',
  'aria-placeholder',
  'aria-roledescription',
  'title',
  'alt',
  'placeholder',
  'label',
  'detail',
  'description',
  'caption',
  'eyebrow',
  'hint',
  'intro',
  'text',
  'value',
  'unit',
  'lineLabel',
  'pointsLabel',
  'minusLabel',
  'plusLabel',
  'back',
])

const WORD = /\p{L}{2,}/u
const ALBANIAN = /[ëçËÇ]/

type Node = { type: string; start: number; [key: string]: unknown }

function* sources(dir: string, pattern: RegExp): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) yield* sources(full, pattern)
    else if (pattern.test(entry) && !/\.test\.[jt]sx?$/.test(entry)) yield full
  }
}

const isNode = (value: unknown): value is Node => typeof value === 'object' && value !== null && typeof (value as Node).type === 'string'

function children(node: Node): Node[] {
  return Object.entries(node).flatMap(([key, value]) => {
    if (key === 'type') return []
    if (Array.isArray(value)) return value.filter(isNode)
    return isNode(value) ? [value] : []
  })
}

const calleeName = (node: Node) => {
  const callee = node.callee as Node
  if (callee.type === 'Identifier') return callee.name as string
  if (callee.type === 'MemberExpression' && isNode(callee.property)) return (callee.property as Node).name as string
  return ''
}

/**
 * Vargjet që dalin drejt e si tekst nga një shprehje JSX: vetë vargu, degët e një kushti, ana e
 * djathtë e `&&`/`||`/`??`, një template literal (pjesët e shkruara dhe shprehjet brenda tij) dhe
 * `+`. Thirrjet (`t()`, `fmt.date()`), funksionet dhe krahasimet nuk janë tekst.
 */
function shownStrings(node: Node, found: { node: Node; text: string }[]) {
  switch (node.type) {
    case 'Literal':
      if (typeof node.value === 'string') found.push({ node, text: node.value })
      return
    case 'TemplateLiteral':
      found.push({ node, text: (node.quasis as Node[]).map((quasi) => (quasi.value as { cooked: string }).cooked).join(' ') })
      for (const expression of node.expressions as Node[]) shownStrings(expression, found)
      return
    case 'ConditionalExpression':
      shownStrings(node.consequent as Node, found)
      shownStrings(node.alternate as Node, found)
      return
    case 'LogicalExpression':
      if (node.operator !== '&&') shownStrings(node.left as Node, found)
      shownStrings(node.right as Node, found)
      return
    case 'BinaryExpression':
      if (node.operator === '+') {
        shownStrings(node.left as Node, found)
        shownStrings(node.right as Node, found)
      }
      return
    case 'ParenthesizedExpression':
    case 'TSAsExpression':
    case 'TSNonNullExpression':
      shownStrings(node.expression as Node, found)
      return
  }
}

// Një adresë si shembull (placeholder-i i YouTube-it) është e njëjtë në të dyja gjuhët.
const neutral = (text: string) => !WORD.test(text) || NEUTRAL.has(text.trim()) || /^https?:\/\/\S+$/.test(text.trim())

/** Shkeljet e rregullit 1 (tekst JSX) dhe 2 (ë/ç në çdo varg) në një skedar. */
function scan(path: string, code: string, { jsx = true }: { jsx?: boolean } = {}): string[] {
  const { program, errors } = parseSync(path, code, { lang: path.endsWith('.tsx') ? 'tsx' : 'ts' })
  if (errors.length > 0) return [`${path}: nuk lexohet (${errors[0].message})`]
  const line = (node: Node) => code.slice(0, node.start).split('\n').length
  const found: string[] = []
  const report = (node: Node, kind: string, text: string) => found.push(`${path}:${line(node)} ${kind}: ${JSON.stringify(text.trim().slice(0, 80))}`)
  // Tekst i shfaqur pa ë/ç (ata i kap rregulli 2, që të mos dalin dy herë).
  const shown = (strings: { node: Node; text: string }[], kind: string) => {
    for (const entry of strings) if (!neutral(entry.text) && !ALBANIAN.test(entry.text)) report(entry.node, kind, entry.text)
  }
  const visit = (node: Node, insideT: boolean) => {
    if (node.type === 'CallExpression' && calleeName(node) === 't') insideT = true
    if (!insideT && node.type === 'Literal' && typeof node.value === 'string' && ALBANIAN.test(node.value)) report(node, 'varg shqip', node.value)
    if (!insideT && node.type === 'TemplateLiteral') {
      for (const quasi of node.quasis as Node[]) {
        const text = (quasi.value as { cooked: string }).cooked
        if (ALBANIAN.test(text)) report(quasi, 'varg shqip', text)
      }
    }
    if (jsx && node.type === 'JSXText' && !neutral(String(node.value))) report(node, 'tekst JSX', String(node.value))
    if (jsx && node.type === 'JSXElement') {
      // Fëmijët `{…}` janë tekst; vlerat e atributeve jo (klasat, adresat), përveç atributeve të tekstit.
      for (const child of node.children as Node[]) {
        if (child.type === 'JSXExpressionContainer' && isNode(child.expression)) {
          const strings: { node: Node; text: string }[] = []
          shownStrings(child.expression, strings)
          shown(strings, 'tekst JSX')
        }
      }
    }
    if (jsx && node.type === 'JSXAttribute') {
      const name = node.name as Node
      const attribute = name.type === 'JSXIdentifier' ? String(name.name) : ''
      const value = node.value as Node | null
      if (TEXT_ATTRIBUTES.has(attribute) && value) {
        const strings: { node: Node; text: string }[] = []
        if (value.type === 'Literal') strings.push({ node: value, text: String(value.value) })
        else if (value.type === 'JSXExpressionContainer' && isNode(value.expression)) shownStrings(value.expression, strings)
        shown(strings, attribute)
      }
    }
    children(node).forEach((child) => visit(child, insideT))
  }
  visit(program as unknown as Node, false)
  return [...new Set(found)]
}

function violations() {
  const found: string[] = []
  const scanTree = (dir: string, pattern: RegExp, jsx: boolean) => {
    for (const file of sources(join(root, dir), pattern)) {
      const rel = relative(root, file).split('\\').join('/')
      if (rel in SKIP_FILES) continue
      found.push(...scan(rel, readFileSync(file, 'utf8'), { jsx }))
    }
  }
  scanTree('src/routes', /\.tsx?$/, true)
  scanTree('src/components', /\.tsx?$/, true)
  scanTree('src/lib', /\.tsx?$/, false)
  scanTree('src/reminders', /\.ts$/, false)
  return found
}

describe('tekstet vijnë nga katalogu', () => {
  it('asnjë tekst i ngurtë te ekranet, komponentët dhe njoftimet', () => {
    expect(violations()).toEqual([])
  })

  it('kap tekstin JSX, atributet e tekstit dhe degët e kushteve; lë t(), njësitë dhe emrat e përveçëm', () => {
    const lines = (code: string) => scan('src/routes/x.tsx', code).map((entry) => entry.replace(/^src\/routes\/x\.tsx:\d+ /, ''))
    expect(lines('const a = <p>Ende pa foto.</p>')).toEqual(['tekst JSX: "Ende pa foto."'])
    expect(lines('const a = <p>No photos yet</p>')).toEqual(['tekst JSX: "No photos yet"'])
    expect(lines('const a = <Button aria-label="Mbyll" />')).toEqual(['aria-label: "Mbyll"'])
    expect(lines('const a = <input placeholder={`p.sh. ${x}`} />')).toEqual(['placeholder: "p.sh."'])
    expect(lines("const a = <span>{busy ? 'Po ruhet' : t('photos.save')}</span>")).toEqual(['tekst JSX: "Po ruhet"'])
    expect(lines('const a = <p>Shto te {meal}</p>')).toEqual(['tekst JSX: "Shto te"'])
    // Shkronjat shqipe kapen kudo, edhe te një funksion ndihmës.
    expect(lines("const status = (done) => (done ? 'E bërë' : 'Në pritje')")).toEqual(['varg shqip: "E bërë"', 'varg shqip: "Në pritje"'])
    // Lejohen: t(), formatet, njësitë, emrat e përveçëm, klasat dhe vargjet pa shkronja.
    expect(lines("const a = <p className=\"type-caption\">{t('photos.none')}</p>")).toEqual([])
    expect(lines("const a = <span>{fmt.unit(62.5, 'kg')} · {value} kg</span>")).toEqual([])
    expect(lines('const a = <Group title={source === USDA ? t(\'food.remote.usda\') : source} />')).toEqual([])
    expect(lines('const a = <Row label={`${name}, ${time}`} detail="Open Food Facts" />')).toEqual([])
    expect(lines("const a = <Sheet footer={<Button>Ruaj</Button>} />")).toEqual(['tekst JSX: "Ruaj"'])
  })

  it('te njoftimet dhe skedarët pa JSX kap vetëm vargjet me ë dhe ç', () => {
    expect(scan('src/lib/x.ts', "export const name = 'Rikujtuesit'; export const text = 'Vaktet, suplementet, stërvitja'", { jsx: false })).toEqual([
      'src/lib/x.ts:1 varg shqip: "Vaktet, suplementet, stërvitja"',
    ])
    expect(scan('src/lib/x.ts', "// Rikujtuesit: tekstet në gjuhën e app-it\nexport const id = 'rikujtuesit'", { jsx: false })).toEqual([])
  })
})
