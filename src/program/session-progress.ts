import type { PlannedSlot, SessionPlan } from './types'

export interface SlotProgress {
  slot: PlannedSlot
  done: number
}

export interface SessionProgress {
  slots: SlotProgress[]
  /** Ushtrimi në ekran; null kur të gjitha setet janë bërë. */
  current: number | null
  /** Ushtrimi pas të tanishmit që ka ende sete. */
  next: number | null
  doneSets: number
  totalSets: number
}

/** Ku jemi në seancë: setet e bëra për çdo ushtrim, ushtrimi në ekran dhe ai që vjen pas. */
export function sessionProgress(
  plan: SessionPlan,
  sets: { slotId: string | null }[],
  selectedSlotId?: string | null,
): SessionProgress {
  const slots = plan.slots.map((slot) => ({
    slot,
    done: Math.min(slot.sets, sets.filter((set) => set.slotId === slot.slotId).length),
  }))
  const open = (index: number) => slots[index].done < slots[index].slot.sets
  const selected = slots.findIndex((entry) => entry.slot.slotId === selectedSlotId)
  const first = slots.findIndex((_, index) => open(index))
  const current = selected >= 0 && open(selected) ? selected : first >= 0 ? first : null
  let next: number | null = null
  if (current !== null) {
    for (let step = 1; step < slots.length; step++) {
      const index = (current + step) % slots.length
      if (open(index)) {
        next = index
        break
      }
    }
  }
  return {
    slots,
    current,
    next,
    doneSets: slots.reduce((total, entry) => total + entry.done, 0),
    totalSets: slots.reduce((total, entry) => total + entry.slot.sets, 0),
  }
}
