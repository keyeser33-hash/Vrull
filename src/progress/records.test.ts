import type { HistorySet } from '@/program/loads'
import { isRecord, recordHint, sessionBests, sessionSetRecords, setRecord } from './records'

// Rekordi te seanca (SPEC §0.3a, §6; V2-E1-07): pragu me peshën e zgjedhur, edhe kur çdo set i
// intervalit jep rekord, rekordi i setit në moment dhe rekordet e seancës (si te historiku, E1-15).

const NOW = new Date('2026-11-08T18:00:00.000Z')
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString()

let counter = 0
function set(values: Partial<HistorySet>): HistorySet {
  counter += 1
  return {
    id: `set-${counter}`,
    exerciseId: 'bench',
    sessionId: 'java-1',
    run: 1,
    blockPosition: 1,
    blockName: 'Faza 1',
    blockWeeks: 4,
    week: 1,
    setNumber: 1,
    weightKg: 60,
    reps: 13,
    rir: null,
    isWarmup: false,
    loggedAt: daysAgo(7),
    ...values,
  }
}

describe('pragu i rekordit te ekrani i setit', () => {
  const java1 = [set({})] // 60 × 13 → e1RM 86,0

  it('Bench Press 62,5 kg (9–11): "12 përsëritje të japin rekord të ri: e1RM 87,5 kg"', () => {
    const hint = recordHint(java1, { exerciseId: 'bench', weightKg: 62.5, min: 9, max: 11 })
    expect(hint).toMatchObject({ kind: 'reps', reps: 12 })
    expect(hint?.e1rmKg).toBeCloseTo(87.5, 5)
  })

  it('kur pragu bie nën minimumin, çdo set i intervalit jep rekord: e1RM me minimumin', () => {
    // 70 kg e kalojnë 86,0 me 7 përsëritje, para intervalit 9–11.
    const hint = recordHint(java1, { exerciseId: 'bench', weightKg: 70, min: 9, max: 11 })
    expect(hint).toMatchObject({ kind: 'any', reps: 9 })
    expect(hint?.e1rmKg).toBeCloseTo(91, 5)
  })

  it('më shumë se 2 përsëritje mbi kufirin e sipërm: asgjë', () => {
    expect(recordHint(java1, { exerciseId: 'bench', weightKg: 60, min: 9, max: 11 })).toBeNull()
  })

  it('pa e1RM të mëparshme, pa peshë ose me përsëritje të lira: asgjë', () => {
    expect(recordHint([], { exerciseId: 'bench', weightKg: 62.5, min: 9, max: 11 })).toBeNull()
    expect(recordHint(java1, { exerciseId: 'bench', weightKg: 0, min: 9, max: 11 })).toBeNull()
    expect(recordHint(java1, { exerciseId: 'bench', weightKg: 62.5, min: 0, max: null })).toBeNull()
  })

  it('pulpat mbi 15 përsëritje nuk japin e1RM: as "çdo set" kur intervali kalon 15', () => {
    const calves = [set({ exerciseId: 'calf', weightKg: 40, reps: 12 })] // e1RM 56
    expect(recordHint(calves, { exerciseId: 'calf', weightKg: 70, min: 25, max: 30 })).toBeNull()
    expect(recordHint(calves, { exerciseId: 'calf', weightKg: 70, min: 15, max: 20 })).toBeNull()
    expect(recordHint(calves, { exerciseId: 'calf', weightKg: 70, min: 10, max: 14 })).toMatchObject({ kind: 'any', reps: 10 })
  })

  it('pa kufi të sipërm, kufiri i poshtëm vlen si i sipërm', () => {
    expect(recordHint(java1, { exerciseId: 'bench', weightKg: 62.5, min: 10, max: null })).toMatchObject({ kind: 'reps', reps: 12 })
  })
})

describe('rekordet e seancës', () => {
  const java1 = [set({}), set({ setNumber: 2, reps: 12 })]
  const today = (values: Partial<HistorySet>) => set({ sessionId: 'java-2', week: 2, loggedAt: daysAgo(0), weightKg: 62.5, ...values })

  it('Bench Press: seti 1 62,5 × 12 → e1RM 87,5, +1,5 nga rekordi i kaluar', () => {
    const sets = [today({ setNumber: 1, reps: 12 }), today({ setNumber: 2, reps: 10 }), today({ setNumber: 3, reps: 9 })]
    const [record, ...rest] = sessionBests([...java1, ...sets], 'java-2')
    expect(rest).toEqual([])
    expect(record).toMatchObject({ exerciseId: 'bench', setId: sets[0].id })
    expect(record.e1rmKg).toBeCloseTo(87.5, 5)
    expect(record.previousBestKg).toBeCloseTo(86, 5)
    expect(record.gainKg).toBeCloseTo(1.5, 5)
  })

  it('vlen seti më i mirë i seancës, kundrejt historisë para saj', () => {
    const sets = [today({ setNumber: 1, reps: 12 }), today({ setNumber: 2, weightKg: 65, reps: 12 })]
    const [record] = sessionBests([...java1, ...sets], 'java-2')
    expect(record.setId).toBe(sets[1].id)
    expect(record.previousBestKg).toBeCloseTo(86, 5)
  })

  it('ushtrimi i parë herë nuk jep rekord; ngrohja dhe një seancë pa e1RM më të lartë as', () => {
    const fly = today({ exerciseId: 'fly', weightKg: 12, reps: 11 })
    const warmup = today({ exerciseId: 'bench', weightKg: 80, reps: 10, isWarmup: true })
    const weaker = today({ setNumber: 1, reps: 9 })
    expect(sessionBests([...java1, fly, warmup, weaker], 'java-2')).toEqual([])
  })

  it('pa e1RM të mëparshme (pulpat me 30 përsëritje) s\'ka rekord për të kaluar', () => {
    const calves = [set({ exerciseId: 'calf', weightKg: 70, reps: 30 }), today({ exerciseId: 'calf', weightKg: 70, reps: 15 })]
    expect(sessionBests(calves, 'java-2')).toEqual([])
    expect(isRecord(calves[1], calves)).toBe(false)
    expect(isRecord(today({ reps: 12 }), java1)).toBe(true)
  })

  it('rekordi i setit në moment: e1RM-ja, ose pesha më e madhe për ato përsëritje', () => {
    const record = setRecord(today({ reps: 12 }), java1)
    expect(record).toMatchObject({ kind: 'e1rm' })
    expect(record?.kind === 'e1rm' && record.gainKg).toBeCloseTo(1.5, 5)
    // 80 × 3 jep 88: 62,5 × 12 (87,5) nuk e kalon e1RM-në, por asnjë set s'kishte 12 përsëritje me 62,5 kg.
    const heavy = [set({ weightKg: 80, reps: 3 })]
    expect(setRecord(today({ reps: 12 }), heavy)).toEqual({ kind: 'weight', weightKg: 62.5, reps: 12 })
    expect(setRecord(today({ weightKg: 60, reps: 10 }), java1)).toBeNull()
  })

  it('disa rekorde: më i madhi i pari', () => {
    const fly = [set({ exerciseId: 'fly', weightKg: 10, reps: 11 }), today({ exerciseId: 'fly', weightKg: 14, reps: 11 })]
    const records = sessionBests([...java1, ...fly, today({ reps: 12 })], 'java-2')
    expect(records.map((record) => record.exerciseId)).toEqual(['fly', 'bench'])
  })
})

describe('rekordi i çdo seti të seancës në kohën e vet (çipat, pushimi dhe banderola, 0.23)', () => {
  const java1 = [set({})] // 60 × 13 → e1RM 86,0
  const minute = (n: number) => new Date(NOW.getTime() + n * 60_000).toISOString()
  const today = (n: number, values: Partial<HistorySet>) => set({ sessionId: 'java-2', week: 2, setNumber: n, weightKg: 62.5, loggedAt: minute(n), ...values })

  it('seti 1 mbetet rekord edhe kur seti 2 e kalon; seti më i dobët jo', () => {
    const sets = [today(1, { reps: 12 }), today(2, { reps: 13 }), today(3, { reps: 10, weightKg: 60 })]
    const records = sessionSetRecords([...java1, ...sets], 'java-2')
    expect([...records.keys()].sort()).toEqual([sets[0].id, sets[1].id].sort())
    const first = records.get(sets[0].id)
    expect(first?.kind === 'e1rm' && first.gainKg).toBeCloseTo(1.5, 5)
    // Seti 2 krahasohet me setin 1 (87,5), jo vetëm me Javën 1.
    const second = records.get(sets[1].id)
    expect(second?.kind === 'e1rm' && second.previousBestKg).toBeCloseTo(87.5, 5)
  })

  it('pulpat me 30 përsëritje (pa e1RM): pesha më e madhe për ato përsëritje, si seti i sapo ruajtur', () => {
    const calves = [set({ exerciseId: 'calf', weightKg: 35, reps: 30 })]
    const heavier = today(1, { exerciseId: 'calf', weightKg: 40, reps: 30 })
    const same = today(2, { exerciseId: 'calf', weightKg: 40, reps: 28 })
    const records = sessionSetRecords([...calves, heavier, same], 'java-2')
    expect(records.get(heavier.id)).toEqual({ kind: 'weight', weightKg: 40, reps: 30 })
    expect(records.get(heavier.id)).toEqual(setRecord(heavier, calves))
    expect(records.has(same.id)).toBe(false)
  })

  it('vetëm setet e seancës; ngrohja dhe ushtrimi i parë herë nuk janë rekord', () => {
    const sets = [today(1, { isWarmup: true, weightKg: 80, reps: 10 }), today(2, { exerciseId: 'fly', weightKg: 12, reps: 11 })]
    expect(sessionSetRecords([...java1, ...sets], 'java-2').size).toBe(0)
    expect(sessionSetRecords([...java1, today(1, { reps: 12 })], 'java-1').size).toBe(0)
  })
})
