import { programOverview } from './overview'
import type { Pointer, Program } from './types'

const program: Program = {
  id: 'p',
  blocks: [
    { id: 'b1', position: 1, name: 'Faza 1', weeks: 2 },
    { id: 'b0', position: 0, name: 'Java 0', weeks: 1 },
  ],
  days: [
    { id: 'd2', position: 1, name: 'Shpinë' },
    { id: 'd1', position: 0, name: 'Gjoks' },
  ],
  slots: [],
  overrides: [],
  exercises: {},
}
const at = (blockId: string, week: number, dayId: string, completed = false): Pointer => ({ run: 1, blockId, week, dayId, completed })
const statuses = (overview: ReturnType<typeof programOverview>) => overview.weeks.map((week) => [week.short, ...week.days.map((day) => day.status)])

describe('pamja e programit', () => {
  it('javët me radhë, me emrat e plotë dhe të shkurtër, dhe ditët me numrin e tyre', () => {
    const overview = programOverview(program, at('b0', 1, 'd1'), [])
    expect(overview.weeks.map((week) => [week.label, week.short])).toEqual([
      ['Java 0', 'J0'],
      ['Faza 1 · Java 1', 'F1·J1'],
      ['Faza 1 · Java 2', 'F1·J2'],
    ])
    expect(overview.weeks[0].days.map((day) => [day.dayNumber, day.name])).toEqual([
      [1, 'Gjoks'],
      [2, 'Shpinë'],
    ])
    expect(overview).toMatchObject({ currentWeek: 0, doneWorkouts: 0, totalWorkouts: 6 })
  })

  it('gjendja e çdo stërvitjeje nga seancat e xhiros së tanishme dhe treguesi', () => {
    const overview = programOverview(program, at('b1', 1, 'd2'), [
      { run: 1, blockId: 'b0', week: 1, dayId: 'd1', status: 'completed' },
      { run: 1, blockId: 'b0', week: 1, dayId: 'd2', status: 'skipped' },
      { run: 1, blockId: 'b1', week: 1, dayId: 'd1', status: 'completed' },
      { run: 0, blockId: 'b1', week: 2, dayId: 'd1', status: 'completed' },
      { run: 1, blockId: 'b1', week: 1, dayId: 'd2', status: 'in_progress' },
    ])
    expect(statuses(overview)).toEqual([
      ['J0', 'done', 'skipped'],
      ['F1·J1', 'done', 'next'],
      ['F1·J2', 'upcoming', 'upcoming'],
    ])
    expect(overview).toMatchObject({ currentWeek: 1, doneWorkouts: 2 })
  })

  it('pas rinisjes, stërvitjet para bllokut të rinisjes nuk janë pjesë e xhiros', () => {
    const overview = programOverview(program, { ...at('b1', 1, 'd1'), run: 2 }, [])
    expect(statuses(overview)[0]).toEqual(['J0', 'skipped', 'skipped'])
    expect(overview.doneWorkouts).toBe(0)
  })

  it('programi i përfunduar: asnjë "e radhës"', () => {
    const overview = programOverview(program, at('b1', 2, 'd2', true), [{ run: 1, blockId: 'b1', week: 2, dayId: 'd2', status: 'completed' }])
    expect(statuses(overview)[2]).toEqual(['F1·J2', 'skipped', 'done'])
  })
})
