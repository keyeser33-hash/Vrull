import { DEEP_MUSCLES, ghostKeys } from './layers'
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
})
