import type { HistorySet } from './loads'
import type { LoggedSet } from './next-set'
import { setTable } from './set-table'
import type { PlannedSlot } from './types'

// Tabela e seteve të seancës (SPEC §0.3g, V58; bordet "Seanca · seti 1" dhe "· seti 3"): një rresht për
// çdo set të slotit, me "Herën e kaluar" (seti me të njëjtin numër te referenca e §7), setin e ruajtur,
// rreshtin aktiv dhe synimin e seteve që vijnë. Teknika del vetëm te seti i fundit.

const bench: PlannedSlot = {
  slotId: 'bench',
  position: 0,
  exerciseId: 'bench-ex',
  sets: 4,
  restSeconds: 90,
  target: { kind: 'reps', min: 6, max: 8, beyond: false },
  technique: { type: 'drop_set' },
}

const at = { exerciseId: 'bench-ex', blockPosition: 2, week: 3, sessionId: 'today' }

/** Faza 1 · Java 3 (blloku 1): Bench Press 60 × 11, 10, 9, 9; java tjetër e tij (Java 2) 57,5 × 12. */
const history: HistorySet[] = [
  ...[11, 10, 9, 9].map((reps, index) => past({ setNumber: index + 1, reps, weightKg: 60, sessionId: 'phase1-w3', blockPosition: 1, week: 3, loggedAt: `2026-10-12T17:0${index}:00Z` })),
  past({ setNumber: 1, reps: 12, weightKg: 57.5, sessionId: 'phase1-w2', blockPosition: 1, week: 2, loggedAt: '2026-10-05T17:00:00Z' }),
]

function past(values: Partial<HistorySet> & Pick<HistorySet, 'setNumber' | 'reps' | 'weightKg' | 'sessionId' | 'loggedAt'>): HistorySet {
  return {
    id: `${values.sessionId}-${values.setNumber}`,
    exerciseId: 'bench-ex',
    run: 1,
    blockPosition: 1,
    blockName: 'Faza 1',
    blockWeeks: 4,
    week: 3,
    rir: null,
    isWarmup: false,
    ...values,
  }
}

const logged = (setNumber: number, values: Partial<LoggedSet> = {}): LoggedSet => ({
  id: `today-${setNumber}`,
  slotId: 'bench',
  setNumber,
  weightKg: 62.5,
  reps: 8,
  seconds: null,
  rir: null,
  technique: 'none',
  segments: [],
  ...values,
})

describe('tabela e seteve', () => {
  it('seti 1: rreshti aktiv, "Herën e kaluar" për çdo numër, synimi me peshën e javës, teknika te i fundit', () => {
    const rows = setTable({ slot: bench, sets: [], active: 1, segment: false, weekWeightKg: 62.5, history, at })
    expect(rows.map((row) => [row.setNumber, row.state, row.weightKg, row.technique])).toEqual([
      [1, 'active', 62.5, null],
      [2, 'upcoming', 62.5, null],
      [3, 'upcoming', 62.5, null],
      [4, 'upcoming', 62.5, 'drop_set'],
    ])
    expect(rows.map((row) => row.previous && [row.previous.weightKg, row.previous.reps])).toEqual([
      [60, 11],
      [60, 10],
      [60, 9],
      [60, 9],
    ])
    expect(rows.every((row) => row.saved === null && !row.segment)).toBe(true)
  })

  it('mes setesh: të ruajturit me vlerën e tyre, i treti aktiv, ata që vijnë me peshën e setit të fundit të ruajtur', () => {
    const sets = [logged(1, { reps: 8 }), logged(2, { weightKg: 65, reps: 7 }), { ...logged(1), slotId: 'tjeter', id: 'other' }]
    const rows = setTable({ slot: bench, sets, active: 3, segment: false, weekWeightKg: 62.5, history, at })
    expect(rows.map((row) => [row.setNumber, row.state, row.saved?.id ?? null, row.weightKg])).toEqual([
      [1, 'saved', 'today-1', 62.5],
      [2, 'saved', 'today-2', 65],
      [3, 'active', null, 65],
      [4, 'upcoming', null, 65],
    ])
  })

  it('segmenti që pret: seti i fundit është i ruajtur dhe aktiv njëherësh', () => {
    const sets = [1, 2, 3].map((number) => logged(number)).concat(logged(4, { technique: 'drop_set' }))
    const rows = setTable({ slot: bench, sets, active: 4, segment: true, weekWeightKg: 62.5, history, at })
    expect(rows[3]).toMatchObject({ state: 'active', segment: true, saved: { id: 'today-4' }, technique: 'drop_set' })
    expect(rows.slice(0, 3).every((row) => row.state === 'saved')).toBe(true)
  })

  it('ushtrimi i bërë (ose që shihet pa u bërë tani): asnjë rresht aktiv', () => {
    const sets = [1, 2, 3, 4].map((number) => logged(number))
    expect(setTable({ slot: bench, sets, active: null, segment: false, weekWeightKg: 62.5, history, at }).map((row) => row.state)).toEqual(['saved', 'saved', 'saved', 'saved'])
    expect(setTable({ slot: bench, sets: [], active: null, segment: false, weekWeightKg: 62.5, history, at }).map((row) => row.state)).toEqual([
      'upcoming',
      'upcoming',
      'upcoming',
      'upcoming',
    ])
  })

  it('një set mbi recetën (p.sh. nga një telefon tjetër) del si rresht më vete; teknika mbetet te seti i recetës', () => {
    const sets = [1, 2, 3, 4, 5].map((number) => logged(number))
    const rows = setTable({ slot: bench, sets, active: null, segment: false, weekWeightKg: 62.5, history, at })
    expect(rows.map((row) => [row.setNumber, row.technique])).toEqual([
      [1, null],
      [2, null],
      [3, null],
      [4, 'drop_set'],
      [5, null],
    ])
  })

  it('pa referencë (ushtrimi i parë herë) "Herën e kaluar" mbetet bosh; pa peshë jave synimi s\'ka peshë', () => {
    const rows = setTable({ slot: bench, sets: [], active: 1, segment: false, weekWeightKg: null, history: [], at })
    expect(rows.every((row) => row.previous === null && row.weightKg === null)).toBe(true)
  })

  it('referenca pa të njëjtin numër (më pak sete herën e kaluar) merr setin e fundit të asaj seance', () => {
    const fewer = history.filter((set) => set.sessionId === 'phase1-w2')
    const rows = setTable({ slot: bench, sets: [], active: 1, segment: false, weekWeightKg: 62.5, history: fewer, at: { ...at, week: 2 } })
    expect(rows.map((row) => row.previous?.reps)).toEqual([12, 12, 12, 12])
  })

  it('rest-pause dhe "deri në dështim" dalin te seti i fundit; pa teknikë asgjë', () => {
    const rest = setTable({ slot: { ...bench, technique: { type: 'rest_pause', restSeconds: 15 } }, sets: [], active: 1, segment: false, weekWeightKg: 60, history, at })
    expect(rest.at(-1)?.technique).toBe('rest_pause')
    const failure = setTable({ slot: { ...bench, technique: { type: 'to_failure' } }, sets: [], active: 1, segment: false, weekWeightKg: 60, history, at })
    expect(failure.at(-1)?.technique).toBe('to_failure')
    const none = setTable({ slot: { ...bench, technique: { type: 'none' } }, sets: [], active: 1, segment: false, weekWeightKg: 60, history, at })
    expect(none.every((row) => row.technique === null)).toBe(true)
  })
})
