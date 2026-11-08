import {
  currentOneRm,
  dropWeight,
  e1rm,
  e1rmRecord,
  type HistorySet,
  linearWeight,
  percentWeight,
  personalRecords,
  recordThreshold,
  reference,
  roundDown,
  suggestedWeight,
  suggestionFor,
  weightFor,
  weightStep,
} from './loads'

const NOW = new Date('2026-12-30T18:00:00.000Z')
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString()

let counter = 0
function set(values: Partial<HistorySet>): HistorySet {
  counter += 1
  return {
    id: `set-${counter}`,
    exerciseId: 'bench',
    sessionId: 's1',
    run: 1,
    blockPosition: 1,
    blockName: 'Faza 1',
    blockWeeks: 4,
    week: 1,
    setNumber: 1,
    weightKg: 50,
    reps: 10,
    rir: null,
    isWarmup: false,
    loggedAt: daysAgo(1),
    ...values,
  }
}

describe('e1RM me Epley (§7)', () => {
  it('pesha × (1 + (përsëritjet + RIR) / 30)', () => {
    expect(e1rm(60, 10)).toBeCloseTo(80)
    expect(e1rm(47.5, 12, 3)).toBeCloseTo(71.25)
  })

  it('vetëm sete me peshë dhe 1–15 përsëritje', () => {
    expect(e1rm(100, 1)).toBeCloseTo(103.33, 2)
    expect(e1rm(60, 15)).toBeCloseTo(90)
    expect(e1rm(60, 16)).toBeNull()
    expect(e1rm(60, 0)).toBeNull()
    expect(e1rm(0, 10)).toBeNull()
    expect(e1rm(null, 10)).toBeNull()
  })
})

describe('1RM aktuale', () => {
  it('më e larta nga 28 ditët e fundit, pa setet e ngrohjes dhe pa ushtrimet e tjera', () => {
    const history = [
      set({ weightKg: 60, reps: 10, loggedAt: daysAgo(3) }), // 80
      set({ weightKg: 70, reps: 6, loggedAt: daysAgo(10) }), // 84
      set({ weightKg: 90, reps: 10, loggedAt: daysAgo(29) }), // 120, por jashtë 28 ditëve
      set({ weightKg: 80, reps: 10, isWarmup: true, loggedAt: daysAgo(2) }),
      set({ exerciseId: 'squat', weightKg: 100, reps: 10, loggedAt: daysAgo(2) }),
    ]
    expect(currentOneRm(history, 'bench', NOW)).toBeCloseTo(84)
  })

  it('pa asgjë në 28 ditë: e fundit e njohur', () => {
    const history = [set({ weightKg: 60, reps: 10, loggedAt: daysAgo(60) }), set({ weightKg: 55, reps: 10, loggedAt: daysAgo(40) })]
    expect(currentOneRm(history, 'bench', NOW)).toBeCloseTo(55 * (4 / 3))
    expect(currentOneRm([], 'bench', NOW)).toBeNull()
  })

  it('vlera me dorë vlen derisa një seancë e re të japë më shumë', () => {
    const before = set({ weightKg: 90, reps: 10, loggedAt: daysAgo(5) }) // 120, para vlerës me dorë
    const override = { oneRmKg: 100, setAt: daysAgo(4) }
    expect(currentOneRm([before], 'bench', NOW, override)).toBe(100)
    const lower = set({ weightKg: 60, reps: 10, loggedAt: daysAgo(2) }) // 80
    expect(currentOneRm([before, lower], 'bench', NOW, override)).toBe(100)
    const higher = set({ weightKg: 80, reps: 10, loggedAt: daysAgo(1) }) // 106,67
    expect(currentOneRm([before, lower, higher], 'bench', NOW, override)).toBeCloseTo(106.67, 2)
  })
})

describe('pesha e sugjeruar', () => {
  it('1RM / (1 + kufiri i sipërm / 30), e rrumbullakosur poshtë sipas hapit', () => {
    // 80 / 1,5 = 53,33 → 52,5 me hap 2,5; 52 me hap 2; 50 me hap 5
    expect(suggestedWeight(80, 15, 2.5)).toBe(52.5)
    expect(suggestedWeight(80, 15, 2)).toBe(52)
    expect(suggestedWeight(80, 15, 5)).toBe(50)
    expect(suggestedWeight(100, 10, 0.5)).toBe(75)
  })

  it('rrumbullakimi nuk humbet hapin nga gabimet e numrave dhjetorë', () => {
    expect(roundDown(7.5, 2.5)).toBe(7.5)
    expect(roundDown(0.3, 0.1)).toBe(0.3)
    expect(roundDown(47.49, 2.5)).toBe(45)
  })

  it('hapi sipas pajisjes, me 2,5 kg kur pajisja s\'ka hap', () => {
    const steps = { barbell: 2.5, dumbbell: 2, cable: 5, machine: 5 }
    expect(weightStep('dumbbell', steps)).toBe(2)
    expect(weightStep('cable', steps)).toBe(5)
    expect(weightStep('band', steps)).toBe(2.5)
  })

  it('pa cilësim: hapat e §7 (shufër 2,5, dumbbell 2, kabëll dhe makineri 5)', () => {
    expect([weightStep('barbell', {}), weightStep('dumbbell', {}), weightStep('cable', {}), weightStep('machine', {})]).toEqual([2.5, 2, 5, 5])
  })
})

describe('referenca e fazës së kaluar', () => {
  const java0 = { blockPosition: 0, blockName: 'Java 0', blockWeeks: 1, week: 1, sessionId: 'j0' }
  const history = [
    set({ ...java0, setNumber: 1, weightKg: 45, reps: 13, loggedAt: daysAgo(20) }),
    set({ ...java0, setNumber: 2, weightKg: 47.5, reps: 12, loggedAt: daysAgo(20) }),
    set({ blockPosition: 1, week: 1, sessionId: 'f1', setNumber: 1, weightKg: 50, reps: 14, loggedAt: daysAgo(10) }),
    set({ blockPosition: 1, week: 2, sessionId: 'f2', setNumber: 1, weightKg: 55, reps: 10, loggedAt: daysAgo(3) }),
  ]

  it('e njëjta javë dhe i njëjti set te blloku i mëparshëm', () => {
    expect(reference(history, { exerciseId: 'bench', blockPosition: 1, week: 1, setNumber: 2 })).toEqual({
      kind: 'previous_block',
      blockName: 'Java 0',
      blockWeeks: 1,
      week: 1,
      setNumber: 2,
      weightKg: 47.5,
      reps: 12,
    })
  })

  it('seti i parë kundrejt setit të parë', () => {
    expect(reference(history, { exerciseId: 'bench', blockPosition: 1, week: 1, setNumber: 1 })).toMatchObject({ setNumber: 1, weightKg: 45, reps: 13 })
  })

  it('kur blloku i mëparshëm ka më pak sete, seti i fundit i tij', () => {
    expect(reference(history, { exerciseId: 'bench', blockPosition: 1, week: 1, setNumber: 4 })).toMatchObject({ setNumber: 2, weightKg: 47.5 })
  })

  it('pa të njëjtën javë te blloku i mëparshëm: herën e fundit, jo seanca e tanishme', () => {
    expect(reference(history, { exerciseId: 'bench', blockPosition: 1, week: 3, setNumber: 1, sessionId: 'f3' })).toMatchObject({
      kind: 'last_time',
      week: 2,
      weightKg: 55,
      reps: 10,
    })
    expect(reference(history, { exerciseId: 'bench', blockPosition: 1, week: 2, setNumber: 1, sessionId: 'f2' })).toMatchObject({
      kind: 'last_time',
      week: 1,
      weightKg: 50,
    })
    expect(reference(history, { exerciseId: 'squat', blockPosition: 1, week: 1, setNumber: 1 })).toBeNull()
  })
})

describe('pesha e drop set-it', () => {
  const at = { exerciseId: 'bench', run: 1, blockPosition: 1 }

  it('pesha e javës 1 të bllokut për këtë ushtrim', () => {
    const history = [
      set({ week: 1, setNumber: 1, weightKg: 45, run: 2 }),
      set({ week: 1, setNumber: 1, weightKg: 20, isWarmup: true }),
      set({ week: 1, setNumber: 1, weightKg: 50 }),
      set({ week: 1, setNumber: 2, weightKg: 50 }),
      set({ week: 2, setNumber: 1, weightKg: 55 }),
      set({ week: 1, setNumber: 1, weightKg: 40, blockPosition: 0 }),
    ]
    expect(dropWeight(history, at, 60, {}, 2.5)).toBe(50)
  })

  it('me përqindje: pjesë e peshës së setit, poshtë sipas hapit', () => {
    expect(dropWeight([], at, 60, { percent: 72 }, 2.5)).toBe(42.5)
  })

  it('pa javën 1 në histori: pa sugjerim', () => {
    expect(dropWeight([set({ week: 2 })], at, 60, {}, 2.5)).toBeNull()
  })
})

describe('rekordet personale', () => {
  const history = [set({ weightKg: 50, reps: 12 }), set({ weightKg: 55, reps: 8 })]

  it('pesha më e madhe për këtë numër përsëritjesh ose më shumë', () => {
    expect(personalRecords(set({ weightKg: 52.5, reps: 12 }), history).weightForReps).toBe(true)
    expect(personalRecords(set({ weightKg: 52.5, reps: 10 }), history).weightForReps).toBe(true)
    expect(personalRecords(set({ weightKg: 50, reps: 10 }), history).weightForReps).toBe(false)
    expect(personalRecords(set({ weightKg: 55, reps: 8 }), history).weightForReps).toBe(false)
  })

  it('e1RM më e lartë se çdo set i mëparshëm', () => {
    // 50 × 12 → 70; 55 × 8 → 69,67; 60 × 6 → 72
    expect(personalRecords(set({ weightKg: 60, reps: 6 }), history).e1rm).toBe(true)
    expect(personalRecords(set({ weightKg: 52.5, reps: 9 }), history).e1rm).toBe(false)
    expect(personalRecords(set({ weightKg: 51, reps: 11 }), history).e1rm).toBe(false) // 69,7
  })

  it('rekordi i e1RM-së me shtesën: Bench Press 62,5 × 12 pas 60 × 13 → 87,5, +1,5', () => {
    const java1 = [set({ weightKg: 60, reps: 13, week: 1, loggedAt: daysAgo(7) })]
    const record = e1rmRecord(set({ weightKg: 62.5, reps: 12, week: 2, loggedAt: daysAgo(0) }), java1)
    expect(record?.e1rmKg).toBeCloseTo(87.5, 5)
    expect(record?.previousBestKg).toBeCloseTo(86, 5)
    expect(record?.gainKg).toBeCloseTo(1.5, 5)
  })

  it('seti i ruajtur, që është tashmë te historia, krahasohet me të tjerët, jo me veten', () => {
    const java1 = [set({ weightKg: 60, reps: 13, loggedAt: daysAgo(7) })]
    const saved = set({ weightKg: 62.5, reps: 12, loggedAt: daysAgo(0) })
    expect(e1rmRecord(saved, [...java1, saved])?.gainKg).toBeCloseTo(1.5, 5)
  })

  it('seti i parë i ushtrimit nuk është rekord i e1RM-së', () => {
    expect(e1rmRecord(set({ weightKg: 62.5, reps: 12 }), [])).toBeNull()
  })

  it('pa histori për ushtrimin, as setet e ngrohjes: asnjë rekord', () => {
    expect(personalRecords(set({ exerciseId: 'squat', weightKg: 100, reps: 5 }), history)).toEqual({ weightForReps: false, e1rm: false })
    expect(personalRecords(set({ weightKg: 80, reps: 12, isWarmup: true }), history)).toEqual({ weightForReps: false, e1rm: false })
  })
})

describe('rregulli i progresit i programeve të tua (V9)', () => {
  const dumbbell = { equipment: 'dumbbell' as const, tracking: 'weight_reps' as const }
  const target = { kind: 'reps' as const, min: 8, max: 12, beyond: false }
  const progression = { rule: { minRir: 2, incrementKg: 2.5 }, topReps: 12 }
  const session = (sets: [kg: number, reps: number, rir: number | null][], sessionId = 'last', loggedAt = daysAgo(3)) =>
    sets.map(([weightKg, reps, rir], index) => set({ exerciseId: 'press', sessionId, setNumber: index + 1, weightKg, reps, rir, loggedAt }))
  const weight = (history: HistorySet[]) => weightFor({ exerciseId: 'press', target, exercise: dumbbell, history, now: NOW, progression })

  it('çdo set në kufirin e sipërm me RIR ≥ 2: pesha e fundit + 2,5 kg', () => {
    expect(weight(session([[20, 12, 2], [20, 12, 3], [20, 12, 2]]))).toEqual({
      weightKg: 22.5,
      basis: { kind: 'progression', lastKg: 20, incrementKg: 2.5, minRir: 2, topReps: 12, earned: true },
    })
  })

  it('një set nën kufirin e sipërm: pesha mbetet', () => {
    expect(weight(session([[20, 12, 2], [20, 11, 2], [20, 12, 2]]))).toMatchObject({ weightKg: 20, basis: { earned: false } })
  })

  it('RIR nën prag, ose i paregjistruar (0), mban peshën', () => {
    expect(weight(session([[20, 12, 2], [20, 12, 1], [20, 12, 2]]))).toMatchObject({ weightKg: 20, basis: { earned: false } })
    expect(weight(session([[20, 12, 2], [20, 12, null], [20, 12, 2]]))).toMatchObject({ weightKg: 20, basis: { earned: false } })
  })

  it('pesha e fundit është më e rënda e seancës', () => {
    expect(weight(session([[22, 12, 2], [20, 12, 3]]))).toMatchObject({ weightKg: 24.5, basis: { lastKg: 22 } })
  })

  it('vlen vetëm seanca e fundit e ushtrimit', () => {
    const older = session([[17.5, 10, 0]], 'older', daysAgo(10))
    expect(weight([...older, ...session([[20, 12, 2], [20, 12, 2]])]).weightKg).toBe(22.5)
  })

  it('pa javë të kaluar ose pa histori: si §7', () => {
    const history = session([[20, 12, 2]]) // e1RM 28,8 → 28,8 / 1,4 = 20,6 → 20 (hapi 2)
    const firstWeek = weightFor({ exerciseId: 'press', target, exercise: dumbbell, history, now: NOW, progression: { ...progression, topReps: null } })
    expect(firstWeek).toMatchObject({ weightKg: 20, basis: { kind: 'one_rm' } })
    expect(weight([])).toEqual({ weightKg: null, basis: { kind: 'choose', min: 8, max: 12 } })
  })
})

describe('pragu i rekordit (§0.3a)', () => {
  const java1 = [set({ weightKg: 60, reps: 13, loggedAt: daysAgo(7) })] // e1RM 86,0

  it('Bench Press 62,5 kg në Javën 2 (9–11): 12 përsëritje japin rekord, 11 japin vetëm 85,4', () => {
    const threshold = recordThreshold(java1, { exerciseId: 'bench', weightKg: 62.5, min: 9, max: 11 })
    expect(threshold?.reps).toBe(12)
    expect(threshold?.e1rmKg).toBeCloseTo(87.5, 5)
    expect(e1rm(62.5, 11)).toBeCloseTo(85.4, 1)
  })

  it('shfaqet deri në 2 përsëritje mbi kufirin e sipërm, jo më larg', () => {
    // 60 kg: 13 përsëritje japin sa rekordi (86,0), 14 e kalojnë: 3 mbi 11.
    expect(recordThreshold(java1, { exerciseId: 'bench', weightKg: 60, min: 9, max: 11 })).toBeNull()
    expect(recordThreshold(java1, { exerciseId: 'bench', weightKg: 60, min: 9, max: 12 })?.reps).toBe(14)
  })

  it('nën intervalin nuk shfaqet: 70 kg e kalojnë 86,0 me 7, para 9–11', () => {
    expect(recordThreshold(java1, { exerciseId: 'bench', weightKg: 70, min: 9, max: 11 })).toBeNull()
    expect(recordThreshold(java1, { exerciseId: 'bench', weightKg: 70, min: 7, max: 11 })?.reps).toBe(7)
  })

  it('rekordet e ushtrimeve të tjera nuk vlejnë', () => {
    const squat = set({ exerciseId: 'squat', weightKg: 100, reps: 10 })
    expect(recordThreshold([...java1, squat], { exerciseId: 'bench', weightKg: 62.5, min: 9, max: 11 })?.reps).toBe(12)
  })

  it('pa histori (ose vetëm me sete ngrohjeje) s\'ka rekord për të kaluar', () => {
    const warmup = [set({ weightKg: 40, reps: 10, isWarmup: true })]
    expect(recordThreshold([], { exerciseId: 'bench', weightKg: 62.5, min: 1, max: 5 })).toBeNull()
    expect(recordThreshold(warmup, { exerciseId: 'bench', weightKg: 62.5, min: 1, max: 5 })).toBeNull()
  })
})

describe('progresioni çdo seancë dhe %1RM', () => {
  const linear = { startKg: 40, incrementKg: 2.5, failuresBeforeDeload: 3, deloadPercent: 10 }

  it('nis nga pesha fillestare; rritet kur mbyllen të gjitha përsëritjet; mbetet kur jo', () => {
    expect(linearWeight(linear, [], 2.5)).toBe(40)
    expect(linearWeight(linear, [{ weightKg: 50, allRepsDone: true }], 2.5)).toBe(52.5)
    expect(linearWeight(linear, [{ weightKg: 50, allRepsDone: false }, { weightKg: 47.5, allRepsDone: true }], 2.5)).toBe(50)
  })

  it('ulet pas N dështimesh radhazi', () => {
    const failed = (count: number) => Array.from({ length: count }, () => ({ weightKg: 60, allRepsDone: false }))
    expect(linearWeight(linear, failed(2), 2.5)).toBe(60)
    expect(linearWeight(linear, failed(3), 2.5)).toBe(52.5)
  })

  it('%1RM poshtë sipas hapit', () => {
    expect(percentWeight(100, 85, 2.5)).toBe(85)
    expect(percentWeight(93, 65, 2.5)).toBe(60)
  })
})

describe('sugjerimi për slotin e seancës', () => {
  const steps = { barbell: 2.5, dumbbell: 2 }
  const barbell = { equipment: 'barbell' as const, tracking: 'weight_reps' as const }
  const history = [set({ weightKg: 60, reps: 10, loggedAt: daysAgo(3) })] // 1RM 80
  const reps = (min: number, max: number | null) => ({ kind: 'reps' as const, min, max, beyond: false })

  it('nga 1RM aktuale dhe kufiri i sipërm, me hapin e pajisjes', () => {
    expect(suggestionFor({ exerciseId: 'bench', target: reps(12, 15) }, barbell, history, NOW, null, steps)).toEqual({ weightKg: 52.5, hint: null })
    expect(suggestionFor({ exerciseId: 'bench', target: reps(6, 8) }, { ...barbell, equipment: 'dumbbell' }, history, NOW, null, steps)).toEqual({
      weightKg: 62,
      hint: null,
    })
  })

  it('pa kufi të sipërm: nga kufiri i poshtëm', () => {
    expect(suggestionFor({ exerciseId: 'bench', target: reps(10, null) }, barbell, history, NOW, null, steps).weightKg).toBe(60)
  })

  it('seanca: pulpat me histori pa e1RM marrin peshën e fundit, jo "Zgjidh peshën"', () => {
    const machine = { equipment: 'machine' as const, tracking: 'weight_reps' as const }
    const calves = [set({ exerciseId: 'calf', weightKg: 80, reps: 27, loggedAt: daysAgo(7) })]
    expect(suggestionFor({ exerciseId: 'calf', target: reps(15, 20) }, machine, calves, NOW, null, steps)).toEqual({ weightKg: 80, hint: null })
  })

  it('ushtrim pa histori: "Zgjidh peshën ku mbyll X–Y përsëritje"', () => {
    expect(suggestionFor({ exerciseId: 'squat', target: reps(12, 15) }, barbell, history, NOW, null, steps)).toEqual({
      weightKg: null,
      hint: 'Zgjidh peshën ku mbyll 12–15 përsëritje',
    })
  })

  it('%1RM nga 1RM aktuale; pa 1RM, si ta gjesh', () => {
    const target = { kind: 'percent_1rm' as const, percent: 75, reps: 5, amrap: false }
    expect(suggestionFor({ exerciseId: 'bench', target }, barbell, history, NOW, null, steps).weightKg).toBe(60)
    expect(suggestionFor({ exerciseId: 'squat', target }, barbell, history, NOW, null, steps)).toEqual({
      weightKg: null,
      hint: 'Vendos 1RM-në e ushtrimit për peshën e javës',
    })
  })

  it('progresion çdo seancë: nga seancat e mëparshme të ushtrimit', () => {
    const target = { kind: 'linear' as const, reps: 5, startKg: 40, incrementKg: 2.5, failuresBeforeDeload: 3, deloadPercent: 10 }
    const done = [
      set({ sessionId: 'a', weightKg: 60, reps: 5, loggedAt: daysAgo(4) }),
      set({ sessionId: 'a', setNumber: 2, weightKg: 60, reps: 5, loggedAt: daysAgo(4) }),
    ]
    expect(suggestionFor({ exerciseId: 'bench', target }, barbell, done, NOW, null, steps).weightKg).toBe(62.5)
    const missed = [...done, set({ sessionId: 'b', weightKg: 62.5, reps: 5, loggedAt: daysAgo(2) }), set({ sessionId: 'b', setNumber: 2, weightKg: 62.5, reps: 3, loggedAt: daysAgo(2) })]
    expect(suggestionFor({ exerciseId: 'bench', target }, barbell, missed, NOW, null, steps).weightKg).toBe(62.5)
    expect(suggestionFor({ exerciseId: 'squat', target }, barbell, missed, NOW, null, steps).weightKg).toBe(40)
  })

  it('pesha me arsyen e §7: Bench Press 60 × 13 te Java 1 jep 62,5 kg për 9–11', () => {
    const java1 = [set({ weightKg: 60, reps: 13, loggedAt: daysAgo(7) })] // e1RM 86,0
    const proposal = weightFor({ exerciseId: 'bench', target: reps(9, 11), exercise: barbell, history: java1, now: NOW, steps })
    expect(proposal.weightKg).toBe(62.5)
    expect(proposal.basis).toMatchObject({ kind: 'one_rm', reps: 11, stepKg: 2.5 })
    if (proposal.basis?.kind !== 'one_rm') throw new Error('pa arsye')
    expect(proposal.basis.oneRmKg).toBeCloseTo(86, 5)
    expect(proposal.basis.exactKg).toBeCloseTo(62.93, 2)
  })

  it('me histori por pa e1RM (pulpat mbi 15 përsëritje): pesha e fundit e përdorur', () => {
    const machine = { equipment: 'machine' as const, tracking: 'weight_reps' as const }
    const calves = [
      set({ exerciseId: 'calf', weightKg: 70, reps: 28, loggedAt: daysAgo(14) }),
      set({ exerciseId: 'calf', weightKg: 80, reps: 26, loggedAt: daysAgo(7) }),
      set({ exerciseId: 'calf', weightKg: 100, reps: 20, isWarmup: true, loggedAt: daysAgo(6) }),
    ]
    expect(weightFor({ exerciseId: 'calf', target: reps(15, 20), exercise: machine, history: calves, now: NOW, steps })).toEqual({
      weightKg: 80,
      basis: { kind: 'last_weight', weightKg: 80 },
    })
    const withoutWeight = [...calves, set({ exerciseId: 'calf', weightKg: null, reps: 30, loggedAt: daysAgo(5) })]
    expect(weightFor({ exerciseId: 'calf', target: reps(15, 20), exercise: machine, history: withoutWeight, now: NOW, steps }).weightKg).toBe(80)
  })

  it('pa histori: pa peshë, me intervalin ku zgjidhet pesha', () => {
    expect(weightFor({ exerciseId: 'squat', target: reps(12, 15), exercise: barbell, history, now: NOW, steps })).toEqual({
      weightKg: null,
      basis: { kind: 'choose', min: 12, max: 15 },
    })
  })

  it('%1RM me arsyen; pa 1RM, kërkon 1RM-në', () => {
    const target = { kind: 'percent_1rm' as const, percent: 75, reps: 5, amrap: false }
    expect(weightFor({ exerciseId: 'bench', target, exercise: barbell, history, now: NOW, steps })).toEqual({
      weightKg: 60,
      basis: { kind: 'percent_1rm', oneRmKg: 80, percent: 75, exactKg: 60, stepKg: 2.5 },
    })
    expect(weightFor({ exerciseId: 'squat', target, exercise: barbell, history, now: NOW, steps })).toEqual({
      weightKg: null,
      basis: { kind: 'needs_one_rm' },
    })
  })

  it('progresion çdo seancë përmes së njëjtës rrugë', () => {
    const target = { kind: 'linear' as const, reps: 5, startKg: 40, incrementKg: 2.5, failuresBeforeDeload: 3, deloadPercent: 10 }
    const done = [set({ sessionId: 'a', weightKg: 60, reps: 5, loggedAt: daysAgo(4) })]
    expect(weightFor({ exerciseId: 'bench', target, exercise: barbell, history: done, now: NOW, steps })).toEqual({
      weightKg: 62.5,
      basis: { kind: 'linear' },
    })
  })

  it('pa sugjerim për kohën dhe për peshën e trupit', () => {
    expect(suggestionFor({ exerciseId: 'bench', target: { kind: 'timed', seconds: 60 } }, barbell, history, NOW, null, steps)).toEqual({ weightKg: null, hint: null })
    expect(suggestionFor({ exerciseId: 'bench', target: reps(12, 15) }, { equipment: 'bodyweight', tracking: 'bodyweight_reps' }, history, NOW, null, steps)).toEqual({
      weightKg: null,
      hint: null,
    })
  })
})
