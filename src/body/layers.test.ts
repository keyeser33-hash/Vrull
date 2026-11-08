import { DEEP_ENTRIES, DEEP_MUSCLES, deepEntry, ghostKeys, programRoles } from './layers'
import { MUSCLE_GROUPS } from '@/program/muscles'

describe('shtresat e modelit 3D', () => {
  it('çdo muskul i thellë dhe çdo mbulesë është çelës i modelit; asnjë mbulesë nuk është vetë e thellë', () => {
    const keys = new Set(MUSCLE_GROUPS.flatMap((group) => group.keys))
    const deep = new Set(DEEP_MUSCLES.map((muscle) => muscle.key))
    for (const muscle of DEEP_MUSCLES) {
      expect(keys.has(muscle.key), muscle.key).toBe(true)
      for (const cover of muscle.covers) {
        expect(keys.has(cover), cover).toBe(true)
        expect(deep.has(cover), cover).toBe(false)
      }
    }
  })

  it('"Muskujt e thellë" i bën të tejdukshme të gjitha mbulesat, edhe kur janë në fokus', () => {
    const ghosts = ghostKeys(true, ['latissimus_dorsi', 'rhomboid_major'])
    expect(ghosts).toEqual(new Set(DEEP_MUSCLES.flatMap((muscle) => muscle.covers)))
    expect(ghosts.has('trapezius')).toBe(true)
    expect(ghosts.has('latissimus_dorsi')).toBe(true)
    expect(ghosts.has('pectoralis_minor')).toBe(false)
  })

  it('pa to, fokusi te një muskul i thellë zbulon vetëm mbulesat e tij që s\'janë në fokus', () => {
    expect(ghostKeys(false, null)).toEqual(new Set())
    expect(ghostKeys(false, ['soleus'])).toEqual(new Set(['gastrocnemius']))
    // Pulpat: gastroknemiusi është vetë në fokus, ndaj mbetet i plotë.
    expect(ghostKeys(false, ['gastrocnemius', 'soleus'])).toEqual(new Set())
    // Shpina: trapezi dhe deltoidi i pasmë hapen; latissimusi është në fokus.
    expect(ghostKeys(false, ['latissimus_dorsi', 'rhomboid_major', 'rhomboid_minor', 'teres_major', 'infraspinatus'])).toEqual(
      new Set(['trapezius', 'deltoid_posterior']),
    )
    expect(ghostKeys(false, ['biceps_brachii'])).toEqual(new Set())
  })

  it('zgjedhjet e ekranit "Shtresat": çdo muskul i thellë një herë, romboidët bashkë', () => {
    expect(DEEP_ENTRIES.flatMap((entry) => entry.keys).sort()).toEqual(DEEP_MUSCLES.map((muscle) => muscle.key).sort())
    expect(DEEP_ENTRIES.slice(0, 4).map((entry) => entry.id)).toEqual(['pectoralis_minor', 'rhomboids', 'brachialis', 'soleus'])
    expect(deepEntry('rhomboids')).toMatchObject({ keys: ['rhomboid_major', 'rhomboid_minor'], covers: ['trapezius'], side: 'back' })
    expect(deepEntry('pectoralis_minor')!.covers).toEqual(['pectoralis_major_sternocostal', 'pectoralis_major_clavicular'])
    expect(deepEntry('nuk-ekziston')).toBeUndefined()
  })

  it('"Te programi yt": ushtrimet ku muskuli është kryesor ose ndihmës, pa përsëritje', () => {
    const exercises = [
      { name: 'Bench Press', primary: ['pectoralis_major_sternocostal'], secondary: ['triceps_brachii'] },
      { name: 'Cable Crossover', primary: ['pectoralis_major_sternocostal'], secondary: ['pectoralis_minor', 'deltoid_anterior'] },
      { name: 'Cable Crossover', primary: ['pectoralis_major_sternocostal'], secondary: ['pectoralis_minor', 'deltoid_anterior'] },
      { name: 'Seated Calf Raise', primary: ['soleus'], secondary: ['gastrocnemius'] },
      { name: 'Standing Calf Raise', primary: ['gastrocnemius'], secondary: ['soleus'] },
    ]
    expect(programRoles(['pectoralis_minor'], exercises)).toEqual({ primary: [], secondary: ['Cable Crossover'] })
    expect(programRoles(['soleus'], exercises)).toEqual({ primary: ['Seated Calf Raise'], secondary: ['Standing Calf Raise'] })
    // Një ushtrim ku një pjesë është kryesore dhe tjetra ndihmëse numërohet si kryesor.
    expect(programRoles(['rhomboid_major', 'rhomboid_minor'], [{ name: 'Row', primary: ['rhomboid_major'], secondary: ['rhomboid_minor'] }])).toEqual({
      primary: ['Row'],
      secondary: [],
    })
    expect(programRoles(['brachialis'], exercises)).toEqual({ primary: [], secondary: [] })
  })
})
