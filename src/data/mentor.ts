import { shiftDate } from '@/lib/calendar'
import type { LocalStore } from './store'
import type { LocalRow } from './tables'

// Shënimet e mentorit te Sot (V55, V57): i shkruan vetëm mentori (Claude me lidhjen e Supabase-it të pronarit);
// telefoni vetëm i lexon. Rrethi "Mentori" del kur ka një shënim të kësaj jave kalendarike (raporti i së hënës,
// plani i së dielës) ose të një seance të saj (komenti pas seancës). Shënimet e provës dhe përgjigjet e ruajtura të
// panelit nuk dalin këtu.

export type MentorKind = 'raport_javor' | 'plani_javes' | 'komenti_seances'

export interface MentorNote {
  id: string
  kind: MentorKind
  title: string
  body: string
  steps: string[]
  sources: { label: string; url: string | null }[]
  /** "Mëso": mësimi i shkurtër i shënimit (P4, P11), kur ka. */
  learnTitle: string | null
  learnBody: string | null
  createdAt: string
}

const KINDS: readonly string[] = ['raport_javor', 'plani_javes', 'komenti_seances']

const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.length > 0) : [])

function toNote(row: LocalRow): MentorNote {
  const sources = Array.isArray(row.sources) ? (row.sources as { label?: unknown; url?: unknown }[]) : []
  return {
    id: row.id,
    kind: row.kind as MentorKind,
    title: String(row.title ?? ''),
    body: String(row.body ?? ''),
    steps: strings(row.steps),
    sources: sources.filter((source) => typeof source?.label === 'string').map((source) => ({ label: source.label as string, url: typeof source.url === 'string' ? source.url : null })),
    learnTitle: typeof row.learn_title === 'string' ? row.learn_title : null,
    learnBody: typeof row.learn_body === 'string' ? row.learn_body : null,
    createdAt: String(row.created_at ?? ''),
  }
}

/** Shënimet e javës kalendarike që nis të hënën `monday` (raporti, plani, komentet e seancave të saj), më i riu i pari. */
export async function mentorNotes(store: LocalStore, monday: string): Promise<MentorNote[]> {
  const sunday = shiftDate(monday, 6)
  const [rows, sessions] = await Promise.all([store.all('mentor_notes'), store.all('workout_sessions')])
  const sessionDates = new Map(sessions.map((session) => [session.id, String(session.date).slice(0, 10)]))
  return rows
    .filter((row) => {
      if (!KINDS.includes(String(row.kind))) return false
      if (row.kind === 'komenti_seances') {
        const date = sessionDates.get(String(row.session_id))
        return !!date && date >= monday && date <= sunday
      }
      return typeof row.period_start === 'string' && String(row.period_start).slice(0, 10) === monday
    })
    .sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')))
    .map(toNote)
}

/** Shënimi që tregon rrethi "Mentori": më i riu i javës; null kur s'ka (rrethi nuk del). */
export async function mentorNoteFor(store: LocalStore, monday: string): Promise<MentorNote | null> {
  return (await mentorNotes(store, monday))[0] ?? null
}
