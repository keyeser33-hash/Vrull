import type { WeekGoalsView } from '@/data/weekly-goals'

// Pikat e rripit të javës te Sot (V57, SPEC §0.3f): tri pika nën çdo datë, sipas rregullave të qëllimeve të V43
// që i ka `weekGoalsView`: stërvitja (vetëm në ditët e stërvitjes, ose kur u bë një seancë), ushqimi (të paktën
// 60% e kalorive të ditës) dhe uji (objektivi i plotë). Pa pikë për ditët që vijnë; sot pikat janë të gjalla.

/** on: dita e arriti; off: jo (ende); null: pa pikë (nuk vlen për atë ditë). */
export type DotState = 'on' | 'off' | null

export interface DayDots {
  training: DotState
  food: DotState
  water: DotState
}

export type DotsInput = Pick<WeekGoalsView, 'foodToday' | 'food' | 'water'> & { training: Pick<WeekGoalsView['training'], 'days'> }

/** Pikat e një dite të javës; null për ditët që vijnë (sipas ditës së ushqimit, V46) dhe për një datë jashtë javës. */
export function dayDots(goals: DotsInput, date: string): DayDots | null {
  const training = goals.training.days.find((day) => day.date === date)
  if (!training || date > goals.foodToday) return null
  const intake = (goal: DotsInput['food']): DotState => {
    const day = goal?.days.find((candidate) => candidate.date === date)
    if (!day || day.state === 'none') return null
    return day.state === 'counted' ? 'on' : 'off'
  }
  const done = training.state === 'done' || training.state === 'spare'
  return {
    training: done ? 'on' : training.training ? 'off' : null,
    food: intake(goals.food),
    water: intake(goals.water),
  }
}
