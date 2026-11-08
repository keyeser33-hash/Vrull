// @vitest-environment node
import { checkSource, findViolations, LEGACY_FILES } from '../../scripts/check-design.mjs'

const NEW = 'src/components/ui/new-thing.tsx'
const rules = (path: string, text: string) => checkSource(path, text).map((violation) => violation.split(': ')[0].split(' ').slice(1).join(' '))

describe('roja e dizajnit të Vrullit', () => {
  it('asnjë shkelje në repo', () => {
    expect(findViolations()).toEqual([])
  })

  it('ngjyrat e shkruara: hex, rgb(), hsl() dhe klasat arbitrare', () => {
    expect(rules(NEW, `<span style={{ color: '#FF5B2E' }} />`)).toEqual(['ngjyrë hex'])
    expect(rules(NEW, `const shade = 'rgba(0, 0, 0, 0.5)'`)).toEqual(['rgb()/hsl()'])
    expect(rules(NEW, `className="bg-[#FF5B2E]"`)).toEqual(['ngjyrë hex', 'ngjyrë arbitrare Tailwind'])
    expect(rules(NEW, `className="text-[color:var(--ember)]"`)).toEqual(['ngjyrë arbitrare Tailwind'])
  })

  it('globals.css është i vetmi vend me ngjyra; provat janë jashtë', () => {
    expect(checkSource('src/styles/globals.css', '--ember: #FF5B2E;')).toEqual([])
    expect(checkSource('src/lib/contrast.test.ts', "contrastRatio('#000000', '#FFFFFF')")).toEqual([])
  })

  it('ngjyrat e paletës së Tailwind-it nuk janë tokena', () => {
    expect(rules(NEW, 'className="text-white"')).toEqual(['ngjyrë jashtë tokenave'])
    expect(rules(NEW, 'className="bg-orange-500 border-zinc-800"')).toEqual(['ngjyrë jashtë tokenave'])
    expect(rules(NEW, 'className="bg-transparent text-current"')).toEqual([])
  })

  it('prushi si tekst ose vijë e hollë është ember-text; mbushja mbetet ember', () => {
    expect(rules(NEW, 'className="text-ember"')).toEqual(['prushi si tekst ose vijë'])
    expect(rules(NEW, 'className="border-2 border-ember"')).toEqual(['prushi si tekst ose vijë'])
    expect(rules(NEW, 'className="stroke-ember ring-ember"')).toEqual(['prushi si tekst ose vijë'])
    expect(rules(NEW, 'className="bg-ember fill-ember text-on-ember"')).toEqual([])
    expect(rules(NEW, 'className="text-ember-text border-ember-text"')).toEqual([])
  })

  it('mbi prush dhe rërë teksti është on-ember, kurrë i bardhë ose foreground', () => {
    expect(rules(NEW, "primary: 'bg-ember text-foreground'")).toEqual(['tekst mbi prush'])
    expect(rules(NEW, "tired: 'bg-sand text-background'")).toEqual(['tekst mbi prush'])
    expect(rules(NEW, "primary: 'bg-ember text-on-ember text-2xl'")).toEqual([])
    // Mbushjet e tejdukshme (p.sh. volumi) nuk janë sfond teksti.
    expect(rules(NEW, "'bg-ember/30 text-foreground'")).toEqual([])
  })

  it('pa variante teme: ngjyra ndryshon vetëm përmes tokenave', () => {
    expect(rules(NEW, 'className="bg-surface dark:bg-surface-2"')).toEqual(['variant teme'])
    expect(rules(NEW, 'className="oled:border"')).toEqual(['variant teme'])
  })

  it('aliaset e v1 (Omal) lejohen vetëm te skedarët e v1 që presin rishikimin', () => {
    expect(rules(NEW, 'className="bg-card text-panel-foreground"')).toEqual(['alias i v1'])
    expect(rules(NEW, "const tone = { token: '--brand', alpha: 1 }")).toEqual(['alias i v1'])
    expect(rules(NEW, 'className="shadow-[inset_0_2px_0_var(--brand)]"')).toEqual(['alias i v1'])
    expect(rules(NEW, 'className="outline-ring bg-muted"')).toEqual(['alias i v1'])
    expect(rules(NEW, '<Button variant="brand">Ruaj</Button>')).toEqual(['alias i v1'])
    expect(rules(NEW, "buttonVariants({ variant: 'on-panel' })")).toEqual(['alias i v1'])
    expect(rules(NEW, 'className="text-muted-foreground bg-surface-2 border-border"')).toEqual([])
    const legacy = [...LEGACY_FILES][0]
    expect(checkSource(legacy, 'className="bg-card text-panel-foreground"')).toEqual([])
  })

  it('tekst amber mbetet i ndaluar edhe te skedarët e v1', () => {
    const legacy = [...LEGACY_FILES][0]
    expect(rules(legacy, 'className="text-brand"')).toEqual(['tekst amber (text-brand)'])
  })
})
