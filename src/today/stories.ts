import { safeStorage } from '@/lib/safe-storage'

// Rrathët e story-ve te Sot (V57, SPEC §0.3f), pa UI: radha dhe gjendja "e shikuar". Radha: "Si ndihesh?" (deri sa
// gjendja e ditës të plotësohet), pastaj të pashikuarat, pastaj të shikuarat; "Gati N%" e fundit pas plotësimit.
// "E shikuar" ruhet vetëm në telefon, për ditën e ushqimit (V46): një ditë tjetër fillon me unaza të pashikuara.

export type StoryKind = 'checkin' | 'week' | 'mentor' | 'ready'

export interface Story {
  kind: StoryKind
  /** Çelësi i qëndrueshëm për "e shikuar": lloji, me javën ose shënimin kur ka. */
  key: string
  seen: boolean
  /** Gatishmëria, për "Gati N%". */
  percent?: number
  /** Shënimi i mentorit. */
  noteId?: string
  /** E hëna e javës që përmbledh "Java jote". */
  monday?: string
}

export interface StoryInput {
  /** Gjendja e ditës është plotësuar. */
  checkedIn: boolean
  /** "Jo sot": unaza e "Si ndihesh?" del e shikuar, por rrethi mbetet. */
  skipped: boolean
  percent: number | null
  /** Shënimi i mentorit i kësaj jave ose seance (V55); null kur nuk ka. */
  mentor: { id: string } | null
  /** E hëna e javës që përmbledh "Java jote" (e diela 20:00 deri të hënën në fund); null jashtë saj. */
  weekMonday: string | null
  seen: ReadonlySet<string>
}

export function storyRing(input: StoryInput): Story[] {
  const middle: Story[] = []
  if (input.weekMonday) middle.push({ kind: 'week', key: `week:${input.weekMonday}`, seen: input.seen.has(`week:${input.weekMonday}`), monday: input.weekMonday })
  if (input.mentor) middle.push({ kind: 'mentor', key: `mentor:${input.mentor.id}`, seen: input.seen.has(`mentor:${input.mentor.id}`), noteId: input.mentor.id })
  const ordered = [...middle.filter((story) => !story.seen), ...middle.filter((story) => story.seen)]
  const ring: Story[] = []
  if (!input.checkedIn) ring.push({ kind: 'checkin', key: 'checkin', seen: input.skipped })
  ring.push(...ordered)
  if (input.checkedIn && input.percent !== null) ring.push({ kind: 'ready', key: 'ready', seen: input.seen.has('ready'), percent: input.percent })
  return ring
}

// --- Të shikuarat në telefon ---

const KEY = 'vrull.stories.seen'
const listeners = new Set<() => void>()

interface Stored {
  date: string
  ids: string[]
}

function read(): Stored | null {
  try {
    const value = JSON.parse(safeStorage.getItem(KEY) ?? 'null') as Partial<Stored> | null
    return value && typeof value.date === 'string' && Array.isArray(value.ids) ? { date: value.date, ids: value.ids.filter((id): id is string => typeof id === 'string') } : null
  } catch {
    return null
  }
}

export function readSeenStories(date: string): Set<string> {
  const stored = read()
  return new Set(stored?.date === date ? stored.ids : [])
}

export function markStorySeen(date: string, key: string): void {
  const seen = readSeenStories(date)
  if (seen.has(key)) return
  seen.add(key)
  safeStorage.setItem(KEY, JSON.stringify({ date, ids: [...seen] }))
  for (const listener of [...listeners]) listener()
}

export function subscribeSeenStories(listener: () => void): () => void {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}
