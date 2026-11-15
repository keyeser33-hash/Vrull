import type { Equipment, Prescription, Program, RepRange, Slot, SlotOverride, Tracking } from './types'

// Jim Stoppani's 12-Week Shortcut to Size si të dhëna (SPEC §5, Shtojcat A, B dhe E), me Javën 0
// para Fazës 1. Ushtrimi i një sloti mund të ndryshojë sipas fazës (Shtojca A) ose sipas javës
// (barku, Shtojca B); rreshtat e ndryshimeve ndjekin modelin e §4 dhe i lexon motori i programit.

export interface ExerciseDef {
  /** Çelësi i qëndrueshëm brenda programit: emri anglisht, si në PDF. */
  id: string
  name: string
  equipment: Equipment
  tracking: Tracking
  primary: string[]
  secondary: string[]
  /** ID-ja te free-exercise-db, kur ushtrimi ekziston aty me të njëjtën lëvizje. */
  libraryId: string | null
}

type Def = [name: string, equipment: Equipment, primary: string, secondary: string, libraryId?: string, tracking?: Tracking]

const QUADS = 'rectus_femoris vastus_lateralis vastus_medialis'
const HAMSTRINGS = 'biceps_femoris semitendinosus semimembranosus'
const ABS_TO_OBLIQUE: [string, string] = ['rectus_abdominis', 'external_oblique']
const OBLIQUE_TO_ABS: [string, string] = ['external_oblique', 'rectus_abdominis']

// Muskujt sipas Shtojcës E; equipment dhe tracking sipas mënyrës si bëhet ushtrimi te PDF-ja.
const DEFS: Def[] = [
  ['Bench Press', 'barbell', 'pectoralis_major_sternocostal', 'pectoralis_major_clavicular deltoid_anterior triceps_brachii', 'Barbell_Bench_Press_-_Medium_Grip'],
  ['Incline Bench Press', 'barbell', 'pectoralis_major_clavicular', 'deltoid_anterior triceps_brachii pectoralis_major_sternocostal', 'Barbell_Incline_Bench_Press_-_Medium_Grip'],
  ['Incline Dumbbell Press', 'dumbbell', 'pectoralis_major_clavicular', 'deltoid_anterior triceps_brachii pectoralis_major_sternocostal', 'Incline_Dumbbell_Press'],
  ['Reverse-Grip Incline Dumbbell Press', 'dumbbell', 'pectoralis_major_clavicular', 'triceps_brachii deltoid_anterior'],
  ['Incline Dumbbell Flye', 'dumbbell', 'pectoralis_major_clavicular', 'deltoid_anterior', 'Incline_Dumbbell_Flyes'],
  ['Incline Cable Flye', 'cable', 'pectoralis_major_clavicular', 'deltoid_anterior', 'Incline_Cable_Flye'],
  ['Dumbbell Flye', 'dumbbell', 'pectoralis_major_sternocostal', 'pectoralis_major_clavicular deltoid_anterior', 'Dumbbell_Flyes'],
  ['Cable Crossover', 'cable', 'pectoralis_major_sternocostal', 'pectoralis_minor deltoid_anterior', 'Cable_Crossover'],
  ['Close-Grip Bench Press', 'barbell', 'triceps_brachii', 'pectoralis_major_sternocostal deltoid_anterior', 'Close-Grip_Barbell_Bench_Press'],
  ['Triceps Pressdown', 'cable', 'triceps_brachii', '', 'Triceps_Pushdown'],
  ['Lying Triceps Extension', 'ez_bar', 'triceps_brachii', '', 'Lying_Triceps_Press'],
  ['Cable Lying Triceps Extension', 'cable', 'triceps_brachii', '', 'Cable_Lying_Triceps_Extension'],
  ['Cable Overhead Triceps Extension', 'cable', 'triceps_brachii', '', 'Cable_Rope_Overhead_Triceps_Extension'],
  ['Dumbbell Overhead Triceps Extension', 'dumbbell', 'triceps_brachii', '', 'Standing_Dumbbell_Triceps_Extension'],
  ['Cable Triceps Extension', 'cable', 'triceps_brachii', ''],
  ['Standing Calf Raise', 'machine', 'gastrocnemius', 'soleus', 'Standing_Calf_Raises'],
  ['Leg Press Calf Raise', 'machine', 'gastrocnemius', 'soleus', 'Calf_Press_On_The_Leg_Press_Machine'],
  ['Seated Calf Raise', 'machine', 'soleus', 'gastrocnemius', 'Seated_Calf_Raise'],
  ['Dumbbell Bent-Over Row', 'dumbbell', 'latissimus_dorsi rhomboid_major', 'trapezius teres_major deltoid_posterior biceps_brachii erector_spinae', 'Bent_Over_Two-Dumbbell_Row'],
  ['Seated Cable Row', 'cable', 'latissimus_dorsi rhomboid_major', 'trapezius deltoid_posterior biceps_brachii', 'Seated_Cable_Rows'],
  ['Wide-Grip Pulldown', 'cable', 'latissimus_dorsi', 'teres_major rhomboid_major biceps_brachii', 'Wide-Grip_Lat_Pulldown'],
  ['Behind-Neck Pulldown', 'cable', 'latissimus_dorsi', 'teres_major rhomboid_major biceps_brachii', 'Wide-Grip_Pulldown_Behind_The_Neck'],
  ['Reverse-Grip Pulldown', 'cable', 'latissimus_dorsi', 'biceps_brachii teres_major', 'Underhand_Cable_Pulldowns'],
  ['Standing Pulldown', 'cable', 'latissimus_dorsi', 'biceps_brachii teres_major'],
  ['Straight-Arm Pulldown', 'cable', 'latissimus_dorsi', 'teres_major triceps_brachii', 'Straight-Arm_Pulldown'],
  ['Barbell Curl', 'barbell', 'biceps_brachii', 'brachialis brachioradialis', 'Barbell_Curl'],
  ['Preacher Curl', 'ez_bar', 'biceps_brachii brachialis', 'brachioradialis', 'Preacher_Curl'],
  ['Dumbbell Incline Curl', 'dumbbell', 'biceps_brachii', 'brachialis', 'Incline_Dumbbell_Curl'],
  ['Incline Cable Curl', 'cable', 'biceps_brachii', 'brachialis'],
  ['One-Arm High Cable Curl', 'cable', 'biceps_brachii', 'brachialis'],
  ['Behind-Back Cable Curl', 'cable', 'biceps_brachii', 'brachialis'],
  ['Dumbbell Concentration Curl', 'dumbbell', 'biceps_brachii', 'brachialis', 'Concentration_Curls'],
  ['Dumbbell Shoulder Press', 'dumbbell', 'deltoid_anterior deltoid_lateral', 'triceps_brachii trapezius', 'Dumbbell_Shoulder_Press'],
  ['Dumbbell Lateral Raise', 'dumbbell', 'deltoid_lateral', 'trapezius', 'Side_Lateral_Raise'],
  ['One-Arm Cable Lateral Raise', 'cable', 'deltoid_lateral', 'trapezius'],
  ['One-Arm Cable Front Raise', 'cable', 'deltoid_anterior', 'pectoralis_major_clavicular'],
  ['High Cable Rear Delt Fly', 'cable', 'deltoid_posterior', 'rhomboid_major trapezius infraspinatus', 'Cable_Rear_Delt_Fly'],
  ['Bent-Over Lateral Raise', 'dumbbell', 'deltoid_posterior', 'rhomboid_major trapezius infraspinatus'],
  ['Smith Machine Upright Row', 'machine', 'deltoid_lateral trapezius', 'deltoid_anterior biceps_brachii', 'Smith_Machine_Upright_Row'],
  ['Dumbbell Upright Row', 'dumbbell', 'deltoid_lateral trapezius', 'deltoid_anterior biceps_brachii', 'Standing_Dumbbell_Upright_Row'],
  ['Dumbbell Shrug', 'dumbbell', 'trapezius', '', 'Dumbbell_Shrug'],
  ['Barbell Shrug', 'barbell', 'trapezius', '', 'Barbell_Shrug'],
  ['One-Arm Smith Machine Shrug', 'machine', 'trapezius', ''],
  ['Squat', 'barbell', `${QUADS} gluteus_maximus`, 'adductor_magnus erector_spinae biceps_femoris', 'Barbell_Squat'],
  ['Front Squat', 'barbell', QUADS, 'gluteus_maximus erector_spinae rectus_abdominis', 'Front_Barbell_Squat'],
  ['Leg Press', 'machine', QUADS, 'gluteus_maximus adductor_magnus', 'Leg_Press'],
  ['One-Leg Leg Press', 'machine', QUADS, 'gluteus_maximus adductor_magnus'],
  ['Leg Extension', 'machine', QUADS, '', 'Leg_Extensions'],
  ['Romanian Deadlift', 'barbell', `${HAMSTRINGS} gluteus_maximus`, 'erector_spinae adductor_magnus', 'Romanian_Deadlift'],
  ['Lying Leg Curl', 'machine', HAMSTRINGS, 'gastrocnemius', 'Lying_Leg_Curls'],
  ['Seated Leg Curl', 'machine', HAMSTRINGS, 'gastrocnemius', 'Seated_Leg_Curl'],
  // Hip Thrust i barkut: ngritje e legenit e shtrirë në shpinë, jo hip thrust-i i gluteve (§5).
  ['Hip Thrust', 'bodyweight', ...ABS_TO_OBLIQUE, undefined, 'bodyweight_reps'],
  ['Weighted Hip Thrust', 'other', ...ABS_TO_OBLIQUE],
  ['Smith Machine Hip Thrust', 'machine', ...ABS_TO_OBLIQUE, 'Smith_Machine_Hip_Raise'],
  ['Crunch', 'bodyweight', ...ABS_TO_OBLIQUE, 'Crunches', 'bodyweight_reps'],
  ['Weighted Crunch', 'other', ...ABS_TO_OBLIQUE, 'Weighted_Crunches'],
  ['Cable Crunch', 'cable', ...ABS_TO_OBLIQUE, 'Cable_Crunch'],
  ['Machine Crunch', 'machine', ...ABS_TO_OBLIQUE, 'Ab_Crunch_Machine'],
  ['Hanging Leg Raise', 'bodyweight', ...ABS_TO_OBLIQUE, 'Hanging_Leg_Raise', 'bodyweight_reps'],
  ['Plank', 'bodyweight', ...ABS_TO_OBLIQUE, 'Plank', 'timed'],
  ['Oblique Crunch', 'bodyweight', ...OBLIQUE_TO_ABS, 'Oblique_Crunches', 'bodyweight_reps'],
  ['Cable Oblique Crunch', 'cable', ...OBLIQUE_TO_ABS],
  ['Cable Woodchopper', 'cable', ...OBLIQUE_TO_ABS],
  ['Band Roundhouse Elbow', 'band', ...OBLIQUE_TO_ABS, undefined, 'bodyweight_reps'],
  ['Dumbbell Side Bend', 'dumbbell', 'external_oblique', 'erector_spinae', 'Dumbbell_Side_Bend'],
  ['Side Plank', 'bodyweight', 'external_oblique', 'gluteus_medius rectus_abdominis', 'Side_Bridge', 'timed'],
]

const keys = (text: string) => (text ? text.split(' ') : [])

const EXERCISES: ExerciseDef[] = DEFS.map(([name, equipment, primary, secondary, libraryId, tracking]) => ({
  id: name,
  name,
  equipment,
  tracking: tracking ?? 'weight_reps',
  primary: keys(primary),
  secondary: keys(secondary),
  libraryId: libraryId ?? null,
}))

// Shkallët e përsëritjeve, java 1 → 4 e çdo faze (§5).
const INCREASE = { min: 2.5, max: 9 }
const range = (min: number, max: number, beyond = false): RepRange => (beyond ? { min, max, beyond } : { min, max })
const LADDERS: Record<'main' | 'calves' | 'abs', Prescription> = {
  main: { type: 'rep_ladder', ladder: [range(12, 15), range(9, 11), range(6, 8), range(3, 5)], blockIncreaseKg: INCREASE },
  calves: { type: 'rep_ladder', ladder: [range(25, 30), range(15, 20), range(10, 14), range(6, 9)], blockIncreaseKg: INCREASE },
  abs: { type: 'rep_ladder', ladder: [range(20, 30, true), range(15, 19), range(10, 14), range(6, 9)], blockIncreaseKg: INCREASE },
}
// Java 0: intervali i javës 1, pa rest-pause dhe pa dështim, me 2–3 përsëritje në rezervë.
const JAVA_0_RIR = { min: 2, max: 3 }
const java0 = (group: 'main' | 'calves' | 'abs'): Prescription => {
  const [first] = (LADDERS[group] as Extract<Prescription, { type: 'rep_ladder' }>).ladder
  return { type: 'rir', reps: { min: first.min, max: first.max }, rir: JAVA_0_RIR }
}

type Group = 'main' | 'calves'
/** [setet, grupi, Faza 1, Faza 2, Faza 3]; një emër i vetëm = i njëjti në të tri fazat. */
type SlotDef = [sets: number, group: Group, ...phases: string[]]
const DAYS: { name: string; slots: SlotDef[]; abs?: string[][] }[] = [
  {
    name: 'Gjoks, triceps, pulpa',
    slots: [
      [4, 'main', 'Bench Press'],
      [3, 'main', 'Incline Bench Press', 'Incline Dumbbell Press', 'Reverse-Grip Incline Dumbbell Press'],
      [3, 'main', 'Incline Dumbbell Flye', 'Dumbbell Flye', 'Incline Dumbbell Flye'],
      [3, 'main', 'Cable Crossover', 'Incline Cable Flye', 'Cable Crossover'],
      [3, 'main', 'Triceps Pressdown'],
      [3, 'main', 'Lying Triceps Extension', 'Dumbbell Overhead Triceps Extension', 'Cable Triceps Extension'],
      [3, 'main', 'Cable Overhead Triceps Extension', 'Cable Lying Triceps Extension', 'Close-Grip Bench Press'],
      [4, 'calves', 'Standing Calf Raise'],
      [4, 'calves', 'Seated Calf Raise'],
    ],
  },
  {
    name: 'Shpinë, biceps, bark',
    slots: [
      [4, 'main', 'Dumbbell Bent-Over Row'],
      [3, 'main', 'Wide-Grip Pulldown', 'Behind-Neck Pulldown', 'Wide-Grip Pulldown'],
      [3, 'main', 'Standing Pulldown', 'Seated Cable Row', 'Straight-Arm Pulldown'],
      [3, 'main', 'Straight-Arm Pulldown', 'Reverse-Grip Pulldown', 'Seated Cable Row'],
      [4, 'main', 'Barbell Curl'],
      [3, 'main', 'Dumbbell Incline Curl', 'Preacher Curl', 'Incline Cable Curl'],
      [3, 'main', 'One-Arm High Cable Curl', 'Behind-Back Cable Curl', 'Dumbbell Concentration Curl'],
    ],
    // Shtojca B: një rresht për javë, tre slote barku.
    abs: [
      ['Hip Thrust', 'Crunch', 'Oblique Crunch'],
      ['Hanging Leg Raise', 'Weighted Crunch', 'Dumbbell Side Bend'],
      ['Weighted Hip Thrust', 'Cable Crunch', 'Cable Oblique Crunch'],
      ['Smith Machine Hip Thrust', 'Machine Crunch', 'Band Roundhouse Elbow'],
    ],
  },
  {
    name: 'Shpatulla, trapez, pulpa',
    slots: [
      [4, 'main', 'Dumbbell Shoulder Press'],
      [3, 'main', 'Dumbbell Lateral Raise', 'Smith Machine Upright Row', 'Dumbbell Lateral Raise'],
      [3, 'main', 'One-Arm Cable Front Raise', 'One-Arm Cable Lateral Raise', 'Dumbbell Upright Row'],
      [3, 'main', 'High Cable Rear Delt Fly', 'Bent-Over Lateral Raise', 'Bent-Over Lateral Raise'],
      [4, 'main', 'Dumbbell Shrug', 'Barbell Shrug', 'One-Arm Smith Machine Shrug'],
      [4, 'calves', 'Seated Calf Raise'],
      [4, 'calves', 'Leg Press Calf Raise'],
    ],
  },
  {
    name: 'Këmbë, bark',
    slots: [
      [4, 'main', 'Squat'],
      [3, 'main', 'One-Leg Leg Press', 'Front Squat', 'Leg Press'],
      [3, 'main', 'Leg Extension'],
      [4, 'main', 'Romanian Deadlift'],
      [3, 'main', 'Lying Leg Curl', 'Seated Leg Curl', 'Lying Leg Curl'],
    ],
    abs: [
      ['Hip Thrust', 'Crunch', 'Plank'],
      ['Hanging Leg Raise', 'Weighted Crunch', 'Side Plank'],
      ['Weighted Hip Thrust', 'Cable Crunch', 'Cable Woodchopper'],
      ['Smith Machine Hip Thrust', 'Machine Crunch', 'Plank'],
    ],
  },
]

// Plank dhe Side Plank: sekondat sipas fazës dhe javës (Shtojca B). Java 0: 60 s.
const PLANK_SECONDS: Record<number, number[]> = { 1: [60, 60, 0, 75], 2: [75, 75, 0, 90], 3: [90, 90, 0, 105] }
const TIMED = new Set(EXERCISES.filter((exercise) => exercise.tracking === 'timed').map((exercise) => exercise.name))

const REST = { main: 90, calves: 60, abs: 60 }
const BLOCKS = [
  { id: 'java-0', position: 0, name: 'Java 0', weeks: 1 },
  { id: 'faza-1', position: 1, name: 'Faza 1', weeks: 4 },
  { id: 'faza-2', position: 2, name: 'Faza 2', weeks: 4 },
  { id: 'faza-3', position: 3, name: 'Faza 3', weeks: 4 },
]
const [JAVA_0, ...PHASES] = BLOCKS

/** Teknika e setit të fundit: rest-pause javët 1–2, drop set javët 3–4; asnjë te Java 0. */
function techniqueRows(slotId: string): SlotOverride[] {
  return [1, 2, 3, 4].map((week) => ({
    slotId,
    blockId: null,
    week,
    technique: week <= 2 ? { type: 'rest_pause' } : { type: 'drop_set' },
  }))
}

function build(): Program {
  const slots: Slot[] = []
  const overrides: SlotOverride[] = []
  DAYS.forEach((day, dayIndex) => {
    const dayId = `dita-${dayIndex + 1}`
    day.slots.forEach(([sets, group, first, ...later], position) => {
      const id = `${dayId}-slot-${position + 1}`
      slots.push({ id, dayId, position, exerciseId: first, sets, restSeconds: REST[group] })
      overrides.push({ slotId: id, blockId: null, week: null, prescription: LADDERS[group] }, ...techniqueRows(id))
      overrides.push({ slotId: id, blockId: JAVA_0.id, week: null, sets: sets === 4 ? 3 : 2, prescription: java0(group), technique: { type: 'none' } })
      later.forEach((name, index) => {
        if (name !== first) overrides.push({ slotId: id, blockId: PHASES[index + 1].id, week: null, exerciseId: name })
      })
    })
    day.abs?.[0].forEach((_, absIndex) => {
      const position = day.slots.length + absIndex
      const id = `${dayId}-slot-${position + 1}`
      const byWeek = day.abs!.map((names) => names[absIndex])
      slots.push({ id, dayId, position, exerciseId: byWeek[0], sets: 3, restSeconds: REST.abs })
      overrides.push({ slotId: id, blockId: null, week: null, prescription: LADDERS.abs }, ...techniqueRows(id))
      byWeek.forEach((name, weekIndex) => {
        if (weekIndex > 0) overrides.push({ slotId: id, blockId: null, week: weekIndex + 1, exerciseId: name })
        if (!TIMED.has(name)) return
        PHASES.forEach((phase) => {
          const seconds = PLANK_SECONDS[phase.position][weekIndex]
          overrides.push({ slotId: id, blockId: phase.id, week: weekIndex + 1, prescription: { type: 'timed', seconds } })
        })
      })
      overrides.push({
        slotId: id,
        blockId: JAVA_0.id,
        week: null,
        sets: 2,
        prescription: TIMED.has(byWeek[0]) ? { type: 'timed', seconds: 60 } : java0('abs'),
        technique: { type: 'none' },
      })
    })
  })
  return {
    id: 'shortcut-to-size',
    blocks: BLOCKS,
    days: DAYS.map((day, index) => ({ id: `dita-${index + 1}`, position: index, name: day.name })),
    slots,
    overrides,
    exercises: Object.fromEntries(EXERCISES.map((exercise) => [exercise.id, exercise])),
  }
}

/** Emrat që u ndryshuan për të ndjekur PDF-në, [i vjetri, i ri] (V62; data/training.ts › renameShortcutExercises). */
export const SHORTCUT_RENAMES: readonly (readonly [string, string])[] = [['One-Arm Overhead Cable Triceps Extension', 'Cable Triceps Extension']]

export const SHORTCUT_TO_SIZE = { name: 'Shortcut to Size', program: build(), exercises: EXERCISES }
