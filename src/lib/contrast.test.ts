import { contrastRatio, readThemeTokens, relativeLuminance } from './contrast'

describe('kontrasti WCAG 2', () => {
  it('ndriçimi relativ i së zezës dhe së bardhës', () => {
    expect(relativeLuminance('#000000')).toBe(0)
    expect(relativeLuminance('#FFFFFF')).toBe(1)
  })

  it('pranon edhe formën me tre shifra dhe shkronja të vogla', () => {
    expect(relativeLuminance('#fff')).toBe(1)
    expect(relativeLuminance('#ff5b2e')).toBeCloseTo(relativeLuminance('#FF5B2E'), 10)
  })

  it('e zeza mbi të bardhë është 21:1, në çdo renditje', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5)
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 5)
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5)
  })

  it('vlerat e matura te sistemi i dizajnit', () => {
    // README i Vrullit: on-ember mbi prush 6,4:1, e bardha mbi prush 3,1:1, ember-text në Ditë 5,2:1 mbi të bardhë.
    expect(contrastRatio('#0B0B0C', '#FF5B2E')).toBeCloseTo(6.4, 1)
    expect(contrastRatio('#FFFFFF', '#FF5B2E')).toBeCloseTo(3.1, 1)
    expect(contrastRatio('#C2410C', '#FFFFFF')).toBeCloseTo(5.2, 1)
  })

  it('refuzon vlerat që nuk janë hex i plotë', () => {
    expect(() => relativeLuminance('transparent')).toThrow()
    expect(() => relativeLuminance('#00000099')).toThrow()
    expect(() => relativeLuminance('var(--surface)')).toThrow()
  })
})

describe('tokenat e temave nga CSS-i', () => {
  const css = `
@import "tailwindcss";
:root {
  --ember: #FF5B2E;
  --scrim: #00000099;
}
:root,
[data-theme="light"] {
  --background: #F4F4F5;
  --surface: #FFFFFF;
  --nav: var(--surface);
}
.dark,
[data-theme="dark"] {
  --background: #0B0B0C;
  --surface: #18181B;
  --nav: var(--surface);
}
.oled,
[data-theme="oled"] {
  --background: #000000;
  --surface: #121214;
  --nav: var(--background);
}
:root,
[data-theme] {
  --card: var(--surface);
  --brand: var(--ember);
}
@theme inline {
  --color-surface: var(--surface);
}
`

  it('ndan tri temat dhe u shton tokenat e përbashkët', () => {
    const themes = readThemeTokens(css)
    expect(Object.keys(themes).sort()).toEqual(['dark', 'light', 'oled'])
    expect(themes.light.background).toBe('#F4F4F5')
    expect(themes.dark.background).toBe('#0B0B0C')
    expect(themes.oled.ember).toBe('#FF5B2E')
    expect(themes.dark.scrim).toBe('#00000099')
  })

  it('zgjidh var() brenda temës, edhe për aliaset', () => {
    const themes = readThemeTokens(css)
    expect(themes.light.nav).toBe('#FFFFFF')
    expect(themes.oled.nav).toBe('#000000')
    expect(themes.dark.card).toBe('#18181B')
    expect(themes.oled.brand).toBe('#FF5B2E')
  })

  it('nuk merr variablat e Tailwind-it nga @theme', () => {
    expect(readThemeTokens(css).light['color-surface']).toBeUndefined()
  })

  it('një var() që nuk ekziston është gabim', () => {
    expect(() => readThemeTokens(css.replace('--nav: var(--background)', '--nav: var(--mungon)'))).toThrow(/mungon/)
  })
})
