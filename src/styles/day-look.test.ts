// @vitest-environment node
/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { contrastRatio, readThemeTokens } from '@/lib/contrast'
import { THEMES, type Theme } from '@/lib/theme'

// Pamja e lodhur (V2-E3-07): `ember` bëhet rërë, `ember-text` rërë që lexohet në çdo temë, historiku e rikthen
// prushin dhe lëvizjet bëhen 360 ms pa kërcim.
const css = readFileSync(new URL('./globals.css', import.meta.url), 'utf8')
const themes = readThemeTokens(css)

function rule(selector: string) {
  const at = css.indexOf(`${selector} {`)
  expect(at, selector).toBeGreaterThanOrEqual(0)
  return css.slice(at, css.indexOf('}', at))
}

const tiredText = (theme: Theme) =>
  theme === 'light' ? /--ember-text:\s*(#[0-9A-F]{6})/i.exec(rule(':root[data-day="tired"]'))![1] : themes[theme].sand

describe('pamja e lodhur te globals.css', () => {
  it('ember = sand; teksti on-ember mbi të ≥ 4,5:1 në çdo temë', () => {
    expect(rule(':root[data-day="tired"]')).toContain('--ember: var(--sand)')
    for (const theme of THEMES) expect(contrastRatio(themes[theme]['on-ember'], themes[theme].sand)).toBeGreaterThanOrEqual(4.5)
  })

  it.each(THEMES)('%s: ember-text i ditës së lodhur lexohet mbi faqen, kartën, insight dhe tab-bar-in', (theme) => {
    if (theme !== 'light') expect(rule(':root.dark[data-day="tired"]')).toContain('--ember-text: var(--sand)')
    const failing = ['background', 'surface', 'insight', 'nav'].filter((ground) => contrastRatio(tiredText(theme), themes[theme][ground]) < 4.5)
    expect(failing).toEqual([])
  })

  it('historiku rikthen prushin e temës (ember dhe ember-text)', () => {
    const keep = rule(':root[data-day="tired"] [data-day-keep]').toUpperCase()
    expect(keep).toContain(`--EMBER: ${themes.light.ember.toUpperCase()}`)
    expect(keep).toContain(`--EMBER-TEXT: ${themes.light['ember-text'].toUpperCase()}`)
    expect(rule(':root.dark[data-day="tired"] [data-day-keep]').toUpperCase()).toContain(`--EMBER-TEXT: ${themes.dark['ember-text'].toUpperCase()}`)
  })

  it('lëvizjet 360 ms pa kërcim: ease-vrull bëhet ease-out, shiritat dhe shifrat 360 ms', () => {
    const tired = rule(':root[data-day="tired"]')
    expect(tired).toContain('--ease-vrull: ease-out')
    expect(tired).toContain('fill 360ms ease-out')
    expect(rule(':root[data-day="tired"] .duration-320')).toContain('transition-duration: 360ms')
    expect(rule(':root[data-day="tired"] .roll-digit')).toContain('animation-duration: 360ms')
  })
})
