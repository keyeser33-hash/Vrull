// Modeli i programit (SPEC §4): blloqe me javë, ditë që përsëriten çdo javë, slote me radhë.
// Një slot ka vlerat e veta; rreshtat e `slot_prescriptions` i ndryshojnë për një bllok,
// për një javë ose për të dyja. Recetat dhe teknikat ruhen si JSON te Supabase.

export interface RepRange {
  min: number
  /** null: pa kufi të sipërm. */
  max: number | null
  /** "Deri në dështim nëse mund më shumë" (barku te Shortcut to Size). */
  beyond?: boolean
}

export type Prescription =
  /** Interval përsëritjesh sipas javës në bllok: java 1 → ladder[0], java 5 → ladder[0] përsëri. */
  | { type: 'rep_ladder'; ladder: RepRange[]; blockIncreaseKg?: { min: number; max: number } }
  | { type: 'timed'; seconds: number }
  | { type: 'percent_1rm'; weeks: { percent: number; reps: number; amrap?: boolean }[] }
  | {
      type: 'linear'
      startKg: number
      incrementKg: number
      reps: number
      /** Pas kaq seancash radhazi pa i mbyllur përsëritjet, pesha ulet. */
      failuresBeforeDeload: number
      deloadPercent: number
    }
  | { type: 'rpe'; reps: RepRange; rpe: number }
  | { type: 'rir'; reps: RepRange; rir: { min: number; max: number } }

export type Technique =
  | { type: 'none' }
  /** Deri në dështim, pushim i shkurtër, përsëri deri në dështim (parazgjedhje 15 s). */
  | { type: 'rest_pause'; restSeconds?: number }
  /** Pesha e drop-it: ajo e javës 1 të bllokut për këtë ushtrim, ose një përqindje e setit. */
  | { type: 'drop_set'; percent?: number }
  | { type: 'to_failure' }

export type Tracking = 'weight_reps' | 'bodyweight_reps' | 'timed'

export type Equipment = 'barbell' | 'ez_bar' | 'dumbbell' | 'cable' | 'machine' | 'bodyweight' | 'kettlebell' | 'band' | 'other'

export interface ExerciseInfo {
  tracking: Tracking
  equipment: Equipment
}

export interface Block {
  id: string
  position: number
  name: string
  weeks: number
}

export interface Day {
  id: string
  position: number
  name: string
}

export interface Slot {
  id: string
  dayId: string
  position: number
  exerciseId: string
  sets: number
  restSeconds: number
}

/** Një ndryshim për slotin: vlen për bllokun, javën, ose të dyja (null = çdo bllok, çdo javë). */
export interface SlotOverride {
  slotId: string
  blockId: string | null
  week: number | null
  exerciseId?: string | null
  sets?: number | null
  restSeconds?: number | null
  prescription?: Prescription | null
  technique?: Technique | null
}

export interface Program {
  id: string
  blocks: Block[]
  days: Day[]
  slots: Slot[]
  overrides: SlotOverride[]
  /** Si regjistrohet çdo ushtrim (pesha, pesha e trupit, koha) dhe me çfarë pajisje. */
  exercises: Record<string, ExerciseInfo>
}

/** Treguesi "stërvitja e radhës": blloku, java brenda bllokut, dita. */
export interface Pointer {
  run: number
  blockId: string
  week: number
  dayId: string
  completed: boolean
}

export type Target =
  | { kind: 'reps'; min: number; max: number | null; beyond: boolean; rir?: { min: number; max: number }; rpe?: number }
  | { kind: 'timed'; seconds: number }
  | { kind: 'percent_1rm'; percent: number; reps: number; amrap: boolean }
  | {
      kind: 'linear'
      reps: number
      startKg: number
      incrementKg: number
      failuresBeforeDeload: number
      deloadPercent: number
    }

export interface PlannedSlot {
  slotId: string
  position: number
  exerciseId: string
  sets: number
  restSeconds: number
  target: Target
  /** Teknika e setit të fundit. */
  technique: Technique
  /** Shtesa e peshës kundrejt së njëjtës javë të bllokut të kaluar, kur programi e ka. */
  blockIncreaseKg?: { min: number; max: number }
}

export interface SessionPlan {
  run: number
  blockId: string
  blockName: string
  blockPosition: number
  /** Java brenda bllokut, nga 1. */
  week: number
  blockWeeks: number
  dayId: string
  dayName: string
  /** Numri i ditës në javë, nga 1 ("Stërvitja 3"). */
  dayNumber: number
  slots: PlannedSlot[]
}
