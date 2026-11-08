// Roja e rregullave të Vrullit (DESIGN.md): ngjyrat vijnë vetëm nga tokenat e globals.css,
// prushi si tekst ose vijë e hollë është `ember-text`, teksti mbi prush është `on-ember`, dhe
// aliaset e v1 (Omal UI v2) mbeten vetëm te skedarët e v1 derisa ekranet të kalojnë te Vrull.
// Përdorimi: node scripts/check-design.mjs  (del me kod 1 nëse gjen shkelje)
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const ALLOWED = new Set(['src/styles/globals.css'])

// Emrat e v1 që globals.css i mban si alias drejt tokenave të Vrullit, që ekranet e v1 të hapen
// deri sa të rishikohen (E1-05 … E1-15). Kod i ri nuk i përdor.
const LEGACY_TOKENS = [
  'card', 'popover', 'popover-foreground', 'muted', 'secondary', 'secondary-foreground',
  'primary', 'primary-hover', 'primary-foreground', 'accent', 'accent-foreground',
  'brand', 'brand-hover', 'brand-foreground', 'brand-soft', 'selected', 'border-subtle', 'input',
  'ring', 'skeleton', 'success-soft', 'warning', 'warning-soft', 'destructive',
  'destructive-foreground', 'destructive-soft', 'chart-1', 'chart-track', 'panel',
  'panel-foreground', 'panel-muted-foreground', 'panel-border', 'panel-button', 'overlay',
]

// Skedarët e v1 që përdorin ende aliaset. Kur një ekran kalon te Vrull, hiqet nga lista; kur lista
// mbetet bosh, hiqen edhe aliaset nga globals.css.
export const LEGACY_FILES = new Set([
  'src/components/body/body-figure.tsx',
  'src/components/body/body-model.tsx',
  'src/components/body/focus-chip.tsx',
  'src/components/body/roles.ts',
  'src/components/charts/trend-chart.tsx',
  'src/components/forms/choice.tsx',
  'src/components/forms/day-picker.tsx',
  'src/components/forms/library-picker.tsx',
  'src/components/forms/value-stepper.tsx',
  'src/routes/add-food.tsx',
  'src/routes/body-format.ts',
  'src/routes/body.tsx',
  'src/routes/exercise-muscles.tsx',
  'src/routes/gate.tsx',
  'src/routes/login.tsx',
  'src/routes/onboarding.tsx',
  'src/routes/photos.tsx',
  'src/routes/prescription-sheet.tsx',
  'src/routes/program-editor.tsx',
  'src/routes/session-sheets.tsx',
  'src/routes/session.tsx',
  'src/routes/slot-editor.tsx',
  'src/routes/today.tsx',
])

const PREFIX = '(?<![\\w-])(?:bg|text|border|fill|stroke|outline|ring|divide|placeholder|decoration|shadow|from|via|to|caret)'
const legacyNames = LEGACY_TOKENS.join('|')
const PALETTE = 'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose'

const RULES = [
  { name: 'ngjyrë hex', re: /#[0-9a-fA-F]{3,8}\b/ },
  { name: 'rgb()/hsl()', re: /\b(?:rgba?|hsla?)\(/ },
  { name: 'ngjyrë arbitrare Tailwind', re: new RegExp(`${PREFIX}-\\[(?:#|color:|rgb|hsl)`) },
  { name: 'ngjyrë jashtë tokenave', re: new RegExp(`${PREFIX}-(?:white|black|(?:${PALETTE})-\\d{2,3})(?![\\w-])`) },
  { name: 'tekst amber (text-brand)', re: /(?<![\w-])text-brand(?![\w-])/, everywhere: true },
  {
    name: 'prushi si tekst ose vijë',
    re: /(?<![\w-])(?:text|border|stroke|outline|ring|decoration)-ember(?![\w/-])/,
  },
  {
    name: 'tekst mbi prush',
    test: (line) =>
      /(?<![\w-])bg-(?:ember|sand)(?![\w/-])/.test(line) &&
      /(?<![\w-])text-(?:foreground|background|muted-foreground|white|black|ember-text|data|on-ink|surface)(?![\w-])/.test(line),
  },
  { name: 'variant teme', re: /(?<![\w-])(?:dark|oled|light):(?=[a-z[!-])/ },
  {
    name: 'alias i v1',
    legacy: true,
    test: (line) =>
      new RegExp(`${PREFIX}-(?:${legacyNames})(?![\\w-])`).test(line) ||
      new RegExp(`--(?:${legacyNames})(?![\\w-])`).test(line) ||
      (/variant(?:=|:\s*)["'](?:brand|on-panel|panel|default|destructive)["']/.test(line) && !/defaultVariants/.test(line)),
  },
]

/** Shkeljet e një skedari, si "rruga:rreshti rregulli: rreshti". */
export function checkSource(path, text) {
  if (ALLOWED.has(path) || /\.test\.[cm]?[jt]sx?$/.test(path)) return []
  const legacyFile = LEGACY_FILES.has(path)
  const found = []
  text.split('\n').forEach((line, i) => {
    for (const rule of RULES) {
      if (legacyFile && rule.legacy) continue
      const hit = rule.test ? rule.test(line) : rule.re.test(line)
      if (hit) found.push(`${path}:${i + 1} ${rule.name}: ${line.trim()}`)
    }
  })
  return found
}

function* files(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) yield* files(full)
    else if (/\.(tsx?|css)$/.test(entry)) yield full
  }
}

export function findViolations() {
  const found = []
  for (const file of files(join(root, 'src'))) {
    const rel = relative(root, file).split('\\').join('/')
    found.push(...checkSource(rel, readFileSync(file, 'utf8')))
  }
  // Një skedar i v1 që nuk ekziston më ose që nuk i përdor më aliaset del nga lista.
  for (const rel of LEGACY_FILES) {
    let text
    try {
      text = readFileSync(join(root, rel), 'utf8')
    } catch {
      found.push(`${rel} alias i v1: skedari nuk ekziston, hiqe nga LEGACY_FILES`)
      continue
    }
    const legacyRule = RULES.find((rule) => rule.legacy)
    if (!text.split('\n').some((line) => legacyRule.test(line))) {
      found.push(`${rel} alias i v1: nuk përdor më aliaset, hiqe nga LEGACY_FILES`)
    }
  }
  return found
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const violations = findViolations()
  if (violations.length) {
    console.error(violations.join('\n'))
    process.exit(1)
  }
  console.log('Rregullat e dizajnit: asnjë shkelje.')
}
