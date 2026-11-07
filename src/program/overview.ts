import type { Pointer, Program } from './types'

export type DayStatus = 'done' | 'skipped' | 'next' | 'upcoming'

export interface OverviewDay {
  dayId: string
  dayNumber: number
  name: string
  status: DayStatus
}

export interface OverviewWeek {
  blockId: string
  blockName: string
  blockPosition: number
  week: number
  /** "Java 0", "Faza 1 · Java 2" */
  label: string
  /** "J0", "F1·J2": për butonat e javëve. */
  short: string
  days: OverviewDay[]
}

export interface ProgramOverview {
  weeks: OverviewWeek[]
  /** Java ku është treguesi (indeks te `weeks`). */
  currentWeek: number
  doneWorkouts: number
  totalWorkouts: number
}

export interface SessionMark {
  run: number
  blockId: string
  week: number
  dayId: string
  status: 'in_progress' | 'completed' | 'skipped'
}

const byPosition = <T extends { position: number }>(a: T, b: T) => a.position - b.position

/** "Java 0" → "J0", "Faza 1" → "F1": shkronja e parë dhe numri i emrit. */
const abbreviation = (name: string) => `${name.trim().charAt(0).toUpperCase()}${name.replace(/\D+/g, '')}`

/**
 * E gjithë xhiroja e programit javë pas jave (SPEC §4): çfarë u bë, çfarë u kapërcye, cila
 * është e radha. Vlejnë vetëm seancat e xhiros së tanishme; stërvitjet para treguesit pa seancë
 * (p.sh. Java 0 pas rinisjes nga Faza 1) llogariten si të kapërcyera.
 */
export function programOverview(program: Program, pointer: Pointer, sessions: SessionMark[]): ProgramOverview {
  const blocks = [...program.blocks].sort(byPosition)
  const days = [...program.days].sort(byPosition)
  const mine = sessions.filter((session) => session.run === pointer.run)
  const statusOf = (blockId: string, week: number, dayId: string) =>
    mine.filter((session) => session.blockId === blockId && session.week === week && session.dayId === dayId).map((session) => session.status)

  const weeks: OverviewWeek[] = []
  let order = 0
  let pointerOrder = -1
  let currentWeek = 0
  for (const block of blocks) {
    for (let week = 1; week <= block.weeks; week++) {
      const entry: OverviewWeek = {
        blockId: block.id,
        blockName: block.name,
        blockPosition: block.position,
        week,
        label: block.weeks === 1 ? block.name : `${block.name} · Java ${week}`,
        short: block.weeks === 1 ? abbreviation(block.name) : `${abbreviation(block.name)}·J${week}`,
        days: [],
      }
      for (const [index, day] of days.entries()) {
        if (block.id === pointer.blockId && week === pointer.week && day.id === pointer.dayId) {
          pointerOrder = order
          currentWeek = weeks.length
        }
        entry.days.push({ dayId: day.id, dayNumber: index + 1, name: day.name, status: 'upcoming' })
        order++
      }
      weeks.push(entry)
    }
  }

  let doneWorkouts = 0
  order = 0
  for (const week of weeks) {
    for (const day of week.days) {
      const marks = statusOf(week.blockId, week.week, day.dayId)
      if (marks.includes('completed')) {
        day.status = 'done'
        doneWorkouts++
      } else if (order === pointerOrder && !pointer.completed) day.status = 'next'
      else if (marks.includes('skipped') || order < pointerOrder || (pointer.completed && order <= pointerOrder)) day.status = 'skipped'
      order++
    }
  }
  return { weeks, currentWeek, doneWorkouts, totalWorkouts: order }
}
