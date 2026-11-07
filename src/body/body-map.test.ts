import type { HistorySet } from '@/program/loads'
import { MUSCLE_GROUPS } from '@/program/muscles'
import { allRecovery, libraryExercisesFor, LOAD_LEVELS, loadLevel, muscleLoad } from './body-map'
import { KEY_NAMES, MUSCLE_INFO } from './muscle-info'

let counter = 0
const set = (exerciseId: string, loggedAt: string, extra: Partial<HistorySet> = {}): HistorySet => ({
  id: `s${++counter}`,
  exerciseId,
  sessionId: loggedAt.slice(0, 10),
  run: 1,
  blockPosition: 1,
  blockName: 'Faza 1',
  blockWeeks: 4,
  week: 1,
  setNumber: 1,
  weightKg: 60,
  reps: 10,
  rir: null,
  isWarmup: false,
  loggedAt,
  ...extra,
})

const group = (id: string) => MUSCLE_GROUPS.find((entry) => entry.id === id)!

describe('harta e muskujve', () => {
  it('ngarkesa e javës: kryesori 1, ndihmësi 0,5; ngrohja dhe javët e tjera nuk numërohen', () => {
    const primary = { bench: ['pectoralis_major_sternocostal'], row: ['latissimus_dorsi'] }
    const secondary = { bench: ['triceps_brachii', 'deltoid_anterior'], row: ['biceps_brachii'] }
    const sets = [
      set('bench', '2026-12-07T18:10:00'),
      set('bench', '2026-12-07T18:12:00'),
      set('bench', '2026-12-07T18:00:00', { isWarmup: true }),
      set('row', '2026-12-08T18:10:00'),
      set('row', '2026-12-01T18:10:00'),
    ]
    const load = muscleLoad(sets, primary, secondary, MUSCLE_GROUPS, new Date('2026-12-09T12:00:00'))
    expect(load.get('gjoksi')).toBe(2)
    expect(load.get('tricepsi')).toBe(1)
    expect(load.get('shpatullat')).toBe(1)
    expect(load.get('shpina')).toBe(1)
    expect(load.get('bicepsi')).toBe(0.5)
    expect(load.get('pulpat')).toBe(0)
  })

  it('nivelet me fjalë: 0, 1–5, 6–11, 12 e më shumë sete', () => {
    expect([0, 0.5, 5.5, 6, 11.5, 12, 20].map(loadLevel)).toEqual([0, 1, 1, 2, 2, 3, 3])
    expect(LOAD_LEVELS.map((level) => level.label)).toEqual(['Pa sete', '1–5 sete', '6–11 sete', '12+ sete'])
  })

  it('rikuperimi i çdo grupi sipas seancës së fundit ku ishte kryesor', () => {
    const recovery = allRecovery(
      MUSCLE_GROUPS,
      [
        { endedAt: '2026-12-08T19:00:00Z', primaryKeys: ['pectoralis_major_sternocostal'] },
        { endedAt: '2026-12-06T19:00:00Z', primaryKeys: ['latissimus_dorsi'] },
      ],
      new Date('2026-12-09T19:00:00Z'),
    )
    expect(recovery.get('gjoksi')).toMatchObject({ status: 'i_lodhur', hours: 24 })
    expect(recovery.get('shpina')).toMatchObject({ status: 'pothuajse_gati', hours: 72 })
    expect(recovery.get('pulpat')).toMatchObject({ status: 'gati', hours: null })
    expect(group('gjoksi').name).toBe('Gjoksi')
  })

  it('çdo grup ka emrin latinisht dhe funksionin me një fjali', () => {
    for (const entry of MUSCLE_GROUPS) {
      expect(MUSCLE_INFO[entry.id], entry.id).toMatchObject({ latin: expect.any(String), role: expect.stringMatching(/\.$/) })
    }
  })

  it('çdo çelës i grupeve ka emrin e vet për fokusin te modeli 3D', () => {
    expect(Object.keys(KEY_NAMES).sort()).toEqual(MUSCLE_GROUPS.flatMap((entry) => entry.keys).sort())
  })

  it('ushtrimet e bibliotekës për një grup: ku grupi është kryesor', () => {
    const library = [
      { id: 'a', name: 'Calf Raise', equipment: 'machine' as const, primary: ['calves'], secondary: [] },
      { id: 'b', name: 'Bench Press', equipment: 'barbell' as const, primary: ['chest'], secondary: ['triceps'] },
      { id: 'c', name: 'Box Jump', equipment: 'bodyweight' as const, primary: ['quadriceps'], secondary: ['calves'] },
    ]
    expect(libraryExercisesFor(library, group('pulpat')).map((exercise) => exercise.name)).toEqual(['Calf Raise'])
  })
})
