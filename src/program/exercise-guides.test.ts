import { describe, expect, it } from 'vitest'
import library from './library.json'
import { SHORTCUT_TO_SIZE } from './shortcut-to-size'
import { type ExerciseGuide, type GuideFile, guideProblems } from './exercise-guides'

const KNOWN = new Set([...SHORTCUT_TO_SIZE.exercises.map((exercise) => exercise.id), ...library.exercises.map((exercise) => exercise.id)])
const FILES = import.meta.glob<GuideFile>('./guides/*.json', { eager: true, import: 'default' })

const t = (sq: string, en: string) => ({ sq, en })
const list = (n: number, prefix: string, sources = ['nasm']) => ({
  items: Array.from({ length: n }, (_, i) => t(`${prefix} ${i + 1} në shqip.`, `${prefix} ${i + 1} in English.`)),
  sources,
})

function good(): ExerciseGuide {
  return {
    exercise: 'Bench Press',
    tempo: { downS: 2, upS: 1 },
    setup: list(4, 'Hapi'),
    steps: list(4, 'Lëvizja'),
    breathing: list(2, 'Fryma', ['wilk']),
    cues: { items: [t('Këmbët në dysheme', 'Feet on the floor'), t('Shpatullat pas', 'Shoulders back'), t('Bërrylat rreth 45°', 'Elbows about 45°')], sources: ['nasm'] },
    mistakes: list(3, 'Gabimi'),
    tips: [{ who: 'Jim Stoppani, PhD', text: t('Pesë pikat e kontaktit.', 'Five points of contact.'), sources: ['stoppani'] }],
    safety: list(2, 'Siguria'),
    history: null,
    sources: {
      nasm: { label: 'NASM, Barbell Bench Press', url: 'https://example.org/nasm', checked: '2026-11-15' },
      wilk: { label: 'Wilk, Zając dhe Tufano, 2021, Sports Medicine', url: 'https://example.org/wilk', checked: '2026-11-15' },
      stoppani: { label: 'Jim Stoppani, PhD, Bench Press Master Class', url: 'https://example.org/stoppani', checked: '2026-11-15' },
    },
  }
}

describe('kontrolli i një udhëzuesi (SPEC §0.3g)', () => {
  it('udhëzuesi i plotë nuk ka probleme', () => {
    expect(guideProblems(good(), KNOWN)).toEqual([])
  })

  it('ushtrimi duhet të jetë te Shortcut to Size ose te biblioteka', () => {
    expect(guideProblems({ ...good(), exercise: 'Ushtrimi im' }, KNOWN)).toContain('ushtrimi nuk njihet: Ushtrimi im')
  })

  it('çdo seksion ka burim, dhe çdo burim ekziston dhe përdoret', () => {
    const noSource = { ...good(), setup: { ...good().setup, sources: [] } }
    expect(guideProblems(noSource, KNOWN)).toContain('setup: pa burim')
    const unknown = { ...good(), steps: { ...good().steps, sources: ['ace'] } }
    expect(guideProblems(unknown, KNOWN)).toContain('steps: burimi nuk ekziston: ace')
    const unused = good()
    unused.sources.extra = { label: 'ACE, Chest Press', url: 'https://example.org/ace', checked: '2026-11-15' }
    expect(guideProblems(unused, KNOWN)).toContain('burimi nuk përdoret: extra')
  })

  it('burimet e ndaluara dhe lidhjet pa https refuzohen', () => {
    const g = good()
    g.sources.nasm = { ...g.sources.nasm, url: 'https://en.wikipedia.org/wiki/Bench_press' }
    g.sources.wilk = { ...g.sources.wilk, url: 'http://example.com/study' }
    const problems = guideProblems(g, KNOWN)
    expect(problems).toContain('nasm: burim i ndaluar (en.wikipedia.org)')
    expect(problems).toContain('wilk: lidhja duhet https')
  })

  it('sinjalet janë 3–6 dhe të shkurtra, që të hyjnë te seanca', () => {
    const few = { ...good(), cues: { items: good().cues.items.slice(0, 2), sources: ['nasm'] } }
    expect(guideProblems(few, KNOWN)).toContain('cues: 2 rreshta, lejohen 3–6')
    const long = good()
    long.cues.items[0] = t('Këmbët fort në dysheme dhe shtyje tokën gjatë gjithë setit', 'Feet on the floor')
    expect(guideProblems(long, KNOWN)).toContain('cues 1 sq: mbi 40 shenja')
  })

  it('teksti ka të dyja gjuhët, pa pikëçuditje dhe me shkronjë të madhe në fillim', () => {
    const g = good()
    g.setup.items[0] = t('hapi pa shkronjë të madhe.', '')
    g.mistakes.items[1] = t('Kujdes!', 'Careful!')
    const problems = guideProblems(g, KNOWN)
    expect(problems).toContain('setup 1 sq: nis me shkronjë të vogël')
    expect(problems).toContain('setup 1 en: bosh')
    expect(problems).toContain('mistakes 2 sq: pikëçuditje')
  })

  it('këshilla ka emrin e ekspertit; tempo mungon vetëm te mbajtjet', () => {
    const g = good()
    g.tips[0] = { ...g.tips[0], who: ' ' }
    expect(guideProblems(g, KNOWN)).toContain('tips 1: pa emrin e ekspertit')
    expect(guideProblems({ ...good(), tempo: null }, KNOWN)).toEqual([])
    expect(guideProblems({ ...good(), tempo: { downS: 0, upS: 1 } }, KNOWN)).toContain('tempo: jashtë kufijve')
  })
})

describe('skedarët e udhëzuesve', () => {
  const guides = Object.values(FILES).flatMap((file) => file.guides)

  it('çdo udhëzues kalon kontrollin', () => {
    for (const guide of guides) expect(guideProblems(guide, KNOWN), guide.exercise).toEqual([])
  })

  it('asnjë ushtrim nuk ka dy udhëzues', () => {
    const names = guides.map((guide) => guide.exercise)
    expect(names.length).toBe(new Set(names).size)
  })
})
