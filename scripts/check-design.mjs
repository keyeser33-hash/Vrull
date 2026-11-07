// Roja e rregullave të Omal UI v2 (DESIGN.md): asnjë ngjyrë e shkruar në komponentë
// dhe asnjëherë tekst amber. globals.css është i vetmi vend ku jetojnë ngjyrat.
// Përdorimi: node scripts/check-design.mjs  (del me kod 1 nëse gjen shkelje)
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const ALLOWED = new Set(['src/styles/globals.css'])

const RULES = [
  { name: 'ngjyrë hex', re: /#[0-9a-fA-F]{3,8}\b/g },
  { name: 'rgb()/hsl()', re: /\b(?:rgba?|hsla?)\(/g },
  { name: 'tekst amber (text-brand)', re: /\btext-brand(?![-\w])/g },
  { name: 'ngjyrë arbitrare Tailwind', re: /\b(?:bg|text|border|fill|stroke)-\[#/g },
]

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
    if (ALLOWED.has(rel) || rel.endsWith('.test.ts') || rel.endsWith('.test.tsx')) continue
    const lines = readFileSync(file, 'utf8').split('\n')
    lines.forEach((line, i) => {
      for (const rule of RULES) {
        rule.re.lastIndex = 0
        if (rule.re.test(line)) found.push(`${rel}:${i + 1} ${rule.name}: ${line.trim()}`)
      }
    })
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
