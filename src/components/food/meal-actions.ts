import { removeDiaryEntry } from '@/data/nutrition'
import type { LocalStore } from '@/data/store'
import type { MealKey } from '@/nutrition/meals'

// Veprimet që shtojnë regjistrime te një vakt ("Si në plan", "Si dje") me "Zhbëj": krahasohen
// regjistrimet e vaktit para dhe pas, që zhbërja të heqë vetëm ato që krijoi veprimi.

export async function logWithUndo(store: LocalStore, date: string, meal: MealKey, action: () => Promise<unknown>): Promise<{ kcal: number; undo: () => Promise<void> }> {
  const idsOf = async () => (await store.where('diary_entries', 'date', date)).filter((row) => row.meal === meal)
  const before = new Set((await idsOf()).map((row) => row.id))
  await action()
  const created = (await idsOf()).filter((row) => !before.has(row.id))
  return {
    kcal: created.reduce((sum, row) => sum + Number(row.kcal ?? 0), 0),
    undo: async () => {
      for (const row of created) await removeDiaryEntry(store, row.id)
    },
  }
}
