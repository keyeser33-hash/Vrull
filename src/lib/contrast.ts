// Kontrasti WCAG 2 dhe leximi i tokenave të temave nga globals.css. I përdorin provat e tokenave
// (src/styles/tokens.test.ts): çdo çift teksti duhet të arrijë 4,5:1 në çdo temë.

import type { Theme } from './theme'

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i

/** Ndriçimi relativ (WCAG 2) i një ngjyre hex me 3 ose 6 shifra; çdo formë tjetër hedh gabim. */
export function relativeLuminance(hex: string): number {
  const match = HEX.exec(hex.trim())
  if (!match) throw new Error(`Ngjyrë jo hex: ${hex}`)
  const digits = match[1].length === 3 ? [...match[1]].map((digit) => digit + digit).join('') : match[1]
  const [r, g, b] = [0, 2, 4].map((offset) => {
    const channel = parseInt(digits.slice(offset, offset + 2), 16) / 255
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Raporti i kontrastit mes dy ngjyrave, nga 1 deri në 21, pavarësisht renditjes. */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

export type ThemeTokens = Record<string, string>

// Selektorët e blloqeve te globals.css. `shared` mban vlerat e njëjta në çdo temë; `aliases`
// (aliaset e v1) zgjidhen brenda secilës temë.
const BLOCKS: Record<Theme | 'shared' | 'aliases', string> = {
  shared: ':root',
  light: ':root, [data-theme="light"]',
  dark: '.dark, [data-theme="dark"]',
  oled: '.oled, [data-theme="oled"]',
  aliases: ':root, [data-theme]',
}

function declarations(css: string, selector: string): ThemeTokens {
  const found: ThemeTokens = {}
  const code = css.replace(/\/\*[\s\S]*?\*\//g, '')
  for (const match of code.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    // Selektori nis pas deklaratës së fundit para tij (p.sh. pas `@import …;`).
    if (match[1].split(';').pop()!.replace(/\s+/g, ' ').trim() !== selector) continue
    for (const declaration of match[2].matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
      found[declaration[1]] = declaration[2].trim()
    }
  }
  return found
}

function resolve(tokens: ThemeTokens, name: string, seen: string[] = []): string {
  const value = tokens[name]
  if (value === undefined) throw new Error(`Tokeni --${name} mungon (${seen.join(' → ') || 'pa referencë'})`)
  const reference = /^var\(--([\w-]+)\)$/.exec(value)
  if (!reference) return value
  if (seen.includes(name)) throw new Error(`Referencë rrethore: ${[...seen, name].join(' → ')}`)
  return resolve(tokens, reference[1], [...seen, name])
}

/** Tokenat e secilës temë (pa `--`), me var() të zgjidhura brenda temës. */
export function readThemeTokens(css: string): Record<Theme, ThemeTokens> {
  const shared = declarations(css, BLOCKS.shared)
  const aliases = declarations(css, BLOCKS.aliases)
  const themes = {} as Record<Theme, ThemeTokens>
  for (const theme of ['oled', 'dark', 'light'] as const) {
    const raw = { ...shared, ...declarations(css, BLOCKS[theme]), ...aliases }
    themes[theme] = Object.fromEntries(Object.keys(raw).map((name) => [name, resolve(raw, name)]))
  }
  return themes
}
