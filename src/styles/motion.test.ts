// @vitest-environment node
/// <reference types="node" />
// CSS-i lexohet nga disku: me `css: false` te Vitest, `?raw` i një .css kthehet bosh.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buttonVariants } from '@/components/ui/button-variants'

// Lëvizja e 0.23 (SPEC §0.3c, E2-23; DESIGN.md › Lëvizja): shtypja 100 ms pa kërcim, numrat 200 ms me
// 40 ms mes shifrave, dhe me "lëvizje të reduktuar" asgjë nuk lëviz: vetëm zbehje 120 ms.

const css = readFileSync(new URL('./globals.css', import.meta.url), 'utf8')

/** Blloku që nis me `start` (me kllapat e veta), për të kontrolluar shtresën dhe media query-n. */
function block(source: string, start: string) {
  const at = source.indexOf(start)
  expect(at, start).toBeGreaterThanOrEqual(0)
  let depth = 0
  for (let index = source.indexOf('{', at); index < source.length; index++) {
    if (source[index] === '{') depth++
    if (source[index] === '}' && --depth === 0) return source.slice(at, index + 1)
  }
  throw new Error(`Blloku ${start} nuk mbyllet`)
}

const reduced = block(block(css, '@layer base'), '@media (prefers-reduced-motion: reduce)')

describe('lëvizja', () => {
  it('lëvizja e reduktuar vlen për çdo element: animacionet mbarojnë menjëherë dhe pa vonesë, tranzicionet vetëm opacity 120 ms', () => {
    const universal = block(reduced, '*,')
    expect(universal).toMatch(/\*::before,\s*\*::after/)
    expect(universal).toContain('animation-duration: 0.01ms !important')
    expect(universal).toContain('animation-delay: 0s !important')
    expect(universal).toContain('animation-iteration-count: 1 !important')
    expect(universal).toContain('transition-duration: 120ms !important')
    expect(universal).toContain('transition-property: opacity !important')
  })

  it('RollingNumber: 200 ms ease-out, 40 ms mes shifrave; me lëvizje të reduktuar vetëm zbehje 120 ms', () => {
    const components = block(css, '@layer components')
    expect(block(components, '.roll-digit {')).toContain('animation: roll-up 200ms ease-out both')
    expect(block(components, '.roll-digit {')).toContain('animation-delay: calc(var(--roll-i, 0) * 40ms)')
    // Në të njëjtën shtresë me rregullin e `*`, që `!important` i klasës ta mposhtë.
    expect(block(reduced, '.roll-digit {')).toContain('animation: roll-fade 120ms ease-out both !important')
    expect(block(reduced, '.roll-digit::before {')).toContain('content: none !important')
    const fade = block(css, '@keyframes roll-fade')
    expect(fade).toContain('opacity')
    expect(fade).not.toContain('transform')
  })

  it('shtypja e butonit: 100 ms ease-out pa kërcim, pa shkallëzim me lëvizje të reduktuar', () => {
    const classes = buttonVariants({ variant: 'primary' }).split(' ')
    expect(classes).toEqual(expect.arrayContaining(['transition-transform', 'duration-100', 'ease-out', 'motion-safe:active:scale-[0.97]']))
    expect(classes).not.toContain('ease-vrull')
    expect(classes).not.toContain('active:scale-[0.97]')
  })

  it('asnjë prekje nuk shkallëzohet pa `motion-safe:`', () => {
    const root = fileURLToPath(new URL('..', import.meta.url))
    const found: string[] = []
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry)
        if (statSync(full).isDirectory()) walk(full)
        else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) && /(?<!motion-safe:)active:scale-/.test(readFileSync(full, 'utf8'))) found.push(full)
      }
    }
    walk(root)
    expect(found).toEqual([])
  })
})
