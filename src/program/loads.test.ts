import {
  currentOneRm,
  dropWeight,
  e1rm,
  type HistorySet,
  linearWeight,
  percentWeight,
  personalRecords,
  reference,
  roundDown,
  suggestedWeight,
  suggestionFor,
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

  it('pa histori për ushtrimin, as setet e ngrohjes: asnjë rekord', () => {
    expect(personalRecords(set({ exerciseId: 'squat', weightKg: 100, reps: 5 }), history)).toEqual({ weightForReps: false, e1rm: false })
    expect(personalRecords(set({ weightKg: 80, reps: 12, isWarmup: true }), history)).toEqual({ weightForReps: false, e1rm: false })
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

  it('pa sugjerim për kohën dhe për peshën e trupit', () => {
    expect(suggestionFor({ exerciseId: 'bench', target: { kind: 'timed', seconds: 60 } }, barbell, history, NOW, null, steps)).toEqual({ weightKg: null, hint: null })
    expect(suggestionFor({ exerciseId: 'bench', target: reps(12, 15) }, { equipment: 'bodyweight', tracking: 'bodyweight_reps' }, history, NOW, null, steps)).toEqual({
      weightKg: null,
      hint: null,
    })
  })
})
