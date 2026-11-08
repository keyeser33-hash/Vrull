import type { Draft, Target } from '../../supabase/functions/program-import/shared'
import { planSession } from './engine'
import { type LibraryExercise, loadLibrary } from './library'
import { buildProgram, type Choice, matchExercises, type OwnExercise, previewDays } from './pdf-import'
import fixture from './pdf-import.fixture.json'
import { SHORTCUT_TO_SIZE } from './shortcut-to-size'

// Importi nga PDF (V2-E1-11): përgjigja e regjistruar e AI-së për PDF-në e Shortcut to Size (fixture,
// e ndërtuar nga src/program/shortcut-to-size.ts) kthehet në program të ndërtuesit; ushtrimet e sigurta
// merren vetë, të pasigurtat pyeten.

const draft = fixture as Draft
let library: LibraryExercise[]
beforeAll(async () => {
  library = await loadLibrary()
})

/** Ushtrimet e Shortcut to Size si ushtrime të përdoruesit (ai që e ka nisur programin). */
const stsOwn = (): OwnExercise[] =>
  SHORTCUT_TO_SIZE.exercises.map((exercise) => ({ id: `own-${exercise.name}`, name: exercise.name, libraryId: exercise.libraryId, tracking: exercise.tracking, equipment: exercise.equipment }))

const names = (choices: (Choice | null)[]) => choices.map((choice) => (choice ? choiceName(choice) : null))
const choiceName = (choice: Choice) => (choice.kind === 'library' ? choice.exercise.name : choice.name)

const target = (values: Partial<Target>): Target => ({ reps_min: 8, reps_max: 12, to_failure: false, seconds: 0, rir_min: -1, rir_max: -1, last_set: 'none', ...values })

/** Një draft i vogël me një bllok dhe një ditë, për rregullat e recetës. */
function small(plans: Target[][], slot: Partial<Draft['days'][number]['slots'][number]> = {}, blocks = [{ name: 'Blloku', weeks: 4 }]): Draft {
  return {
    found: true,
    name: 'Prova',
    pages: 2,
    blocks,
    plans: plans.map((weeks) => ({ weeks })),
    exercises: [{ pdf_name: 'Bench Press', page: 1, match: 'Barbell Bench Press - Medium Grip', alternative: '', sure: true, equipment: 'barbell', muscles: ['chest'], timed: false }],
    days: [{ name: 'Dita A', slots: [{ exercise: 0, sets: 3, rest_seconds: 120, plan: 0, blocks: [], weeks: [], ...slot }] }],
  }
}
const resolve = (value: Draft) => matchExercises(value, { own: [], library }).choices as Choice[]
const rows = (value: Draft) => buildProgram(value, resolve(value)).program.overrides

describe('importi nga PDF', () => {
  it('Shortcut to Size për një përdorues të ri: 62 ushtrime njihen vetë, 4 pyeten', () => {
    const { choices, questions } = matchExercises(draft, { own: [], library })
    expect(draft.exercises).toHaveLength(66)
    expect(choices.filter(Boolean)).toHaveLength(62)
    expect(choices.filter((choice) => choice?.kind === 'library')).toHaveLength(49)
    expect(choices.filter((choice) => choice?.kind === 'new')).toHaveLength(13)
    expect(questions.map((question) => question.pdfName)).toEqual(['Incline Cable Cable Flye', 'One-Arm High Cable Curl', 'Hip Thrust', 'Band Roundhouse Elbow'])

    const byName = (pdfName: string) => choices[draft.exercises.findIndex((exercise) => exercise.pdf_name === pdfName)]
    expect(byName('Wide-Grip Pulldown')).toMatchObject({ kind: 'library', exercise: { id: 'Wide-Grip_Lat_Pulldown' } })
    expect(byName('Triceps Pressdown')).toMatchObject({ kind: 'library', exercise: { id: 'Triceps_Pushdown' } })
    expect(byName('One-Arm Smith Machine Shrug')).toEqual({ kind: 'new', name: 'One-Arm Smith Machine Shrug', equipment: 'machine', muscles: ['traps'], timed: false })

    const [flye, curl, hip, band] = questions
    expect(flye).toMatchObject({ page: 7, suggestion: { kind: 'library', exercise: { name: 'Incline Cable Flye' } }, alternative: { kind: 'library', exercise: { name: 'Cable Crossover' } } })
    expect(curl).toMatchObject({ suggestion: { kind: 'library', exercise: { name: 'High Cable Curls' } }, alternative: null })
    expect(hip).toMatchObject({ suggestion: { kind: 'library', exercise: { name: 'Barbell Hip Thrust' } } })
    // Pa asnjë emër të njohur: "Shto si të ri" ose "Tjetër".
    expect(band).toMatchObject({ suggestion: null, alternative: null, fallback: { kind: 'new', name: 'Band Roundhouse Elbow', equipment: 'band' } })
  })

  it('kur përdoruesi i ka ushtrimet me të njëjtin emër, ato ripërdoren dhe pyetet vetëm gabimi i shtypit', () => {
    const { choices, questions } = matchExercises(draft, { own: stsOwn(), library })
    expect(choices.filter((choice) => choice?.kind === 'own')).toHaveLength(65)
    expect(questions).toHaveLength(1)
    // Përputhja e AI-së bie te ushtrimi i përdoruesit, jo te kopja e bibliotekës.
    expect(questions[0]).toMatchObject({ pdfName: 'Incline Cable Cable Flye', suggestion: { kind: 'own', id: 'own-Incline Cable Flye' } })
  })

  it('një përputhje që nuk është te lista (e shpikur) pyetet, edhe kur AI-ja thotë se është e sigurt', () => {
    const value = small([[target({})]])
    value.exercises[0] = { ...value.exercises[0], pdf_name: 'Bench Thing', match: 'Bench Press Supreme' }
    const { choices, questions } = matchExercises(value, { own: [], library })
    expect(choices).toEqual([null])
    expect(questions).toMatchObject([{ index: 0, suggestion: null, alternative: null }])
  })

  it('PDF-ja e Shortcut to Size bëhet i njëjti program: çdo bllok, javë dhe ditë', () => {
    const { choices, questions } = matchExercises(draft, { own: stsOwn(), library })
    const answered = choices.map((choice, index) => choice ?? questions.find((question) => question.index === index)!.suggestion!)
    const imported = buildProgram(draft, answered)
    expect(imported.name).toBe('Shortcut to Size')
    expect(names(answered)).not.toContain(null)

    const sts = SHORTCUT_TO_SIZE.program
    const stsBlocks = [...sts.blocks].sort((a, b) => a.position - b.position)
    const stsDays = [...sts.days].sort((a, b) => a.position - b.position)
    expect(imported.program.blocks.map((block) => [block.name, block.weeks])).toEqual(stsBlocks.map((block) => [block.name, block.weeks]))
    expect(imported.program.days.map((day) => day.name)).toEqual(stsDays.map((day) => day.name))
    const nameOf = (program: typeof sts, id: string) => (program === sts ? id : imported.exercises[id].name)
    const shape = (program: typeof sts, blockId: string, week: number, dayId: string) =>
      planSession(program, { run: 1, blockId, week, dayId, completed: false }).slots.map((slot) => ({
        exercise: nameOf(program, slot.exerciseId),
        sets: slot.sets,
        rest: slot.restSeconds,
        target: slot.target,
        technique: slot.technique,
      }))
    let compared = 0
    stsBlocks.forEach((block, blockIndex) => {
      for (let week = 1; week <= block.weeks; week++) {
        stsDays.forEach((day, dayIndex) => {
          expect(shape(imported.program, imported.program.blocks[blockIndex].id, week, imported.program.days[dayIndex].id), `${block.name} · java ${week} · ${day.name}`).toEqual(
            shape(sts, block.id, week, day.id),
          )
          compared += 1
        })
      }
    })
    expect(compared).toBe(13 * 4)
  })

  it('receta: shkalla e përsëritjeve, RIR-i, koha dhe e njëjta teknikë për çdo javë', () => {
    const ladder = small([[target({ reps_min: 12, reps_max: 15, last_set: 'rest_pause' }), target({ reps_min: 6, reps_max: 8, last_set: 'rest_pause' })]])
    expect(rows(ladder)).toEqual([
      { slotId: 'd0-s0', blockId: null, week: null, prescription: { type: 'rep_ladder', ladder: [{ min: 12, max: 15 }, { min: 6, max: 8 }] }, technique: { type: 'rest_pause' } },
    ])
    expect(rows(small([[target({ reps_min: 8, reps_max: 0, to_failure: true, rir_min: 2, rir_max: 2 })]]))[0].prescription).toEqual({ type: 'rir', reps: { min: 8, max: null }, rir: { min: 2, max: 2 } })
    expect(rows(small([[target({ reps_min: 20, reps_max: 30, to_failure: true })]]))[0].prescription).toEqual({ type: 'rep_ladder', ladder: [{ min: 20, max: 30, beyond: true }] })
    expect(rows(small([[target({ reps_min: 0, reps_max: 0, seconds: 45 })]]))[0].prescription).toEqual({ type: 'timed', seconds: 45 })
    // Pa përsëritje në PDF: receta e ushtrimit të ri te ndërtuesi, 8–12 me RIR 2.
    expect(rows(small([[target({ reps_min: 0, reps_max: 0 })]]))[0].prescription).toEqual({ type: 'rir', reps: { min: 8, max: 12 }, rir: { min: 2, max: 2 } })
  })

  it('receta që ndryshon lloj ose teknikë sipas javës shkon javë për javë', () => {
    const mixed = small([[target({ seconds: 30, reps_min: 0, last_set: 'rest_pause' }), target({ reps_min: 10, reps_max: 12, last_set: 'drop_set' })]], {}, [{ name: 'Blloku', weeks: 3 }])
    expect(rows(mixed)).toEqual([
      { slotId: 'd0-s0', blockId: null, week: 1, prescription: { type: 'timed', seconds: 30 }, technique: { type: 'rest_pause' } },
      { slotId: 'd0-s0', blockId: null, week: 2, prescription: { type: 'rep_ladder', ladder: [{ min: 10, max: 12 }] }, technique: { type: 'drop_set' } },
      { slotId: 'd0-s0', blockId: null, week: 3, prescription: { type: 'timed', seconds: 30 }, technique: { type: 'rest_pause' } },
    ])
  })

  it('ndryshimet e një blloku dhe ushtrimet që ndërrohen sipas javës', () => {
    const value = small(
      [[target({ reps_min: 10, reps_max: 12 })], [target({ reps_min: 5, reps_max: 5, rir_min: 1, rir_max: 1 })]],
      { blocks: [{ block: 2, exercise: 1, sets: 4, plan: 1 }], weeks: [{ block: 0, week: 2, exercise: 1 }] },
      [
        { name: 'Bazat', weeks: 4 },
        { name: 'Forca', weeks: 4 },
      ],
    )
    value.exercises.push({ pdf_name: 'Squat', page: 2, match: 'Barbell Squat', alternative: '', sure: true, equipment: 'barbell', muscles: ['quadriceps'], timed: false })
    const imported = buildProgram(value, resolve(value))
    expect(imported.program.overrides).toEqual([
      { slotId: 'd0-s0', blockId: null, week: null, prescription: { type: 'rep_ladder', ladder: [{ min: 10, max: 12 }] } },
      { slotId: 'd0-s0', blockId: 'b1', week: null, exerciseId: 'x1', sets: 4, prescription: { type: 'rir', reps: { min: 5, max: 5 }, rir: { min: 1, max: 1 } }, technique: { type: 'none' } },
      { slotId: 'd0-s0', blockId: null, week: 2, exerciseId: 'x1' },
    ])
    expect(imported.exercises.x1).toMatchObject({ name: 'Barbell Squat', tracking: 'weight_reps', equipment: 'barbell' })
  })

  it('setet dhe pushimi brenda kufijve të bazës; pushimi që mungon merr 90 s', () => {
    const imported = buildProgram(small([[target({})]], { sets: 0, rest_seconds: 0 }), resolve(small([[target({})]])))
    expect(imported.program.slots[0]).toMatchObject({ sets: 1, restSeconds: 90 })
    expect(buildProgram(small([[target({})]], { sets: 40, rest_seconds: 5000 }), resolve(small([[target({})]]))).program.slots[0]).toMatchObject({ sets: 20, restSeconds: 900 })
  })

  it('parapamja: ditët me ushtrimet, të njohurat dhe ato për t’u kontrolluar', () => {
    const { choices, questions } = matchExercises(draft, { own: [], library })
    const days = previewDays(draft, choices)
    expect(days).toHaveLength(4)
    // Një slot pyetet kur ushtrimi i tij në çdo bllok ose javë pret përgjigje (Faza 2 te dita 1, java 4 te dita 2).
    expect(days.map((day) => [day.name, day.slots.length, day.toCheck])).toEqual([
      ['Gjoks, triceps, pulpa', 9, 1],
      ['Shpinë, biceps, bark', 10, 3],
      ['Shpatulla, trapez, pulpa', 7, 0],
      ['Këmbë, bark', 8, 1],
    ])
    expect(days[0].slots[3]).toMatchObject({ name: 'Incline Cable Cable Flye', pdfName: true, check: true })
    const back = days[1].slots
    expect(back[6]).toMatchObject({ name: 'One-Arm High Cable Curl', pdfName: true, check: true })
    expect(back[9]).toMatchObject({ name: 'Band Roundhouse Elbow', pdfName: true, check: true })
    expect(back[0]).toMatchObject({ name: 'Bent Over Two-Dumbbell Row', pdfName: false, check: false, sets: 4, prescription: { type: 'rep_ladder' } })
    // Pas përgjigjes, rreshti merr emrin e zgjedhur.
    const answered = [...choices]
    answered[questions[1].index] = questions[1].suggestion
    expect(previewDays(draft, answered)[1].slots[6]).toMatchObject({ name: 'High Cable Curls', check: false })
  })
})
