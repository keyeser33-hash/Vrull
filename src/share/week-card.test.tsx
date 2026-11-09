import { i18nFor } from '@/i18n'
import { CARD, type DrawOp, type Measure, weekCardContent, weekCardLayout, type WeekCardSummary, wrap } from './week-card'

// Karta e javës (V43, SPEC §0.3c, bordi "Karta"): vetëm stërvitja, kurrë pesha, matjet, ushqimi ose uji;
// vendosja në 1080 × 1350 brenda kufijve, me titullin në dy rreshta dhe emrin pas numrit të madh.

/** Gjerësia e përafërt: 0,5 em për shkronjë (fonti nuk ngarkohet në jsdom). */
const measure: Measure = (text, font, spacing = 0) => {
  const size = Number(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? 16)
  return Array.from(text).length * size * 0.5 + spacing * Math.max(Array.from(text).length - 1, 0)
}

const SUMMARY: WeekCardSummary = {
  monday: '2026-11-16',
  programWeek: { blockName: 'Faza 1', blockWeeks: 4, week: 3, run: 1 },
  streak: 3,
  spare: null,
  goals: { training: { done: 4, target: 4, met: true }, complete: true },
  training: { workSets: 113, records: { count: 5, top: [{ exerciseId: 'squat', name: 'Squat', e1rmKg: 101.25, gainKg: 2.6 }] } },
}

/** Një përmbledhje e plotë, me peshën, ushqimin dhe ujin, si e jep `weekSummary`. */
const FULL = {
  ...SUMMARY,
  sunday: '2026-11-22',
  closed: true,
  goals: { ...SUMMARY.goals, food: { goal: 5, counted: 6, met: true, days: [] }, water: { goal: 5, counted: 5, met: true, days: [] } },
  trainingDays: [],
  training: { ...SUMMARY.training, sessions: 4, minutes: 246 },
  food: { averageKcal: 2870, averageProteinG: 168 },
  water: { averageMl: 3300 },
  weight: { averageKg: 88.4, changeKg: 0.4 },
  next: null,
}

const texts = (ops: DrawOp[]) => ops.flatMap((op) => (op.kind === 'text' ? [op.text] : []))

describe('karta e javës', () => {
  it('tekstet e bordit: java, titulli, 4/4, setet, rekordet, vargu dhe rekordi më i madh', () => {
    const content = weekCardContent(SUMMARY, i18nFor('sq'), { brand: 'Vrull', programme: 'Shortcut to Size' })
    expect(content).toMatchObject({
      range: '16–22 nëntor 2026',
      label: 'Faza 1 · Java 3',
      title: 'Java e plotë',
      big: '4/4',
      bigLabel: 'stërvitje',
      stats: [
        { value: '113', label: 'sete' },
        { value: '5', label: 'rekorde' },
        { value: '3', label: 'javë rresht' },
      ],
      footer: 'Shortcut to Size · Squat e1RM 101,3 kg',
    })
    const english = weekCardContent(SUMMARY, i18nFor('en'), { brand: 'Vrull', programme: 'Shortcut to Size' })
    expect(english).toMatchObject({ range: '16–22 November 2026', label: 'Phase 1 · Week 3', title: 'Complete week', bigLabel: 'workouts' })
    expect(english.stats.map((stat) => stat.label)).toEqual(['sets', 'records', 'weeks in a row'])
  })

  it('kurrë pesha, ushqimi ose uji, edhe kur përmbledhja i ka', () => {
    for (const lang of ['sq', 'en'] as const) {
      const content = weekCardContent(FULL, i18nFor(lang), { brand: 'Vrull', programme: null })
      const all = JSON.stringify(content)
      for (const hidden of ['88,4', '88.4', '2870', '2 870', '2,870', '168', '3,3', '3.3', 'kcal', 'proteinë', 'protein', 'L ']) expect(all).not.toContain(hidden)
    }
  })

  it('java jo e plotë me ditën rezervë: "Java 4 u mbyll" dhe 3+1', () => {
    const content = weekCardContent(
      { ...SUMMARY, programWeek: { ...SUMMARY.programWeek!, week: 4 }, goals: { training: { done: 3, target: 4, met: true }, complete: false }, spare: { blockId: 'b', run: 1, blockName: 'Faza 1', date: '2026-11-27' } },
      i18nFor('sq'),
      { brand: 'Vrull', programme: null },
    )
    expect(content).toMatchObject({ title: 'Java 4 u mbyll', big: '3+1', bigLabel: 'stërvitje dhe dita rezervë' })
    expect(content.footer).toBe('Squat e1RM 101,3 kg')
  })

  it('vendosja: çdo tekst brenda kartës, titulli në dy rreshta, emri pas numrit të madh', () => {
    const content = weekCardContent(SUMMARY, i18nFor('sq'), { brand: 'Vrull', programme: 'Shortcut to Size' })
    const ops = weekCardLayout(content, measure, 'sq')
    expect(ops[0]).toEqual({ kind: 'fill', x: 0, y: 0, w: CARD.width, h: CARD.height, color: 'background' })
    expect(ops.find((op) => op.kind === 'mark')).toMatchObject({ x: 68, y: 68, size: 108 })
    expect(texts(ops)).toEqual(['VRULL', '16–22 nëntor 2026', 'FAZA 1 · JAVA 3', 'JAVA E', 'PLOTË', 'Shortcut to Size · Squat e1RM 101,3 kg', '113', 'sete', '5', 'rekorde', '3', 'javë rresht', '4/4', 'stërvitje'])
    for (const op of ops) {
      if (op.kind !== 'text') continue
      const width = measure(op.text, op.font, op.letterSpacing)
      const left = op.align === 'right' ? op.x - width : op.x
      expect(left, op.text).toBeGreaterThanOrEqual(60)
      expect(left + width, op.text).toBeLessThanOrEqual(CARD.width - 60)
      expect(op.y, op.text).toBeGreaterThan(0)
      expect(op.y, op.text).toBeLessThan(CARD.height - 60)
    }
    const text = (value: string) => ops.find((op): op is Extract<DrawOp, { kind: 'text' }> => op.kind === 'text' && op.text === value)!
    // Numri në prush mbi vijën, emri pas tij në të njëjtën vijë bazë; titulli sipër, rreshti i dytë poshtë të parit.
    expect(text('4/4').color).toBe('ember')
    expect(text('stërvitje').x).toBeGreaterThan(text('4/4').x + measure('4/4', text('4/4').font))
    expect(text('PLOTË').y).toBeGreaterThan(text('JAVA E').y)
    expect(text('4/4').y).toBeGreaterThan(text('PLOTË').y)
    const rule = ops.find((op) => op.kind === 'fill' && op.color === 'border')!
    expect(rule.kind === 'fill' && rule.y).toBeGreaterThan(text('4/4').y)
    expect(text('113').y).toBeGreaterThan(rule.kind === 'fill' ? rule.y : 0)
  })

  it('një titull i gjatë zvogëlohet që të nxërë në dy rreshta; emri i gjatë pas numrit thyhet', () => {
    const content = weekCardContent(
      { ...SUMMARY, goals: { training: { done: 3, target: 4, met: true }, complete: false }, spare: { blockId: 'b', run: 1, blockName: 'Faza 1', date: null } },
      i18nFor('en'),
      { brand: 'Vrull', programme: 'A very long programme name that keeps going and going beyond the card' },
    )
    const ops = weekCardLayout({ ...content, title: 'Week 12 is done and dusted for good' }, measure, 'en')
    const lines = ops.filter((op) => op.kind === 'text' && op.font.includes('800') && op.color === 'foreground' && op.text === op.text.toUpperCase() && /WEEK|DONE|DUSTED|GOOD/.test(op.text))
    expect(lines.length).toBeLessThanOrEqual(2)
    expect(texts(ops).some((value) => value.endsWith('…'))).toBe(true)
    for (const op of ops) if (op.kind === 'text') expect(op.x + (op.align === 'right' ? 0 : measure(op.text, op.font, op.letterSpacing)), op.text).toBeLessThanOrEqual(CARD.width - 60)
  })

  it('wrap: fjalë pas fjale brenda gjerësisë', () => {
    expect(wrap('JAVA E PLOTË', 200, '800 40px X', measure)).toEqual(['JAVA E', 'PLOTË'])
    expect(wrap('NJË', 10, '800 40px X', measure)).toEqual(['NJË'])
  })
})

describe('shenja e kartës', () => {
  it('canvas-i vizaton të njëjtën shenjë si logo.tsx', async () => {
    const { render } = await import('@testing-library/react')
    const { VrullMark } = await import('@/components/ui/logo')
    const { VRULL_MARK } = await import('@/components/ui/vrull-mark')
    const { container } = render(<VrullMark />)
    expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe(`0 0 ${VRULL_MARK.size} ${VRULL_MARK.size}`)
    expect(container.querySelector('rect')?.getAttribute('rx')).toBe(String(VRULL_MARK.radius))
    expect(container.querySelector('path')?.getAttribute('d')).toBe(VRULL_MARK.path)
    expect(container.querySelector('path')?.getAttribute('stroke-width')).toBe(String(VRULL_MARK.stroke))
  })
})
