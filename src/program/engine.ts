import type { ExerciseInfo, Pointer, Prescription, Program, SessionPlan, SlotOverride, Target, Technique } from './types'

const byPosition = <T extends { position: number }>(a: T, b: T) => a.position - b.position

/**
 * Vlera e një fushe për slotin në këtë bllok dhe javë: fiton rreshti më i saktë që e ka fushën
 * (blloku dhe java > vetëm blloku > vetëm java > i gjithë programi).
 */
function resolve<K extends keyof SlotOverride>(
  overrides: SlotOverride[],
  slotId: string,
  pointer: Pointer,
  field: K,
): NonNullable<SlotOverride[K]> | undefined {
  let best: SlotOverride | undefined
  let bestScore = -1
  for (const row of overrides) {
    if (row.slotId !== slotId || row[field] === null || row[field] === undefined) continue
    if (row.blockId !== null && row.blockId !== pointer.blockId) continue
    if (row.week !== null && row.week !== pointer.week) continue
    const score = (row.blockId === null ? 0 : 2) + (row.week === null ? 0 : 1)
    if (score > bestScore) {
      best = row
      bestScore = score
    }
  }
  return best?.[field] as NonNullable<SlotOverride[K]> | undefined
}

const cycle = <T>(items: T[], week: number) => items[(week - 1) % items.length]

function targetFor(prescription: Prescription | undefined, week: number): Target {
  if (prescription?.type === 'rep_ladder') {
    const range = cycle(prescription.ladder, week)
    return { kind: 'reps', min: range.min, max: range.max, beyond: Boolean(range.beyond) }
  }
  if (prescription?.type === 'timed') return { kind: 'timed', seconds: prescription.seconds }
  if (prescription?.type === 'percent_1rm') {
    const step = cycle(prescription.weeks, week)
    return { kind: 'percent_1rm', percent: step.percent, reps: step.reps, amrap: Boolean(step.amrap) }
  }
  if (prescription?.type === 'rir') {
    const { reps, rir } = prescription
    return { kind: 'reps', min: reps.min, max: reps.max, beyond: Boolean(reps.beyond), rir }
  }
  if (prescription?.type === 'rpe') {
    const { reps, rpe } = prescription
    return { kind: 'reps', min: reps.min, max: reps.max, beyond: Boolean(reps.beyond), rpe }
  }
  if (prescription?.type === 'linear') {
    const { startKg, incrementKg, reps, failuresBeforeDeload, deloadPercent } = prescription
    return { kind: 'linear', reps, startKg, incrementKg, failuresBeforeDeload, deloadPercent }
  }
  return { kind: 'reps', min: 0, max: null, beyond: false }
}

/**
 * Teknika e setit të fundit pas rregullave të §5: jo për kohën; drop set-i pa peshë bëhet
 * rest-pause, përveç llastikut (drop set-i bëhet me llastikun më të lehtë).
 */
function techniqueFor(technique: Technique | undefined, target: Target, exercise: ExerciseInfo | undefined): Technique {
  if (!technique || target.kind === 'timed') return { type: 'none' }
  if (technique.type === 'drop_set' && exercise?.tracking === 'bodyweight_reps' && exercise.equipment !== 'band') {
    return { type: 'rest_pause' }
  }
  return technique
}

export function planSession(program: Program, pointer: Pointer): SessionPlan {
  const block = program.blocks.find((candidate) => candidate.id === pointer.blockId)
  const day = program.days.find((candidate) => candidate.id === pointer.dayId)
  if (!block || !day) throw new Error('Treguesi i programit nuk gjen bllokun ose ditën.')
  const days = [...program.days].sort(byPosition)
  const slots = program.slots.filter((slot) => slot.dayId === day.id).sort(byPosition)
  return {
    run: pointer.run,
    blockId: block.id,
    blockName: block.name,
    blockPosition: block.position,
    week: pointer.week,
    blockWeeks: block.weeks,
    dayId: day.id,
    dayName: day.name,
    dayNumber: days.indexOf(day) + 1,
    slots: slots.map((slot) => {
      const field = <K extends keyof SlotOverride>(name: K) => resolve(program.overrides, slot.id, pointer, name)
      const prescription = field('prescription')
      const exerciseId = field('exerciseId') ?? slot.exerciseId
      const target = targetFor(prescription, pointer.week)
      return {
        slotId: slot.id,
        position: slot.position,
        exerciseId,
        sets: field('sets') ?? slot.sets,
        restSeconds: field('restSeconds') ?? slot.restSeconds,
        target,
        technique: techniqueFor(field('technique'), target, program.exercises[exerciseId]),
        ...(prescription?.type === 'rep_ladder' && prescription.blockIncreaseKg
          ? { blockIncreaseKg: prescription.blockIncreaseKg }
          : {}),
      }
    }),
  }
}

/** Treguesi pas mbylljes (ose kapërcimit) të stërvitjes së radhës. Pas të fundit: "Përfunduar". */
export function advance(program: Program, pointer: Pointer): Pointer {
  if (pointer.completed) return pointer
  const days = [...program.days].sort(byPosition)
  const blocks = [...program.blocks].sort(byPosition)
  const dayIndex = days.findIndex((day) => day.id === pointer.dayId)
  if (dayIndex + 1 < days.length) return { ...pointer, dayId: days[dayIndex + 1].id }
  const blockIndex = blocks.findIndex((block) => block.id === pointer.blockId)
  if (pointer.week < blocks[blockIndex].weeks) return { ...pointer, week: pointer.week + 1, dayId: days[0].id }
  if (blockIndex + 1 < blocks.length) return { ...pointer, blockId: blocks[blockIndex + 1].id, week: 1, dayId: days[0].id }
  return { ...pointer, completed: true }
}

/** Rinisja e programit nga një bllok (Shortcut to Size: nga Faza 1), si xhiro e re. */
export function restart(program: Program, pointer: Pointer, blockId: string): Pointer {
  const [firstDay] = [...program.days].sort(byPosition)
  return { run: pointer.run + 1, blockId, week: 1, dayId: firstDay.id, completed: false }
}

/** "Java 0" për një bllok me një javë; "Faza 1 · Java 2" për të tjerët. */
export function blockWeekLabel(plan: Pick<SessionPlan, 'blockName' | 'blockWeeks' | 'week'>): string {
  return plan.blockWeeks === 1 ? plan.blockName : `${plan.blockName} · Java ${plan.week}`
}
