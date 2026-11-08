// @vitest-environment node
import { readFileSync } from 'node:fs'
import { contrastRatio, readThemeTokens } from '@/lib/contrast'
import { THEMES, type Theme } from '@/lib/theme'

const css = readFileSync(new URL('./globals.css', import.meta.url), 'utf8')
const themes = readThemeTokens(css)

// tokens.json i sistemit të dizajnit Vrull (08.11.2026), me temat e app-it:
// OLED = oled, Natë = dark, Ditë = light. Një vlerë e vetme vlen për të tri temat.
type Value = string | Record<Theme, string>
const t = (oled: string, dark: string, light: string): Value => ({ oled, dark, light })
const VRULL: Record<string, Value> = {
  background: t('#000000', '#0B0B0C', '#F4F4F5'),
  surface: t('#121214', '#18181B', '#FFFFFF'),
  'surface-2': t('#1C1C1F', '#222226', '#EDEDEF'),
  border: t('#27272A', '#27272A', '#E4E4E7'),
  foreground: t('#FAFAFA', '#FAFAFA', '#0B0B0C'),
  'muted-foreground': t('#A1A1AA', '#A1A1AA', '#52525B'),
  subtle: t('#3F3F46', '#3F3F46', '#D4D4D8'),
  ember: '#FF5B2E',
  'on-ember': '#0B0B0C',
  'ember-text': t('#FF5B2E', '#FF5B2E', '#C2410C'),
  data: t('#8B7CFF', '#8B7CFF', '#5B4BDB'),
  sand: '#E0B48A',
  success: t('#4ADE80', '#4ADE80', '#15803D'),
  danger: t('#F87171', '#F87171', '#B91C1C'),
  insight: t('#1A1206', '#1A1206', '#FFF1EA'),
  'insight-border': t('#5A2A12', '#5A2A12', '#FFD2C2'),
  scrim: '#00000099',
  track: t('#27272A', '#27272A', '#D4D4D8'),
  'model-light': '#FFFFFF',
  'volume-1': t('#4C1B0E', '#542316', '#FFCEC0'),
  'volume-2': t('#99371B', '#9D3B20', '#FF9D82'),
  'volume-3': '#FF5B2E',
}

// "Rregullat e temave" te README-ja e sistemit, si tokena që komponentët të mos zgjedhin temën vetë.
const THEME_RULES: Record<string, Value> = {
  // Kufiri 1 px i kartave, pllakave dhe butonave të mbushur: vetëm në OLED.
  'surface-border': t('#27272A', 'transparent', 'transparent'),
  // Tab-bar-i: `background` në OLED, `surface` në Natë dhe Ditë.
  nav: t('#000000', '#18181B', '#FFFFFF'),
  // Shenja pa vlerë mbi sfondin e faqes (ditët e pushimit): në Ditë `surface-2` del 1,04:1.
  mark: t('#1C1C1F', '#222226', '#FFFFFF'),
  // Çifti i kundërt: butoni i errët mbi kartën me prush, me tekst fiks.
  ink: '#0B0B0C',
  'on-ink': '#FAFAFA',
}

const valueIn = (value: Value, theme: Theme) => (typeof value === 'string' ? value : value[theme])

describe('tokenat e Vrullit te globals.css', () => {
  it.each(THEMES)('%s ka vlerat e tokens.json dhe të rregullave të temave', (theme) => {
    for (const [name, value] of Object.entries({ ...VRULL, ...THEME_RULES })) {
      expect({ name, value: themes[theme][name]?.toUpperCase() }).toEqual({ name, value: valueIn(value, theme).toUpperCase() })
    }
  })

  it('çdo token i temës është në të tri blloqet, që një pjesë me data-theme të mos trashëgojë temën e faqes', () => {
    const blocks = [...css.matchAll(/^(\.dark|\.oled|:root),\n\[data-theme="\w+"\] \{([^}]*)\}/gm)].map((match) =>
      [...match[2].matchAll(/--([\w-]+):/g)].map((name) => name[1]).sort(),
    )
    expect(blocks).toHaveLength(3)
    expect(blocks[1]).toEqual(blocks[0])
    expect(blocks[2]).toEqual(blocks[0])
  })

  it('asnjë vlerë e Omal UI v2 nuk mbetet: aliaset e v1 drejtojnë vetëm te tokenat e Vrullit', () => {
    const known = new Set([...Object.keys(VRULL), ...Object.keys(THEME_RULES)])
    const aliasBlock = /^:root,\n\[data-theme\] \{([^}]*)\}/m.exec(css)
    expect(aliasBlock).not.toBeNull()
    for (const [, name, target] of aliasBlock![1].matchAll(/--([\w-]+):\s*var\(--([\w-]+)\);/g)) {
      expect({ alias: name, target: known.has(target) }).toEqual({ alias: name, target: true })
    }
    for (const name of Object.keys(themes.oled)) {
      expect(known.has(name) || aliasBlock![1].includes(`--${name}:`)).toBe(true)
    }
    // Amber-i dhe ngjyrat e tjera të Omal-it.
    expect(css).not.toMatch(/#F1A335|#E8952A|#2A2520|#FEF3E2|#171717/i)
  })
})

// Çiftet tekst / sfond që komponentët përdorin. Teksti arrin 4,5:1 në çdo temë.
const TEXT_PAIRS: [text: string, ground: string][] = [
  ...['background', 'surface', 'surface-2', 'insight', 'nav', 'mark'].flatMap((ground) => [
    ['foreground', ground] as [string, string],
    ['muted-foreground', ground] as [string, string],
  ]),
  ['ember-text', 'background'],
  ['ember-text', 'surface'],
  ['ember-text', 'insight'],
  ['ember-text', 'nav'],
  ['data', 'background'],
  ['data', 'surface'],
  ['success', 'background'],
  ['success', 'surface'],
  ['danger', 'background'],
  ['danger', 'surface'],
  ['on-ember', 'ember'],
  ['on-ember', 'sand'],
  // Segmenti i zgjedhur dhe çipi RIR: mbushje `foreground`, tekst `background`.
  ['background', 'foreground'],
  ['on-ink', 'ink'],
  // Aliaset e v1 që ekranet përdorin ende si tekst mbi mbushje.
  ['primary-foreground', 'primary'],
  ['brand-foreground', 'brand'],
  ['destructive-foreground', 'destructive'],
  ['warning', 'warning-soft'],
  ['panel-muted-foreground', 'panel'],
]

describe('kontrasti i tekstit në çdo temë', () => {
  it.each(THEMES)('%s: çdo çift teksti ≥ 4,5:1', (theme) => {
    const failing = TEXT_PAIRS.map(([text, ground]) => ({
      pair: `${text} / ${ground}`,
      ratio: Math.round(contrastRatio(themes[theme][text], themes[theme][ground]) * 100) / 100,
    })).filter(({ ratio }) => ratio < 4.5)
    expect(failing).toEqual([])
  })

  it('e bardha mbi prush nuk lejohet: del nën 4,5:1', () => {
    expect(contrastRatio('#FFFFFF', themes.oled.ember)).toBeLessThan(4.5)
  })
})
