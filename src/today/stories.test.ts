import { markStorySeen, readSeenStories, storyRing } from './stories'

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
  const USER = '11111111-1111-4111-8111-111111111111'
  const freshStore = async () => {
    const { createDatabase } = await import('@/data/db')
    const { createLocalStore } = await import('@/data/store')
    return createLocalStore(createDatabase(`stories-${crypto.randomUUID()}`), { userId: () => USER, now: () => new Date(2026, 10, 9, 10, 0) })
  }

  it('ruhen për ditën; një ditë tjetër fillon bosh', async () => {
    const store = await freshStore()
    expect([...(await readSeenStories(store, '2026-11-09'))]).toEqual([])
    await markStorySeen(store, '2026-11-09', 'ready')
    await markStorySeen(store, '2026-11-09', 'mentor:n1')
    expect([...(await readSeenStories(store, '2026-11-09'))].sort()).toEqual(['mentor:n1', 'ready'])
    expect([...(await readSeenStories(store, '2026-11-10'))]).toEqual([])
    await markStorySeen(store, '2026-11-10', 'ready')
    expect([...(await readSeenStories(store, '2026-11-09'))]).toEqual([])
    expect([...(await readSeenStories(store, '2026-11-10'))]).toEqual(['ready'])
  })

  it('njofton dëgjuesit e store-it vetëm kur ndryshon diçka', async () => {
    const store = await freshStore()
    const calls: string[] = []
    const stop = store.subscribe((table) => calls.push(table))
    await markStorySeen(store, '2026-11-09', 'ready')
    await markStorySeen(store, '2026-11-09', 'ready')
    stop()
    expect(calls).toEqual(['_meta'])
  })

  it('një vlerë e prishur te telefoni lexohet si bosh', async () => {
    const store = await freshStore()
    await store.writeDevice('stories-seen', { date: 5, ids: 'x' })
    expect([...(await readSeenStories(store, '2026-11-09'))]).toEqual([])
    await store.writeDevice('stories-seen', { date: '2026-11-09', ids: ['ready', 7, null] })
    expect([...(await readSeenStories(store, '2026-11-09'))]).toEqual(['ready'])
  })
})
