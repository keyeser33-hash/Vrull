import { planSession } from './engine'
import { SHORTCUT_TO_SIZE } from './shortcut-to-size'
import type { Pointer, Target } from './types'

// Pranimi i TH-07: programi krahasohet rresht për rresht me Shtojcat A, B dhe E të SPEC-it.
// Tabelat më poshtë janë kopjuar nga specifikimi, jo nga kodi.

type Group = 'main' | 'calves'
// [setet, grupi, Faza 1, Faza 2, Faza 3]
type Row = [number, Group, string, string, string]

const APPENDIX_A: Row[][] = [
  [
    [4, 'main', 'Bench Press', 'Bench Press', 'Bench Press'],
    [3, 'main', 'Incline Bench Press', 'Incline Dumbbell Press', 'Reverse-Grip Incline Dumbbell Press'],
    [3, 'main', 'Incline Dumbbell Flye', 'Dumbbell Flye', 'Incline Dumbbell Flye'],
    [3, 'main', 'Cable Crossover', 'Incline Cable Flye', 'Cable Crossover'],
    [3, 'main', 'Triceps Pressdown', 'Triceps Pressdown', 'Triceps Pressdown'],
    [3, 'main', 'Lying Triceps Extension', 'Dumbbell Overhead Triceps Extension', 'Cable Triceps Extension'],
    [3, 'main', 'Cable Overhead Triceps Extension', 'Cable Lying Triceps Extension', 'Close-Grip Bench Press'],
    [4, 'calves', 'Standing Calf Raise', 'Standing Calf Raise', 'Standing Calf Raise'],
    [4, 'calves', 'Seated Calf Raise', 'Seated Calf Raise', 'Seated Calf Raise'],
  ],
  [
    [4, 'main', 'Dumbbell Bent-Over Row', 'Dumbbell Bent-Over Row', 'Dumbbell Bent-Over Row'],
    [3, 'main', 'Wide-Grip Pulldown', 'Behind-Neck Pulldown', 'Wide-Grip Pulldown'],
    [3, 'main', 'Standing Pulldown', 'Seated Cable Row', 'Straight-Arm Pulldown'],
    [3, 'main', 'Straight-Arm Pulldown', 'Reverse-Grip Pulldown', 'Seated Cable Row'],
    [4, 'main', 'Barbell Curl', 'Barbell Curl', 'Barbell Curl'],
    [3, 'main', 'Dumbbell Incline Curl', 'Preacher Curl', 'Incline Cable Curl'],
    [3, 'main', 'One-Arm High Cable Curl', 'Behind-Back Cable Curl', 'Dumbbell Concentration Curl'],
  ],
  [
    [4, 'main', 'Dumbbell Shoulder Press', 'Dumbbell Shoulder Press', 'Dumbbell Shoulder Press'],
    [3, 'main', 'Dumbbell Lateral Raise', 'Smith Machine Upright Row', 'Dumbbell Lateral Raise'],
    [3, 'main', 'One-Arm Cable Front Raise', 'One-Arm Cable Lateral Raise', 'Dumbbell Upright Row'],
    [3, 'main', 'High Cable Rear Delt Fly', 'Bent-Over Lateral Raise', 'Bent-Over Lateral Raise'],
    [4, 'main', 'Dumbbell Shrug', 'Barbell Shrug', 'One-Arm Smith Machine Shrug'],
    [4, 'calves', 'Seated Calf Raise', 'Seated Calf Raise', 'Seated Calf Raise'],
    [4, 'calves', 'Leg Press Calf Raise', 'Leg Press Calf Raise', 'Leg Press Calf Raise'],
  ],
  [
    [4, 'main', 'Squat', 'Squat', 'Squat'],
    [3, 'main', 'One-Leg Leg Press', 'Front Squat', 'Leg Press'],
    [3, 'main', 'Leg Extension', 'Leg Extension', 'Leg Extension'],
    [4, 'main', 'Romanian Deadlift', 'Romanian Deadlift', 'Romanian Deadlift'],
    [3, 'main', 'Lying Leg Curl', 'Seated Leg Curl', 'Lying Leg Curl'],
  ],
]

// Shtojca B: barku sipas javës, njësoj në të tri fazat, pas ushtrimeve të Stërvitjes 2 dhe 4.
const APPENDIX_B: Record<number, string[][]> = {
  1: [
    ['Hip Thrust', 'Crunch', 'Oblique Crunch'],
    ['Hanging Leg Raise', 'Weighted Crunch', 'Dumbbell Side Bend'],
    ['Weighted Hip Thrust', 'Cable Crunch', 'Cable Oblique Crunch'],
    ['Smith Machine Hip Thrust', 'Machine Crunch', 'Band Roundhouse Elbow'],
  ],
  3: [
    ['Hip Thrust', 'Crunch', 'Plank'],
    ['Hanging Leg Raise', 'Weighted Crunch', 'Side Plank'],
    ['Weighted Hip Thrust', 'Cable Crunch', 'Cable Woodchopper'],
    ['Smith Machine Hip Thrust', 'Machine Crunch', 'Plank'],
  ],
}
// Plank dhe Side Plank: sekondat sipas fazës, për javët 1, 2 dhe 4.
const PLANK_SECONDS: Record<number, Record<number, number>> = {
  1: { 1: 60, 2: 60, 4: 75 },
  2: { 1: 75, 2: 75, 4: 90 },
  3: { 1: 90, 2: 90, 4: 105 },
}

const LADDERS = {
  main: [
    [12, 15],
    [9, 11],
    [6, 8],
    [3, 5],
  ],
  calves: [
    [25, 30],
    [15, 20],
    [10, 14],
    [6, 9],
  ],
  abs: [
    [20, 30],
    [15, 19],
    [10, 14],
    [6, 9],
  ],
}

// Shtojca E: [ushtrimet, kryesorë, ndihmës].
const APPENDIX_E: [string, string, string][] = [
  ['Bench Press', 'pectoralis_major_sternocostal', 'pectoralis_major_clavicular, deltoid_anterior, triceps_brachii'],
  ['Incline Bench Press, Incline Dumbbell Press', 'pectoralis_major_clavicular', 'deltoid_anterior, triceps_brachii, pectoralis_major_sternocostal'],
  ['Reverse-Grip Incline Dumbbell Press', 'pectoralis_major_clavicular', 'triceps_brachii, deltoid_anterior'],
  ['Incline Dumbbell Flye, Incline Cable Flye', 'pectoralis_major_clavicular', 'deltoid_anterior'],
  ['Dumbbell Flye', 'pectoralis_major_sternocostal', 'pectoralis_major_clavicular, deltoid_anterior'],
  ['Cable Crossover', 'pectoralis_major_sternocostal', 'pectoralis_minor, deltoid_anterior'],
  ['Close-Grip Bench Press', 'triceps_brachii', 'pectoralis_major_sternocostal, deltoid_anterior'],
  [
    'Triceps Pressdown, Lying Triceps Extension, Cable Lying Triceps Extension, Cable Overhead Triceps Extension, Dumbbell Overhead Triceps Extension, Cable Triceps Extension',
    'triceps_brachii',
    '',
  ],
  ['Standing Calf Raise, Leg Press Calf Raise', 'gastrocnemius', 'soleus'],
  ['Seated Calf Raise', 'soleus', 'gastrocnemius'],
  ['Dumbbell Bent-Over Row', 'latissimus_dorsi, rhomboid_major', 'trapezius, teres_major, deltoid_posterior, biceps_brachii, erector_spinae'],
  ['Seated Cable Row', 'latissimus_dorsi, rhomboid_major', 'trapezius, deltoid_posterior, biceps_brachii'],
  ['Wide-Grip Pulldown, Behind-Neck Pulldown', 'latissimus_dorsi', 'teres_major, rhomboid_major, biceps_brachii'],
  ['Reverse-Grip Pulldown, Standing Pulldown', 'latissimus_dorsi', 'biceps_brachii, teres_major'],
  ['Straight-Arm Pulldown', 'latissimus_dorsi', 'teres_major, triceps_brachii'],
  ['Barbell Curl', 'biceps_brachii', 'brachialis, brachioradialis'],
  ['Preacher Curl', 'biceps_brachii, brachialis', 'brachioradialis'],
  [
    'Dumbbell Incline Curl, Incline Cable Curl, One-Arm High Cable Curl, Behind-Back Cable Curl, Dumbbell Concentration Curl',
    'biceps_brachii',
    'brachialis',
  ],
  ['Dumbbell Shoulder Press', 'deltoid_anterior, deltoid_lateral', 'triceps_brachii, trapezius'],
  ['Dumbbell Lateral Raise, One-Arm Cable Lateral Raise', 'deltoid_lateral', 'trapezius'],
  ['One-Arm Cable Front Raise', 'deltoid_anterior', 'pectoralis_major_clavicular'],
  ['High Cable Rear Delt Fly, Bent-Over Lateral Raise', 'deltoid_posterior', 'rhomboid_major, trapezius, infraspinatus'],
  ['Smith Machine Upright Row, Dumbbell Upright Row', 'deltoid_lateral, trapezius', 'deltoid_anterior, biceps_brachii'],
  ['Dumbbell Shrug, Barbell Shrug, One-Arm Smith Machine Shrug', 'trapezius', ''],
  ['Squat', 'rectus_femoris, vastus_lateralis, vastus_medialis, gluteus_maximus', 'adductor_magnus, erector_spinae, biceps_femoris'],
  ['Front Squat', 'rectus_femoris, vastus_lateralis, vastus_medialis', 'gluteus_maximus, erector_spinae, rectus_abdominis'],
  ['Leg Press, One-Leg Leg Press', 'rectus_femoris, vastus_lateralis, vastus_medialis', 'gluteus_maximus, adductor_magnus'],
  ['Leg Extension', 'rectus_femoris, vastus_lateralis, vastus_medialis', ''],
  ['Romanian Deadlift', 'biceps_femoris, semitendinosus, semimembranosus, gluteus_maximus', 'erector_spinae, adductor_magnus'],
  ['Lying Leg Curl, Seated Leg Curl', 'biceps_femoris, semitendinosus, semimembranosus', 'gastrocnemius'],
  ['Hip Thrust, Weighted Hip Thrust, Smith Machine Hip Thrust', 'rectus_abdominis', 'external_oblique'],
  ['Crunch, Weighted Crunch, Cable Crunch, Machine Crunch, Hanging Leg Raise, Plank', 'rectus_abdominis', 'external_oblique'],
  ['Oblique Crunch, Cable Oblique Crunch, Cable Woodchopper, Band Roundhouse Elbow', 'external_oblique', 'rectus_abdominis'],
  ['Dumbbell Side Bend', 'external_oblique', 'erector_spinae'],
  ['Side Plank', 'external_oblique', 'gluteus_medius, rectus_abdominis'],
]

const list = (text: string) => (text ? text.split(', ') : [])

const { program, exercises } = SHORTCUT_TO_SIZE
const blocks = [...program.blocks].sort((a, b) => a.position - b.position)
const days = [...program.days].sort((a, b) => a.position - b.position)
const nameOf = (id: string) => exercises.find((exercise) => exercise.id === id)?.name
const pointer = (block: number, week: number, day: number): Pointer => ({
  run: 1,
  blockId: blocks[block].id,
  week,
  dayId: days[day].id,
  completed: false,
})
const range = (target: Target) => (target.kind === 'reps' ? [target.min, target.max] : target)

describe('Shortcut to Size sipas Shtojcave A dhe B', () => {
  it('Java 0 dhe tri faza me nga 4 javë, katër ditë', () => {
    expect(blocks.map((block) => [block.name, block.weeks])).toEqual([
      ['Java 0', 1],
      ['Faza 1', 4],
      ['Faza 2', 4],
      ['Faza 3', 4],
    ])
    expect(days.map((day) => day.name)).toEqual([
      'Gjoks, triceps, pulpa',
      'Shpinë, biceps, bark',
      'Shpatulla, trapez, pulpa',
      'Këmbë, bark',
    ])
  })

  for (const phase of [1, 2, 3]) {
    for (const week of [1, 2, 3, 4]) {
      for (const [day, rows] of APPENDIX_A.entries()) {
        it(`Faza ${phase} · Java ${week} · Stërvitja ${day + 1}`, () => {
          const plan = planSession(program, pointer(phase, week, day))
          const abs = APPENDIX_B[day]?.[week - 1] ?? []
          const technique = week <= 2 ? 'rest_pause' : 'drop_set'
          const expected = [
            ...rows.map(([sets, group, ...names]) => ({
              name: names[phase - 1],
              sets,
              restSeconds: group === 'calves' ? 60 : 90,
              target: LADDERS[group][week - 1],
              technique,
            })),
            ...abs.map((name) => {
              const timed = name === 'Plank' || name === 'Side Plank'
              return {
                name,
                sets: 3,
                restSeconds: 60,
                target: timed ? { kind: 'timed', seconds: PLANK_SECONDS[phase][week] } : LADDERS.abs[week - 1],
                technique: timed ? 'none' : technique,
              }
            }),
          ]
          expect(
            plan.slots.map((slot) => ({
              name: nameOf(slot.exerciseId),
              sets: slot.sets,
              restSeconds: slot.restSeconds,
              target: range(slot.target),
              technique: slot.technique.type,
            })),
          ).toEqual(expected)
        })
      }
    }
  }

  it('barku i javës 1: deri në dështim nëse mund më shumë', () => {
    const crunch = planSession(program, pointer(1, 1, 1)).slots.find((slot) => nameOf(slot.exerciseId) === 'Crunch')
    expect(crunch?.target).toMatchObject({ min: 20, max: 30, beyond: true })
    const later = planSession(program, pointer(1, 2, 1)).slots.find((slot) => nameOf(slot.exerciseId) === 'Weighted Crunch')
    expect(later?.target).toMatchObject({ beyond: false })
  })

  for (const [day, rows] of APPENDIX_A.entries()) {
    it(`Java 0 · Stërvitja ${day + 1}: ushtrimet e Fazës 1, 3 sete aty ku janë 4 dhe 2 për të tjerat`, () => {
      const plan = planSession(program, pointer(0, 1, day))
      const abs = APPENDIX_B[day]?.[0] ?? []
      const expected = [
        ...rows.map(([sets, group, name]) => ({
          name,
          sets: sets === 4 ? 3 : 2,
          target: { kind: 'reps', min: LADDERS[group][0][0], max: LADDERS[group][0][1], beyond: false, rir: { min: 2, max: 3 } },
          technique: 'none',
        })),
        ...abs.map((name) => ({
          name,
          sets: 2,
          target: name === 'Plank' ? { kind: 'timed', seconds: 60 } : { kind: 'reps', min: 20, max: 30, beyond: false, rir: { min: 2, max: 3 } },
          technique: 'none',
        })),
      ]
      expect(
        plan.slots.map((slot) => ({
          name: nameOf(slot.exerciseId),
          sets: slot.sets,
          target: slot.target,
          technique: slot.technique.type,
        })),
      ).toEqual(expected)
    })
  }

  it('shtesa ndërmjet fazave: +2,5–9 kg kundrejt së njëjtës javë', () => {
    const [bench] = planSession(program, pointer(2, 1, 0)).slots
    expect(bench.blockIncreaseKg).toEqual({ min: 2.5, max: 9 })
  })
})

const migrations = import.meta.glob<string>('../../supabase/migrations/*.sql', { query: '?raw', import: 'default', eager: true })
const MUSCLE_KEYS = new Set(
  [...Object.values(migrations).join('\n').matchAll(/create domain public\.muscle_keys[\s\S]*?\]::text\[\]\)/g)]
    .flatMap((match) => [...match[0].matchAll(/'(\w+)'/g)].map((key) => key[1])),
)

describe('ushtrimet e programit sipas Shtojcës E', () => {
  const expected = new Map(
    APPENDIX_E.flatMap(([names, primary, secondary]) =>
      list(names).map((name) => [name, { primary: list(primary), secondary: list(secondary) }] as const),
    ),
  )

  it('çdo ushtrim i programit ka muskujt e Shtojcës E', () => {
    const used = new Set(
      blocks.flatMap((_, block) =>
        [1, 2, 3, 4].flatMap((week) =>
          days.flatMap((_, day) =>
            block === 0 && week > 1 ? [] : planSession(program, pointer(block, week, day)).slots.map((slot) => nameOf(slot.exerciseId)),
          ),
        ),
      ),
    )
    expect([...used].sort()).toEqual([...expected.keys()].sort())
    for (const exercise of exercises) {
      expect({ name: exercise.name, primary: exercise.primary, secondary: exercise.secondary }).toEqual({
        name: exercise.name,
        ...expected.get(exercise.name),
      })
    }
  })

  it('çelësat e muskujve janë ata që pranon Supabase', () => {
    expect(MUSCLE_KEYS.size).toBe(34)
    for (const exercise of exercises) {
      for (const key of [...exercise.primary, ...exercise.secondary]) expect(MUSCLE_KEYS, exercise.name).toContain(key)
    }
  })

  it('emrat e njëjtë janë një ushtrim i vetëm', () => {
    const names = exercises.map((exercise) => exercise.name)
    expect(new Set(names).size).toBe(names.length)
    expect(names).not.toContain('Straight Arm Pulldown')
    expect(names).not.toContain('Incline Cable Cable Flye')
  })

  it('ushtrimet me kohë dhe ato pa peshë regjistrohen ndryshe', () => {
    const tracking = (name: string) => exercises.find((exercise) => exercise.name === name)?.tracking
    expect(tracking('Plank')).toBe('timed')
    expect(tracking('Side Plank')).toBe('timed')
    expect(tracking('Hanging Leg Raise')).toBe('bodyweight_reps')
    expect(tracking('Bench Press')).toBe('weight_reps')
  })
})
