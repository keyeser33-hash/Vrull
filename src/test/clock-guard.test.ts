// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Roja e orës në prova (docs/MESIMET.md › Provat). Dita e ushqimit (V46) ndërrohet 3 orë para zgjimit, ndaj një provë
// me orën e vërtetë (`new Date()`, `Date.now()`) bie mes mesnatës dhe asaj ore. Ndodhi tri herë: te seanca, te
// session-lighter (vala e gatishmërisë) dhe te kutia e AI-së (00:21 CET). Provat e reja përdorin orë të fiksuar:
// `now` te store-i, ose `vi.useFakeTimers({ toFake: ['Date'], now })`. Kjo listë mban vetëm përdorimet që ekzistonin
// më 10.11.2026; ajo vetëm ulet. Kur një skedar përdor më pak, ule numrin.
const BASELINE: Record<string, number> = {
  'src/data/app-data.test.ts': 2,
  'src/data/program-editor.test.ts': 1,
  'src/data/programme.test.ts': 1,
  'src/data/sync.e2e.test.ts': 2,
  'src/lib/music-tempo.test.ts': 2,
  'src/lib/session-notification.test.ts': 3,
  'src/routes/achievements.test.tsx': 1,
  'src/routes/add-food.test.tsx': 1,
  'src/routes/ai-box.test.tsx': 2,
  'src/routes/exercise.test.tsx': 1,
  'src/routes/history.test.tsx': 1,
  'src/routes/music.test.tsx': 2,
  'src/routes/nutrition-targets.test.tsx': 1,
  'src/routes/program.test.tsx': 1,
  'src/routes/session-notification.test.tsx': 3,
  'src/routes/session.test.tsx': 1,
  'src/routes/settings.test.tsx': 1,
  'src/routes/week-weights.test.tsx': 1,
}

const root = fileURLToPath(new URL('../..', import.meta.url))
const REAL_CLOCK = /new Date\(\)|Date\.now\(\)/g

function* testFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) yield* testFiles(full)
    else if (/\.test\.tsx?$/.test(entry)) yield full
  }
}

describe('ora e vërtetë në prova', () => {
  it('asnjë provë e re nuk përdor orën e vërtetë', () => {
    const over: string[] = []
    for (const file of testFiles(join(root, 'src'))) {
      const path = relative(root, file)
      if (path === 'src/test/clock-guard.test.ts') continue
      const count = (readFileSync(file, 'utf8').match(REAL_CLOCK) ?? []).length
      if (count > (BASELINE[path] ?? 0)) over.push(`${path}: ${count} (lejohen ${BASELINE[path] ?? 0})`)
    }
    expect(over).toEqual([])
  })
})
