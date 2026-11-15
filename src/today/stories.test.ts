import { markStorySeen, readSeenStories, storyRing, subscribeSeenStories } from './stories'

// Rrathët e story-ve te Sot (V57, SPEC §0.3f): "Si ndihesh?" i pari deri sa gjendja e ditës të plotësohet, pastaj të
// pashikuarat, pastaj të shikuarat, dhe "Gati N%" i fundit pas plotësimit. Mentori vetëm kur ka shënim (V55).

const base = { checkedIn: false, skipped: false, percent: null as number | null, mentor: null as { id: string } | null, weekMonday: null as string | null, seen: new Set<string>() }
const ids = (input: Partial<typeof base>) => storyRing({ ...base, ...input }).map((story) => `${story.kind}${story.seen ? ':seen' : ''}`)

describe('storyRing', () => {
  it('mëngjesi pa gjendje: vetëm "Si ndihesh?", me unazën e pashikuar', () => {
    expect(ids({})).toEqual(['checkin'])
  })

  it('"Jo sot" e bën unazën të shikuar, por rrethi mbetet deri sa gjendja të plotësohet', () => {
    expect(ids({ skipped: true })).toEqual(['checkin:seen'])
  })

  it('pas plotësimit "Si ndihesh?" del dhe "Gati N%" vjen e fundit, me përqindjen', () => {
    const ring = storyRing({ ...base, checkedIn: true, percent: 88 })
    expect(ring.map((story) => story.kind)).toEqual(['ready'])
    expect(ring[0]).toMatchObject({ percent: 88, seen: false })
  })

  it('mentori del vetëm kur ka shënim; i pashikuari para të shikuarit, Gati në fund', () => {
    expect(ids({ checkedIn: true, percent: 80 })).toEqual(['ready'])
    expect(ids({ checkedIn: true, percent: 80, mentor: { id: 'n1' } })).toEqual(['mentor', 'ready'])
    expect(ids({ checkedIn: true, percent: 80, mentor: { id: 'n1' }, seen: new Set(['mentor:n1', 'ready']) })).toEqual(['mentor:seen', 'ready:seen'])
  })

  it('e diela: "Java jote" para mentorit; çdo e shikuar shkon pas të pashikuarave', () => {
    expect(ids({ checkedIn: true, percent: 80, mentor: { id: 'n1' }, weekMonday: '2026-11-09' })).toEqual(['week', 'mentor', 'ready'])
    expect(ids({ checkedIn: true, percent: 80, mentor: { id: 'n1' }, weekMonday: '2026-11-09', seen: new Set(['week:2026-11-09']) })).toEqual(['mentor', 'week:seen', 'ready'])
  })

  it('"Si ndihesh?" mbetet i pari edhe kur ka të tjerë', () => {
    expect(ids({ mentor: { id: 'n1' }, weekMonday: '2026-11-09' })).toEqual(['checkin', 'week', 'mentor'])
  })

  it('çdo rreth ka çelës të qëndrueshëm: e shikuara lidhet me shënimin dhe me javën, jo vetëm me llojin', () => {
    const ring = storyRing({ ...base, checkedIn: true, percent: 80, mentor: { id: 'n1' }, weekMonday: '2026-11-09' })
    expect(ring.map((story) => story.key)).toEqual(['week:2026-11-09', 'mentor:n1', 'ready'])
  })
})

describe('story-t e shikuara në telefon', () => {
  beforeEach(() => localStorage.clear())

  it('ruhen për ditën; një ditë tjetër fillon bosh', () => {
    expect([...readSeenStories('2026-11-09')]).toEqual([])
    markStorySeen('2026-11-09', 'ready')
    markStorySeen('2026-11-09', 'mentor:n1')
    expect([...readSeenStories('2026-11-09')].sort()).toEqual(['mentor:n1', 'ready'])
    expect([...readSeenStories('2026-11-10')]).toEqual([])
    markStorySeen('2026-11-10', 'ready')
    expect([...readSeenStories('2026-11-09')]).toEqual([])
    expect([...readSeenStories('2026-11-10')]).toEqual(['ready'])
  })

  it('njofton ndërruesit kur shënohet një story', () => {
    const calls: string[] = []
    const stop = subscribeSeenStories(() => calls.push('ndryshoi'))
    markStorySeen('2026-11-09', 'ready')
    markStorySeen('2026-11-09', 'ready')
    stop()
    markStorySeen('2026-11-09', 'mentor:n1')
    expect(calls).toEqual(['ndryshoi'])
  })

  it('një vlerë e prishur te telefoni lexohet si bosh', () => {
    localStorage.setItem('vrull.stories.seen', '{nuk është json')
    expect([...readSeenStories('2026-11-09')]).toEqual([])
    localStorage.setItem('vrull.stories.seen', JSON.stringify({ date: 5, ids: 'x' }))
    expect([...readSeenStories('2026-11-09')]).toEqual([])
  })
})
