import { planSession } from '@/program/engine'
import { type HistorySet, lastWeight, weightFor, type WeightProposal } from '@/program/loads'
import type { Equipment, Pointer, Program, Target } from '@/program/types'

// Peshat e javës (V23, SPEC §7): për një javë të programit, pesha e propozuar e çdo sloti me
// llogarinë që e jep. Përdoruesi i pranon të gjitha, ndryshon njërën ose i lë për më vonë (pesha e
// javës së kaluar mbetet); pa vendimin e tij asgjë nuk ndryshon.

export interface WeekRef {
  blockId: string
  week: number
}

export interface WeekWeightDecision {
  slotId: string
  exerciseId: string
  weightKg: number
  status: 'accepted' | 'changed' | 'postponed'
}

export interface WeekWeightsInput {
  program: Program
  week: WeekRef
  history: HistorySet[]
  now: Date
  overrides: Record<string, { oneRmKg: number; setAt: string }>
  steps: Partial<Record<Equipment, number>>
  decisions: WeekWeightDecision[]
  /**
   * Kur nisi seanca e parë e javës që shqyrtohet (null: ende asnjë). Rregulli i progresit krahason
   * javën e kaluar, ndaj lexon vetëm setet para saj: seanca e kësaj jave nuk i shton shtesën vetes.
   */
  weekStartedAt?: string | null
}

export interface WeekWeightRow {
  slotId: string
  dayId: string
  /** "Stërvitja N". */
  dayNumber: number
  exerciseId: string
  sets: number
  target: Target
  /** Pesha e fundit e përdorur për ushtrimin ("Herën e kaluar"). */
  previousKg: number | null
  proposal: WeightProposal
  decision: WeekWeightDecision | null
  /** Pesha që vlen për javën: vendimi i përdoruesit, ose propozimi kur s'ka vendim. */
  weightKg: number | null
}

const byPosition = <T extends { position: number }>(a: T, b: T) => a.position - b.position

/**
 * Java që shqyrton ekrani: e treguesit kur ai është te dita e parë (java e kaluar u mbyll), ose
 * java pas saj kur java e treguesit ka nisur.
 */
export function weekToReview(program: Program, pointer: Pointer): WeekRef | null {
  if (pointer.completed) return null
  const [firstDay] = [...program.days].sort(byPosition)
  if (pointer.dayId === firstDay?.id) return { blockId: pointer.blockId, week: pointer.week }
  const blocks = [...program.blocks].sort(byPosition)
  const index = blocks.findIndex((block) => block.id === pointer.blockId)
  if (pointer.week < blocks[index].weeks) return { blockId: pointer.blockId, week: pointer.week + 1 }
  const next = blocks[index + 1]
  return next ? { blockId: next.id, week: 1 } : null
}

/**
 * Peshat e reja që presin vendimin (rreshti "N pesha të reja presin vendimin" te Sot): rreshtat pa vendim
 * që kanë një propozim; po ata që "Prano peshat" do t'i pranonte (`acceptAll`), pa ato që ndryshoi përdoruesi.
 */
export function pendingWeights(rows: WeekWeightRow[]): number {
  return rows.filter((row) => !row.decision && row.proposal.weightKg !== null).length
}

const changed = (row: WeekWeightRow) => row.decision?.status === 'changed'

/** "Prano të gjitha": propozimi i çdo rreshti me peshë bëhet pesha e javës; ndryshimet e përdoruesit mbeten. */
export function acceptAll(rows: WeekWeightRow[]): WeekWeightDecision[] {
  return rows.flatMap((row) =>
    row.proposal.weightKg === null || changed(row)
      ? []
      : [{ slotId: row.slotId, exerciseId: row.exerciseId, weightKg: row.proposal.weightKg, status: 'accepted' as const }],
  )
}

/** "Më vonë": mbetet pesha e javës së kaluar ku ka një të tillë; propozimi pret. */
export function postpone(rows: WeekWeightRow[]): WeekWeightDecision[] {
  return rows.flatMap((row) =>
    row.previousKg === null || changed(row) ? [] : [{ slotId: row.slotId, exerciseId: row.exerciseId, weightKg: row.previousKg, status: 'postponed' as const }],
  )
}

const planOf = (program: Program, week: WeekRef, dayId: string) =>
  planSession(program, { run: 1, blockId: week.blockId, week: week.week, dayId, completed: false })

/** Java para kësaj në program (edhe në bllokun e mëparshëm), ose null te java e parë. */
function previousWeek(program: Program, week: WeekRef): WeekRef | null {
  if (week.week > 1) return { blockId: week.blockId, week: week.week - 1 }
  const blocks = [...program.blocks].sort(byPosition)
  const previous = blocks[blocks.findIndex((block) => block.id === week.blockId) - 1]
  return previous ? { blockId: previous.id, week: previous.weeks } : null
}

/** Kufiri i sipërm i intervalit të slotit në një javë; null kur s'ka interval përsëritjesh. */
function topReps(program: Program, week: WeekRef | null, dayId: string, slotId: string): number | null {
  if (!week) return null
  const target = planOf(program, week, dayId).slots.find((slot) => slot.slotId === slotId)?.target
  return target?.kind === 'reps' ? (target.max ?? target.min) : null
}

export function weekWeights(input: WeekWeightsInput): WeekWeightRow[] {
  const { program, week, history, now } = input
  const before = previousWeek(program, week)
  const startedAt = input.weekStartedAt
  const earlier = startedAt ? history.filter((set) => set.loggedAt < startedAt) : history
  return [...program.days].sort(byPosition).flatMap((day) => {
    const plan = planOf(program, week, day.id)
    const weighted = plan.slots.filter((slot) => program.exercises[slot.exerciseId]?.tracking === 'weight_reps')
    return weighted.map((slot) => {
      const exercise = program.exercises[slot.exerciseId]
      const proposal = weightFor({
        exerciseId: slot.exerciseId,
        target: slot.target,
        exercise,
        history,
        now,
        override: input.overrides[slot.exerciseId] ?? null,
        steps: input.steps,
        progression: slot.progression ? { rule: slot.progression, topReps: topReps(program, before, day.id, slot.slotId), history: earlier } : null,
      })
      // Një vendim vlen vetëm për ushtrimin për të cilin u mor (editori mund ta ketë ndërruar).
      const decision = input.decisions.find((candidate) => candidate.slotId === slot.slotId && candidate.exerciseId === slot.exerciseId) ?? null
      return {
        slotId: slot.slotId,
        dayId: day.id,
        dayNumber: plan.dayNumber,
        exerciseId: slot.exerciseId,
        sets: slot.sets,
        target: slot.target,
        previousKg: lastWeight(history, slot.exerciseId),
        proposal,
        decision,
        weightKg: decision ? decision.weightKg : proposal.weightKg,
      }
    })
  })
}
