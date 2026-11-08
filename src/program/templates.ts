import { type ExerciseDef, SHORTCUT_TO_SIZE } from './shortcut-to-size'
import type { Prescription, Program, ProgressionRule, Slot, SlotOverride, Tracking } from './types'

// Shabllonet e ndërtuesit (V2-E1-10, bordi "Programet"; GLOSSARY "Shablloni i programit"): programe
// të gatshme nga të cilat nis ndërtuesi. Ndërtuesi i kopjon te programet e përdoruesit
// (`data/program-editor.ts`, `createFromTemplate`); kopja nuk lidhet me shabllonin.
//
// Shortcut to Size është vetë programi i §5, me emrat e tij (Java 0, Faza 1…, që `@/i18n/domain` i
// përkthen). Full body dhe Upper/Lower kanë ushtrimet e bibliotekës (free-exercise-db) me ID-në e saj
// dhe emrat e blloqeve e të ditëve si çelësa (`builder.template.block.*`, `builder.template.day.*`),
// që kopja i merr në gjuhën e përdoruesit.

export type TemplateId = 'shortcut_to_size' | 'full_body_3' | 'upper_lower_4'

export type TemplateSource =
  /** Ushtrimet me muskujt e vet (Shtojca E). */
  | { kind: 'defs'; exercises: ExerciseDef[] }
  /** Ushtrimet e bibliotekës sipas ID-së; `tracking` kur nuk është me peshë (p.sh. Plank me kohë). */
  | { kind: 'library'; tracking: Record<string, Tracking> }

export interface ProgramTemplate {
  id: TemplateId
  /** Blloqet dhe ditët; te shabllonet `localized` emrat janë çelësa të katalogut. */
  program: Program
  source: TemplateSource
  localized: boolean
  /** "Progresi i zgjuar" i gjithë programit që merr kopja. */
  progression: ProgressionRule | null
  author: string | null
}

/** Interval përsëritjesh me RIR të synuar ("4 × 6–8 · RIR 2"). */
const rir = (min: number, max: number, target: number): Prescription => ({ type: 'rir', reps: { min, max }, rir: { min: target, max: target } })

/** [ID e bibliotekës, setet, pushimi, receta, receta te blloku i dytë kur ndryshon]. */
type SlotDef = [libraryId: string, sets: number, restSeconds: number, prescription: Prescription, second?: Prescription]

const SMART: ProgressionRule = { minRir: 2, incrementKg: 2.5 }

function build(id: TemplateId, blocks: [name: string, weeks: number][], days: [name: string, slots: SlotDef[]][]): Program {
  const slots: Slot[] = []
  const overrides: SlotOverride[] = []
  const blockIds = blocks.map((_, index) => `${id}-b${index + 1}`)
  days.forEach(([, defs], dayIndex) => {
    const dayId = `${id}-d${dayIndex + 1}`
    defs.forEach(([exerciseId, sets, restSeconds, prescription, second], position) => {
      const slotId = `${dayId}-s${position + 1}`
      slots.push({ id: slotId, dayId, position, exerciseId, sets, restSeconds })
      overrides.push({ slotId, blockId: null, week: null, prescription })
      if (second) overrides.push({ slotId, blockId: blockIds[1], week: null, prescription: second })
    })
  })
  return {
    id,
    blocks: blocks.map(([name, weeks], position) => ({ id: blockIds[position], position, name, weeks })),
    days: days.map(([name], position) => ({ id: `${id}-d${position + 1}`, position, name })),
    slots,
    overrides,
    exercises: {},
  }
}

// Full body 3 ditë, për fillestarë: tri ditë me tërë trupin, 8–12 përsëritje me 2–3 në rezervë te
// Bazat; te Forca ushtrimet kryesore zbresin në 6–8 (Bench Press 3 × 6–8 · RIR 2).
const FULL_BODY = build(
  'full_body_3',
  [
    ['base', 4],
    ['strength', 4],
  ],
  [
    [
      'fullA',
      [
        ['Goblet_Squat', 3, 120, rir(10, 12, 3), rir(8, 10, 2)],
        ['Dumbbell_Bench_Press', 3, 120, rir(10, 12, 2), rir(8, 10, 2)],
        ['Seated_Cable_Rows', 3, 90, rir(10, 12, 2)],
        ['Dumbbell_Shoulder_Press', 2, 90, rir(10, 12, 2)],
        ['Plank', 3, 60, { type: 'timed', seconds: 30 }],
      ],
    ],
    [
      'fullB',
      [
        ['Romanian_Deadlift', 3, 120, rir(10, 12, 3), rir(8, 10, 2)],
        ['Wide-Grip_Lat_Pulldown', 3, 90, rir(10, 12, 2)],
        ['Incline_Dumbbell_Press', 3, 90, rir(10, 12, 2)],
        ['Dumbbell_Lunges', 2, 90, rir(10, 12, 2)],
        ['Dumbbell_Bicep_Curl', 2, 60, rir(12, 15, 2)],
      ],
    ],
    [
      'fullC',
      [
        ['Leg_Press', 3, 120, rir(10, 12, 2), rir(8, 10, 2)],
        ['Barbell_Bench_Press_-_Medium_Grip', 3, 120, rir(8, 10, 2), rir(6, 8, 2)],
        ['One-Arm_Dumbbell_Row', 3, 90, rir(10, 12, 2)],
        ['Lying_Leg_Curls', 2, 60, rir(12, 15, 2)],
        ['Triceps_Pushdown', 2, 60, rir(12, 15, 2)],
        ['Cable_Crunch', 2, 60, rir(12, 15, 2)],
      ],
    ],
  ],
)

// Upper/Lower 4 ditë (bordi "Dita"): sipër dhe poshtë dy herë në javë. Te Forca ushtrimet kryesore
// zbresin te 4–6 me RIR 1; të tjerat mbeten.
const UPPER_LOWER = build(
  'upper_lower_4',
  [
    ['base', 4],
    ['strength', 4],
  ],
  [
    [
      'upperA',
      [
        ['Barbell_Bench_Press_-_Medium_Grip', 4, 150, rir(6, 8, 2), rir(4, 6, 1)],
        ['Wide-Grip_Lat_Pulldown', 4, 120, rir(8, 10, 2)],
        ['Incline_Dumbbell_Press', 3, 90, rir(8, 10, 2)],
        ['Seated_Cable_Rows', 3, 90, rir(10, 12, 2)],
        ['Side_Lateral_Raise', 3, 60, rir(12, 15, 1)],
        ['Dumbbell_Bicep_Curl', 3, 60, rir(10, 12, 1)],
      ],
    ],
    [
      'lowerA',
      [
        ['Barbell_Squat', 4, 180, rir(6, 8, 2), rir(4, 6, 1)],
        ['Romanian_Deadlift', 3, 150, rir(8, 10, 2)],
        ['Leg_Press', 3, 120, rir(10, 12, 2)],
        ['Lying_Leg_Curls', 3, 90, rir(10, 12, 1)],
        ['Standing_Calf_Raises', 4, 60, rir(12, 15, 1)],
      ],
    ],
    [
      'upperB',
      [
        ['Standing_Military_Press', 4, 150, rir(6, 8, 2), rir(4, 6, 1)],
        ['Bent_Over_Barbell_Row', 4, 150, rir(6, 8, 2), rir(4, 6, 1)],
        ['Dumbbell_Bench_Press', 3, 120, rir(8, 10, 2)],
        ['One-Arm_Dumbbell_Row', 3, 90, rir(10, 12, 2)],
        ['Triceps_Pushdown', 3, 60, rir(10, 12, 1)],
        ['Hammer_Curls', 3, 60, rir(10, 12, 1)],
      ],
    ],
    [
      'lowerB',
      [
        ['Barbell_Deadlift', 3, 180, rir(5, 6, 2), rir(3, 5, 1)],
        ['Dumbbell_Lunges', 3, 90, rir(8, 10, 2)],
        ['Leg_Extensions', 3, 60, rir(12, 15, 1)],
        ['Seated_Leg_Curl', 3, 60, rir(10, 12, 1)],
        ['Seated_Calf_Raise', 4, 60, rir(12, 15, 1)],
      ],
    ],
  ],
)

export const PROGRAM_TEMPLATES: ProgramTemplate[] = [
  {
    id: 'shortcut_to_size',
    program: SHORTCUT_TO_SIZE.program,
    source: { kind: 'defs', exercises: SHORTCUT_TO_SIZE.exercises },
    localized: false,
    progression: null,
    author: 'Jim Stoppani',
  },
  { id: 'full_body_3', program: FULL_BODY, source: { kind: 'library', tracking: { Plank: 'timed' } }, localized: true, progression: SMART, author: null },
  { id: 'upper_lower_4', program: UPPER_LOWER, source: { kind: 'library', tracking: {} }, localized: true, progression: SMART, author: null },
]

export const isTemplateId = (value: unknown): value is TemplateId => PROGRAM_TEMPLATES.some((template) => template.id === value)

export function templateById(id: TemplateId): ProgramTemplate {
  const template = PROGRAM_TEMPLATES.find((candidate) => candidate.id === id)
  if (!template) throw new Error(`Shablloni ${id} nuk ekziston.`)
  return template
}

/** Javët gjithsej dhe ditët në javë, për rreshtin e shabllonit ("8 javë · 4 ditë"). */
export function templateSummary(template: ProgramTemplate): { weeks: number; days: number } {
  return { weeks: template.program.blocks.reduce((sum, block) => sum + block.weeks, 0), days: template.program.days.length }
}
