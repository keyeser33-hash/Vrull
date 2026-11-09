import type { MutableKind, ReminderKind } from './plan'

// Heshtja vetë (V37, SPEC §13): një lloj rikujtuesi që injorohet 3 ditë rresht hesht vetë. Një ditë
// është e injoruar kur atë ditë erdhi të paktën një njoftim i atij lloji dhe asnjë nuk u prek (as
// buton, as hapje), dhe asnjë nga ato që erdhën nuk u regjistrua atë ditë. Pa UI dhe pa bazë.

export const MUTE_AFTER_DAYS = 3

/** Një njoftim që u shfaq, siç e mban telefoni (RemindersPlugin.log). */
export interface ReminderLogEntry {
  key: string
  kind: ReminderKind
  date: string
  /** U prek: një buton ose hapja e app-it nga njoftimi. */
  acted: boolean
}

const KINDS: readonly MutableKind[] = ['meal', 'supplements', 'water']

const previous = (date: string) => {
  const day = new Date(`${date}T12:00:00`)
  day.setDate(day.getDate() - 1)
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
}

/** Sa ditë rresht, deri dje, është injoruar çdo lloj; `since`: dita nga e cila numërohet (pas "Ndize përsëri"). */
export function ignoredStreaks(
  log: readonly ReminderLogEntry[],
  isLogged: (entry: ReminderLogEntry) => boolean,
  today: string,
  since: Partial<Record<MutableKind, string>> = {},
): Record<MutableKind, number> {
  const result = { meal: 0, supplements: 0, water: 0 }
  for (const kind of KINDS) {
    for (let date = previous(today); !since[kind] || date >= since[kind]!; date = previous(date)) {
      const entries = log.filter((entry) => entry.kind === kind && entry.date === date)
      if (entries.length === 0 || entries.some((entry) => entry.acted || isLogged(entry))) break
      result[kind] += 1
      if (result[kind] >= 30) break
    }
  }
  return result
}
