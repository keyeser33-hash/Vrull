import type { Draft } from '../../supabase/functions/program-import/shared'
import { planSession } from '@/program/engine'
import { loadLibrary } from '@/program/library'
import { buildProgram, type Choice, matchExercises } from '@/program/pdf-import'
import fixture from '@/program/pdf-import.fixture.json'
import { SHORTCUT_TO_SIZE } from '@/program/shortcut-to-size'
import { createDatabase } from './db'
import { knownExercises, readResultFrom, saveImportedDraft } from './pdf-import'
import { completeOnboarding } from './profile'
import { programEditor, programList } from './program-editor'
import { createLocalStore } from './store'
import { programModel } from './training'

// Importi nga PDF (V2-E1-11) te baza lokale: drafti i AI-së bëhet program draft i ndërtuesit, me
// ushtrimet e përdoruesit ose të bibliotekës, dhe përgjigjet e funksionit lexohen me fjalë.

const USER = '11111111-1111-4111-8111-111111111111'
const draft = fixture as Draft
const PROFILE = { weightKg: 80, trainingDays: [1, 2, 4, 5], trainingTime: '18:00', wakeTime: '07:00', sleepTime: '23:00' }

function setup() {
  return createLocalStore(createDatabase(`pdf-${crypto.randomUUID()}`), { userId: () => USER })
}

/** Pyetjet me "Po" (ose "Shto si të ri" kur s'ka emër të njohur). */
async function answered(store: ReturnType<typeof setup>) {
  const library = await loadLibrary()
  const { own } = await knownExercises(store, library)
  const { choices, questions } = matchExercises(draft, { own, library })
  return choices.map((choice, index) => {
    if (choice) return choice
    const question = questions.find((candidate) => candidate.index === index)!
    return question.suggestion ?? question.fallback
  }) as Choice[]
}

describe('importi nga PDF te ndërtuesi', () => {
  it('pranimi: PDF-ja e Shortcut to Size bëhet draft programi që stërvitet si Shortcut to Size', async () => {
    const store = setup()
    const programId = await saveImportedDraft(store, buildProgram(draft, await answered(store)))
    const view = await programEditor(store, programId)
    expect(view).toMatchObject({ name: 'Shortcut to Size', draft: true, template: null, progression: null })
    expect(view!.blocks.map((block) => [block.name, block.weeks])).toEqual([
      ['Java 0', 1],
      ['Faza 1', 4],
      ['Faza 2', 4],
      ['Faza 3', 4],
    ])
    expect(view!.days.map((day) => day.slots.length)).toEqual([9, 10, 7, 8])
    expect((await programList(store)).find((program) => program.id === programId)).toMatchObject({ draft: true, active: false, blocks: 4, days: 4, weeks: 13 })

    // Çdo stërvitje e 13 javëve: ushtrimet (me emrat e bibliotekës kur u përputhën), setet, pushimi,
    // intervali dhe teknika si te Shortcut to Size.
    const { engine, exercises } = (await programModel(store, programId))!
    const library = new Map((await loadLibrary()).map((entry) => [entry.id, entry.name]))
    const stsName = (name: string) => {
      const def = SHORTCUT_TO_SIZE.exercises.find((exercise) => exercise.name === name)!
      const answer = { 'Hip Thrust': 'Barbell Hip Thrust', 'One-Arm High Cable Curl': 'High Cable Curls' }[name]
      return answer ?? (def.libraryId ? library.get(def.libraryId)! : name)
    }
    const sts = SHORTCUT_TO_SIZE.program
    const order = <T extends { position: number }>(list: T[]) => [...list].sort((a, b) => a.position - b.position)
    for (const [blockIndex, block] of order(sts.blocks).entries()) {
      for (let week = 1; week <= block.weeks; week++) {
        for (const [dayIndex, day] of order(sts.days).entries()) {
          const ours = planSession(engine, { run: 1, blockId: view!.blocks[blockIndex].id, week, dayId: view!.days[dayIndex].id, completed: false })
          const theirs = planSession(sts, { run: 1, blockId: block.id, week, dayId: day.id, completed: false })
          expect(
            ours.slots.map((slot) => [exercises[slot.exerciseId].name, slot.sets, slot.restSeconds, slot.target]),
            `${block.name} · java ${week} · ${day.name}`,
          ).toEqual(theirs.slots.map((slot) => [stsName(slot.exerciseId), slot.sets, slot.restSeconds, slot.target]))
        }
      }
    }
  })

  it('ushtrimet: ato të bibliotekës me ID-në e saj, të rejat me pajisjen dhe muskujt e AI-së', async () => {
    const store = setup()
    await saveImportedDraft(store, buildProgram(draft, await answered(store)))
    const rows = await store.all('exercises')
    expect(rows).toHaveLength(66)
    expect(rows.find((row) => row.library_id === 'Wide-Grip_Lat_Pulldown')).toMatchObject({ name: 'Wide-Grip Lat Pulldown', equipment: 'cable', tracking: 'weight_reps' })
    expect(rows.find((row) => row.name === 'One-Arm Smith Machine Shrug')).toMatchObject({ library_id: null, equipment: 'machine', tracking: 'weight_reps', primary_muscles: ['trapezius'] })
    expect(rows.find((row) => row.name === 'Band Roundhouse Elbow')).toMatchObject({ library_id: null, equipment: 'band', tracking: 'bodyweight_reps' })
    // Plank-u i bibliotekës mbahet me kohë, si në PDF.
    expect(rows.find((row) => row.library_id === 'Plank')).toMatchObject({ tracking: 'timed' })
  })

  it('me Shortcut to Size në telefon, ushtrimet e tij ripërdoren: historia mbetet bashkë', async () => {
    const store = setup()
    await completeOnboarding(store, PROFILE)
    const before = await store.all('exercises')
    const programId = await saveImportedDraft(store, buildProgram(draft, await answered(store)))
    expect(await store.all('exercises')).toHaveLength(before.length)
    const view = await programEditor(store, programId)
    expect(view!.days[0].slots[0].exerciseId).toBe(before.find((row) => row.name === 'Bench Press')!.id)
  })

  it('dy ushtrime të PDF-së që përgjigjen me të njëjtin ushtrim bëhen një rresht', async () => {
    const store = setup()
    const choices = await answered(store)
    const crossover = choices[draft.exercises.findIndex((exercise) => exercise.pdf_name === 'Cable Crossover')]
    choices[draft.exercises.findIndex((exercise) => exercise.pdf_name === 'Incline Cable Cable Flye')] = crossover
    await saveImportedDraft(store, buildProgram(draft, choices))
    expect((await store.all('exercises')).filter((row) => row.library_id === 'Cable_Crossover')).toHaveLength(1)
  })

  it('ushtrimet që njeh app-i: të përdoruesit dhe biblioteka, emrat pa përsëritje', async () => {
    const store = setup()
    await completeOnboarding(store, PROFILE)
    const library = await loadLibrary()
    const { own, names } = await knownExercises(store, library)
    expect(own.find((exercise) => exercise.name === 'Bench Press')).toMatchObject({ libraryId: 'Barbell_Bench_Press_-_Medium_Grip', tracking: 'weight_reps', equipment: 'barbell' })
    expect(names).toContain('Band Roundhouse Elbow')
    expect(names).toContain('Barbell Bench Press - Medium Grip')
    expect(new Set(names.map((name) => name.toLowerCase())).size).toBe(names.length)
  })

  it('përgjigjet e funksionit: drafti, kufiri, gabimet me koston dhe pa internet', () => {
    const month = { month: '2026-11-01', spentEur: 1.52, limitEur: 10 }
    const ok = { draft, uncertain: [7], usage: { inputTokens: 120000, outputTokens: 7000, costEur: 0.28, ms: 41000 }, month }
    expect(readResultFrom(200, ok)).toEqual({ ok: true, ...ok })
    expect(readResultFrom(429, { error: 'limit', month })).toEqual({ ok: false, error: 'limit', month })
    expect(readResultFrom(502, { error: 'no_programme', month, costEur: 0.05 })).toEqual({ ok: false, error: 'no_programme', month, costEur: 0.05 })
    expect(readResultFrom(503, { error: 'not_configured' })).toEqual({ ok: false, error: 'not_configured' })
    expect(readResultFrom(500, 'Internal error')).toEqual({ ok: false, error: 'ai_failed' })
    expect(readResultFrom(200, { draft: { found: true } })).toEqual({ ok: false, error: 'ai_failed' })
    expect(readResultFrom(null, null)).toEqual({ ok: false, error: 'offline' })
  })
})
