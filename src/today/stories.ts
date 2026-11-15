import type { LocalStore } from '@/data/store'

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
  /** "Jo sot": unaza e "Si ndihesh?" del e shikuar, por rrethi mbetet (njësoj kur story mbyllet pa u plotësuar). */
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
  if (!input.checkedIn) ring.push({ kind: 'checkin', key: 'checkin', seen: input.skipped || input.seen.has('checkin') })
  ring.push(...ordered)
  if (input.checkedIn && input.percent !== null) ring.push({ kind: 'ready', key: 'ready', seen: input.seen.has('ready'), percent: input.percent })
  return ring
}

// --- Të shikuarat në telefon ---

const SEEN_KEY = 'stories-seen'

interface Stored {
  date: string
  ids: string[]
}

/** Çelësat e story-ve të shikuara në datën e dhënë (dita e ushqimit); një ditë tjetër fillon bosh. */
export async function readSeenStories(store: LocalStore, date: string): Promise<Set<string>> {
  const value = (await store.readDevice(SEEN_KEY)) as Partial<Stored> | undefined
  const valid = !!value && value.date === date && Array.isArray(value.ids)
  return new Set(valid ? (value.ids as unknown[]).filter((id): id is string => typeof id === 'string') : [])
}

/** Shënon një story si të shikuar për ditën; dëgjuesit e store-it e marrin (`DEVICE_TABLE`). */
export async function markStorySeen(store: LocalStore, date: string, key: string): Promise<void> {
  const seen = await readSeenStories(store, date)
  if (seen.has(key)) return
  seen.add(key)
  await store.writeDevice(SEEN_KEY, { date, ids: [...seen] } satisfies Stored)
}
