import { localDate } from '@/lib/calendar'
import type { MissedInput } from '@/program/missed-day'
import { isMissed } from '@/program/missed-day'
import { setDayType } from './nutrition'
import { readProfile } from './profile'
import { settingsRow } from './settings-row'
import type { LocalStore } from './store'

// Dita e humbur (V38, V2-E2-09) në bazë: ditët e stërvitjes nga hapat e para, seancat (të bëra, të
// kapërcyera ose të hapura) dhe llojet e ditëve të zgjedhura me dorë. "Po" dhe "Jo" ruhen si lloji i
// ditës së sotme (`setDayType`), si ndërrimi me dorë te Ushqimi, që objektivat, vaktet dhe
// rikujtuesit ta ndjekin vetë.

const dayAfter = (date: Date) => localDate(new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1))

export async function readMissedInput(store: LocalStore): Promise<MissedInput> {
  const [profile, settings, sessions, targets] = await Promise.all([readProfile(store), settingsRow(store), store.all('workout_sessions'), store.all('nutrition_targets')])
  return {
    trainingDays: profile.trainingDays,
    // Dita e hapave të para nuk numërohet: kush instalon në mbrëmje një ditë stërvitjeje nuk e ka humbur atë.
    startedOn: typeof settings?.onboarded_at === 'string' ? dayAfter(new Date(settings.onboarded_at)) : null,
    sessionDates: sessions.map((row) => String(row.date).slice(0, 10)),
    dayTypes: Object.fromEntries(targets.filter((row) => row.is_manual).map((row) => [String(row.date).slice(0, 10), row.day_type === 'training' ? 'training' : 'rest'])),
  }
}

/**
 * Dita e parë e humbur pas seancës së fundit, brenda 7 ditëve: kur stërvitja e radhës duhej bërë
 * (Programi e thotë te stërvitja e radhës). Null kur nuk ka.
 */
export function firstMissedSinceLastSession(input: MissedInput, today: string): string | null {
  const last = [...input.sessionDates].filter((date) => date <= today).sort().at(-1) ?? null
  for (let offset = 7; offset >= 1; offset--) {
    const day = new Date(`${today}T12:00:00`)
    day.setDate(day.getDate() - offset)
    const date = localDate(day)
    if ((last === null || date > last) && isMissed(input, date, today)) return date
  }
  return null
}

/** "Po": sot bëhet ditë stërvitjeje (objektivat, vaktet rreth stërvitjes); "Jo": mbetet pushim. */
export async function answerMissedDay(store: LocalStore, train: boolean) {
  await setDayType(store, localDate(store.now()), train ? 'training' : 'rest')
}
