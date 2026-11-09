import type { MealKey } from '@/nutrition/meals'
import type { ReminderActionId } from '@/reminders/plan'
import { logTemplateMeal, setDayType } from './nutrition'
import type { LocalStore } from './store'
import { addWater } from './water'

// Butonat te rikujtuesit (V37, V2-E2-08): telefoni i ruan në një radhë native (RemindersPlugin) edhe
// kur app-i fle ose është mbyllur; app-i i zbaton këtu sapo hapet ose kthehet, një herë secilin.
// "Kthe mbrapsht" heq rreshtat që krijoi veprimi; çfarë krijoi çdo veprim mbahet te `AppliedLog`.

export interface QueuedReminderAction {
  /** Id e prekjes, e vetme. */
  id: string
  action: ReminderActionId | 'undo'
  key: string
  data: { date: string; meal?: MealKey; supplementIds?: string[]; ml?: number } | null
  /** Për "undo": prekja që kthehet. */
  target?: string
}

/** Rreshtat që krijoi një veprim, për "Kthe mbrapsht". */
export interface AppliedRecord {
  diary: string[]
  supplements: string[]
  water: string[]
}

export interface AppliedLog {
  get(id: string): AppliedRecord | undefined
  set(id: string, record: AppliedRecord): void
  delete(id: string): void
}

const EMPTY: AppliedRecord = { diary: [], supplements: [], water: [] }

async function takeSupplements(store: LocalStore, date: string, meal: MealKey, ids: readonly string[]) {
  const logs = await store.where('supplement_logs', 'date', date)
  const created: string[] = []
  for (const supplementId of ids) {
    if (logs.some((row) => row.supplement_id === supplementId && row.timing === meal)) continue
    const row = await store.put('supplement_logs', { date, supplement_id: supplementId, timing: meal, taken_at: store.now().toISOString() })
    created.push(row.id)
  }
  return created
}

/** Zbaton veprimet me radhë dhe kthen id-të që mund të hiqen nga radha native. */
export async function applyReminderActions(store: LocalStore, actions: readonly QueuedReminderAction[], applied: AppliedLog): Promise<string[]> {
  const handled: string[] = []
  for (const entry of actions) {
    // Një veprim i zbatuar më parë (app-i u mbyll para se ta hiqte nga radha) nuk përsëritet.
    if (applied.get(entry.id)) {
      handled.push(entry.id)
      continue
    }
    const data = entry.data
    const record: AppliedRecord = { diary: [], supplements: [], water: [] }
    if (entry.action === 'undo') {
      const target = entry.target ? applied.get(entry.target) : undefined
      if (target) {
        for (const id of target.diary) await store.remove('diary_entries', id)
        for (const id of target.supplements) await store.remove('supplement_logs', id)
        for (const id of target.water) await store.remove('water_logs', id)
        applied.set(entry.target!, EMPTY)
      }
    } else if (data) {
      if (entry.action === 'ate' && data.meal) {
        // "Si në plan" nuk regjistron dy herë një vakt që u regjistrua ndërkohë te app-i.
        const existing = (await store.where('diary_entries', 'date', data.date)).filter((row) => row.meal === data.meal)
        if (existing.length === 0) record.diary = await logTemplateMeal(store, data.date, data.meal)
        record.supplements = await takeSupplements(store, data.date, data.meal, data.supplementIds ?? [])
      } else if (entry.action === 'took' && data.meal) {
        record.supplements = await takeSupplements(store, data.date, data.meal, data.supplementIds ?? [])
      } else if (entry.action === 'drank') {
        record.water = [await addWater(store, data.date, store.now(), data.ml)]
      } else if (entry.action === 'yes' || entry.action === 'no') {
        await setDayType(store, data.date, entry.action === 'yes' ? 'training' : 'rest')
      }
    }
    applied.set(entry.id, record)
    handled.push(entry.id)
  }
  return handled
}

/** `AppliedLog` në kujtesë (provat) ose mbi një ruajtje të thjeshtë (telefoni). */
export function appliedLog(storage?: Pick<Storage, 'getItem' | 'setItem'>, key = 'vrull.reminderActions', keep = 100): AppliedLog {
  const read = (): [string, AppliedRecord][] => {
    try {
      return JSON.parse(storage?.getItem(key) ?? '[]') as [string, AppliedRecord][]
    } catch {
      return []
    }
  }
  let memory: [string, AppliedRecord][] = storage ? read() : []
  const save = () => {
    memory = memory.slice(-keep)
    try {
      storage?.setItem(key, JSON.stringify(memory))
    } catch {
      // Pa ruajtje: veprimet mbeten të zbatuara një herë brenda kësaj hapjeje.
    }
  }
  return {
    get: (id) => (storage ? read() : memory).find(([entry]) => entry === id)?.[1],
    set: (id, record) => {
      if (storage) memory = read()
      memory = [...memory.filter(([entry]) => entry !== id), [id, record]]
      save()
    },
    delete: (id) => {
      if (storage) memory = read()
      memory = memory.filter(([entry]) => entry !== id)
      save()
    },
  }
}
