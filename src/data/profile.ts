import type { LocalStore } from './store'
import type { LocalRow } from './tables'

// Profili i stërvitjes (SPEC §3a): pesha, ditët dhe ora e stërvitjes, zgjimi dhe gjumi,
// programi aktiv. Hyrja e parë i vendos; Cilësimet i ndryshojnë.

export interface Profile {
  weightKg: number | null
  /** Ditët ISO: 1 = e hënë ... 7 = e diel. */
  trainingDays: number[]
  trainingTime: string
  wakeTime: string
  sleepTime: string
}

export const DEFAULT_PROFILE: Profile = {
  weightKg: null,
  trainingDays: [1, 2, 4, 5],
  trainingTime: '18:00',
  wakeTime: '07:00',
  sleepTime: '23:00',
}

// Skeleti i Shortcut to Size (SPEC §4, Shtojca A). Ushtrimet dhe slotet i shton TH-07.
const STS_NAME = 'Shortcut to Size'
const STS_BLOCKS = [
  { name: 'Java 0', weeks: 1 },
  { name: 'Faza 1', weeks: 4 },
  { name: 'Faza 2', weeks: 4 },
  { name: 'Faza 3', weeks: 4 },
]
const STS_DAYS = ['Gjoks, triceps, pulpa', 'Shpinë, biceps, bark', 'Shpatulla, trapez, pulpa', 'Këmbë, bark']

/** Data lokale e telefonit (YYYY-MM-DD), që një vakt pas mesnate të mos kalojë në ditën e gabuar. */
export function localDate(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Pesha në kg nga teksti i përdoruesit ("80,5" ose "80.5"), ose null kur nuk vlen (30–300 kg). */
export function parseWeight(text: string): number | null {
  const normalized = text.trim().replace(',', '.')
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(normalized)) return null
  const value = Number(normalized)
  return value >= 30 && value <= 300 ? value : null
}

export function isTime(text: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(text)
}

const byPosition = (a: LocalRow, b: LocalRow) => Number(a.position) - Number(b.position)

async function settingsRow(store: LocalStore) {
  return (await store.all('user_settings'))[0]
}

async function saveTodayWeight(store: LocalStore, weightKg: number, now: () => Date) {
  const date = localDate(now())
  const [existing] = await store.where('body_measurements', 'date', date)
  await store.put('body_measurements', { id: existing?.id, date, weight_kg: weightKg })
}

const timesFor = (days: number[], time: string) => Object.fromEntries(days.map((day) => [String(day), time]))

/** Krijon programin Shortcut to Size, nëse nuk ekziston, dhe treguesin e tij te Java 0 · Stërvitja 1. */
async function ensureShortcutToSize(store: LocalStore) {
  const existing = (await store.all('programs')).find((program) => program.source === 'shortcut_to_size')
  const program = existing ?? (await store.put('programs', { name: STS_NAME, source: 'shortcut_to_size' }))

  let blocks = (await store.where('program_blocks', 'program_id', program.id)).sort(byPosition)
  if (blocks.length === 0) {
    blocks = []
    for (const [position, block] of STS_BLOCKS.entries()) {
      blocks.push(await store.put('program_blocks', { program_id: program.id, position, ...block }))
    }
  }
  let days = (await store.where('program_days', 'program_id', program.id)).sort(byPosition)
  if (days.length === 0) {
    days = []
    for (const [position, name] of STS_DAYS.entries()) {
      days.push(await store.put('program_days', { program_id: program.id, position, name }))
    }
  }
  const [state] = await store.where('program_state', 'program_id', program.id)
  if (!state) {
    await store.put('program_state', { program_id: program.id, run: 1, block_id: blocks[0].id, week: 1, day_id: days[0].id })
  }
  return program
}

export async function completeOnboarding(
  store: LocalStore,
  profile: Omit<Profile, 'weightKg'> & { weightKg: number },
  now: () => Date = () => new Date(),
) {
  const program = await ensureShortcutToSize(store)
  await saveTodayWeight(store, profile.weightKg, now)
  const existing = await settingsRow(store)
  await store.put('user_settings', {
    id: existing?.id,
    training_days: profile.trainingDays,
    training_times: timesFor(profile.trainingDays, profile.trainingTime),
    wake_time: profile.wakeTime,
    sleep_time: profile.sleepTime,
    active_program_id: program.id,
    onboarded_at: existing?.onboarded_at ?? now().toISOString(),
  })
}

export async function readProfile(store: LocalStore): Promise<Profile> {
  const settings = await settingsRow(store)
  const measurements = (await store.all('body_measurements'))
    .filter((row) => row.weight_kg !== null && row.weight_kg !== undefined)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
  const days = (settings?.training_days as number[] | undefined) ?? DEFAULT_PROFILE.trainingDays
  const times = (settings?.training_times as Record<string, string> | undefined) ?? {}
  return {
    weightKg: measurements[0] ? Number(measurements[0].weight_kg) : null,
    trainingDays: days,
    trainingTime: times[String(days[0])] ?? DEFAULT_PROFILE.trainingTime,
    wakeTime: (settings?.wake_time as string | undefined)?.slice(0, 5) ?? DEFAULT_PROFILE.wakeTime,
    sleepTime: (settings?.sleep_time as string | undefined)?.slice(0, 5) ?? DEFAULT_PROFILE.sleepTime,
  }
}

/** Ndryshon një ose më shumë vlera; ora e stërvitjes vlen për çdo ditë stërvitjeje. */
export async function updateProfile(store: LocalStore, patch: Partial<Profile>, now: () => Date = () => new Date()) {
  if (patch.weightKg !== undefined && patch.weightKg !== null) await saveTodayWeight(store, patch.weightKg, now)
  const settings = await settingsRow(store)
  if (!settings) return
  const current = await readProfile(store)
  const days = patch.trainingDays ?? current.trainingDays
  const time = patch.trainingTime ?? current.trainingTime
  await store.put('user_settings', {
    id: settings.id,
    training_days: days,
    training_times: timesFor(days, time),
    wake_time: patch.wakeTime ?? current.wakeTime,
    sleep_time: patch.sleepTime ?? current.sleepTime,
  })
}

/** "Java 0 · Stërvitja 1" për Java 0; "Faza 1 · Java 2 · Stërvitja 3" për fazat. */
export async function nextWorkout(store: LocalStore): Promise<{ label: string; dayName: string } | null> {
  const settings = await settingsRow(store)
  const programId = settings?.active_program_id as string | undefined
  if (!programId) return null
  const [state] = await store.where('program_state', 'program_id', programId)
  if (!state?.block_id || !state.day_id) return null
  const block = await store.get('program_blocks', String(state.block_id))
  const day = await store.get('program_days', String(state.day_id))
  if (!block || !day) return null
  const blockLabel = Number(block.weeks) === 1 ? String(block.name) : `${block.name} · Java ${state.week}`
  return { label: `${blockLabel} · Stërvitja ${Number(day.position) + 1}`, dayName: String(day.name) }
}
