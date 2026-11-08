import { createFakeRemote, createFakeStorage } from '@/test/fake-remote'
import { createDatabase } from './db'
import {
  addFormVideo,
  exerciseVideos,
  FORM_VIDEO_LIMITS,
  formVideoData,
  removeFormVideo,
  setComparison,
  STORAGE_QUOTA_BYTES,
  storageUsage,
  syncFormVideoFiles,
  VideoTooLargeError,
} from './form-videos'
import { createLocalStore } from './store'
import { createSync } from './sync'

// Videot e formës (V2-E1-13; SPEC V27): rreshti te `form_videos` sinkronizohet si çdo tabelë, skedari
// ruhet në telefon dhe ngarkohet te bucket-i privat form-videos/<user_id>/<id>.<mp4|webm> kur ka
// internet. Pranimi: një video ruhet pa internet dhe ngarkohet kur kthehet rrjeti; vetëm pronari e sheh.

const USER = '11111111-1111-4111-8111-111111111111'
const OTHER = '33333333-3333-4333-8333-333333333333'
const bytes = (...values: number[]) => new Uint8Array(values).buffer
const clip = (overrides: Partial<Parameters<typeof addFormVideo>[2]> = {}) => ({
  exerciseId: 'bench',
  sessionId: 'session-2',
  setNumber: 2,
  date: '2026-11-08',
  data: bytes(1, 2, 3),
  type: 'video/mp4' as const,
  durationS: 24.2,
  width: 720,
  height: 1280,
  ...overrides,
})

function phone(userId = () => USER as string | null) {
  const db = createDatabase(`videos-${crypto.randomUUID()}`)
  let clock = Date.parse('2026-11-08T08:00:00.000Z')
  const now = () => new Date((clock += 1000))
  return { db, store: createLocalStore(db, { userId, now }), now }
}

describe('videot e formës', () => {
  it('ruhet pa internet dhe ngarkohet kur kthehet rrjeti, rreshti dhe skedari', async () => {
    const remote = createFakeRemote()
    const storage = createFakeStorage({ userId: () => USER, remote })
    const { db, store, now } = phone()
    const sync = createSync({ db, remote, userId: () => USER, now })

    remote.offline = true
    const id = await addFormVideo(store, db, clip())
    const [row] = await store.all('form_videos')
    expect(row).toMatchObject({
      id,
      exercise_id: 'bench',
      session_id: 'session-2',
      set_number: 2,
      date: '2026-11-08',
      storage_path: `${USER}/${id}.mp4`,
      mime_type: 'video/mp4',
      duration_s: 24.2,
      bytes: 3,
      width: 720,
      height: 1280,
    })
    expect(await sync.run()).toMatchObject({ status: 'offline' })
    expect(await syncFormVideoFiles(db, storage)).toEqual({ uploaded: 0, removed: 0 })
    expect(storage.objects()).toEqual([])
    // Pa internet videoja luhet nga telefoni.
    const [video] = await exerciseVideos(store, 'bench')
    expect(new Uint8Array((await formVideoData(db, storage, video))!)).toEqual(new Uint8Array([1, 2, 3]))

    remote.offline = false
    expect(await sync.run()).toMatchObject({ status: 'ok', rejected: 0 })
    expect(remote.rows('form_videos')).toEqual([expect.objectContaining({ id, storage_path: `${USER}/${id}.mp4`, user_id: USER })])
    expect(await syncFormVideoFiles(db, storage)).toEqual({ uploaded: 1, removed: 0 })
    expect(storage.objects()).toEqual([`${USER}/${id}.mp4`])
    // Një herë mjafton.
    expect(await syncFormVideoFiles(db, storage)).toEqual({ uploaded: 0, removed: 0 })
  })

  it('në një telefon tjetër të pronarit shkarkohet një herë dhe ruhet; një përdorues tjetër nuk e sheh', async () => {
    const remote = createFakeRemote()
    let signedIn = USER
    const storage = createFakeStorage({ userId: () => signedIn, remote })
    const first = phone()
    const id = await addFormVideo(first.store, first.db, clip({ type: 'video/webm', data: bytes(7, 8) }))
    await createSync({ db: first.db, remote, userId: () => USER, now: first.now }).run()
    await syncFormVideoFiles(first.db, storage)
    expect(storage.objects()).toEqual([`${USER}/${id}.webm`])

    const second = phone()
    await createSync({ db: second.db, remote, userId: () => USER, now: second.now }).run()
    const [video] = await exerciseVideos(second.store, 'bench')
    expect(video).toMatchObject({ id, type: 'video/webm', durationS: 24.2 })
    expect(new Uint8Array((await formVideoData(second.db, storage, video))!)).toEqual(new Uint8Array([7, 8]))
    storage.offline = true
    expect(new Uint8Array((await formVideoData(second.db, storage, video))!)).toEqual(new Uint8Array([7, 8]))
    storage.offline = false

    // RLS te storage.objects: një përdorues tjetër, edhe me rrugën e saktë, nuk e merr dhe nuk e fshin.
    signedIn = OTHER
    const stranger = phone(() => OTHER)
    expect(await formVideoData(stranger.db, storage, video)).toBeNull()
    await expect(storage.upload(`${USER}/x.mp4`, bytes(1), 'video/mp4')).rejects.toThrow(/row-level security/)
    await storage.remove(video.storagePath)
    expect(storage.objects()).toEqual([`${USER}/${id}.webm`])
  })

  it('videoja që s’është ngarkuar ende nga telefoni tjetër: null, pa gabim', async () => {
    const remote = createFakeRemote()
    const storage = createFakeStorage({ userId: () => USER, remote })
    const first = phone()
    await addFormVideo(first.store, first.db, clip())
    await createSync({ db: first.db, remote, userId: () => USER, now: first.now }).run()

    const second = phone()
    await createSync({ db: second.db, remote, userId: () => USER, now: second.now }).run()
    const [video] = await exerciseVideos(second.store, 'bench')
    expect(await formVideoData(second.db, storage, video)).toBeNull()
  })

  it('fshirja heq skedarin në telefon, rreshtin dhe objektin në Storage; pa internet pret', async () => {
    const remote = createFakeRemote()
    const storage = createFakeStorage({ userId: () => USER, remote })
    const { db, store, now } = phone()
    const sync = createSync({ db, remote, userId: () => USER, now })
    const id = await addFormVideo(store, db, clip())
    await sync.run()
    await syncFormVideoFiles(db, storage)

    remote.offline = true
    await removeFormVideo(store, db, id)
    expect(await exerciseVideos(store, 'bench')).toEqual([])
    expect(await syncFormVideoFiles(db, storage)).toEqual({ uploaded: 0, removed: 0 })
    expect(storage.objects()).toEqual([`${USER}/${id}.mp4`])

    remote.offline = false
    expect(await syncFormVideoFiles(db, storage)).toEqual({ uploaded: 0, removed: 1 })
    expect(storage.objects()).toEqual([])
    expect(await db._video_files.count()).toBe(0)
    await sync.run()
    expect(remote.rows('form_videos')).toEqual([expect.objectContaining({ id, deleted_at: expect.any(String) })])
  })

  it('një video e fshirë para ngarkimit nuk shkon kurrë në Storage', async () => {
    const storage = createFakeStorage({ userId: () => USER })
    const { db, store } = phone()
    const id = await addFormVideo(store, db, clip())
    await removeFormVideo(store, db, id)
    expect(await syncFormVideoFiles(db, storage)).toEqual({ uploaded: 0, removed: 1 })
    expect(storage.calls).toEqual([])
    expect(await db._video_files.count()).toBe(0)
  })

  it('fshirja nga telefoni tjetër heq edhe kopjen në këtë telefon', async () => {
    const remote = createFakeRemote()
    const storage = createFakeStorage({ userId: () => USER, remote })
    const first = phone()
    const firstSync = createSync({ db: first.db, remote, userId: () => USER, now: first.now })
    const id = await addFormVideo(first.store, first.db, clip())
    await firstSync.run()
    await syncFormVideoFiles(first.db, storage)

    // Telefoni i dytë nuk e ka skedarin; e fshin nga lista.
    const second = phone()
    const secondSync = createSync({ db: second.db, remote, userId: () => USER, now: second.now })
    await secondSync.run()
    await removeFormVideo(second.store, second.db, id)
    await secondSync.run()
    expect(await syncFormVideoFiles(second.db, storage)).toEqual({ uploaded: 0, removed: 1 })
    expect(storage.objects()).toEqual([])

    await firstSync.run()
    expect(await first.db._video_files.count()).toBe(1)
    expect(await syncFormVideoFiles(first.db, storage)).toEqual({ uploaded: 0, removed: 1 })
    expect(await first.db._video_files.count()).toBe(0)
  })

  it('një video e re për të njëjtin set zëvendëson të mëparshmen', async () => {
    const { db, store } = phone()
    await addFormVideo(store, db, clip({ data: bytes(1) }))
    const second = await addFormVideo(store, db, clip({ data: bytes(2) }))
    await addFormVideo(store, db, clip({ setNumber: 3 }))
    expect((await exerciseVideos(store, 'bench')).map((video) => [video.id === second, video.setNumber])).toEqual([
      [false, 3],
      [true, 2],
    ])
    // E zëvendësuara mbetet si varr deri sa të hiqet nga Storage.
    expect(await db._video_files.where('removed').equals(0).count()).toBe(2)
  })

  it('kufijtë: vetëm mp4 ose webm, deri në 50 MB dhe 60 s', async () => {
    const { db, store } = phone()
    expect(FORM_VIDEO_LIMITS).toMatchObject({ maxSeconds: 60, maxBytes: 50 * 1024 * 1024 })
    await expect(addFormVideo(store, db, clip({ data: new ArrayBuffer(FORM_VIDEO_LIMITS.maxBytes + 1) }))).rejects.toBeInstanceOf(VideoTooLargeError)
    await expect(addFormVideo(store, db, clip({ type: 'video/quicktime' as never }))).rejects.toThrow()
    await expect(addFormVideo(store, db, clip({ data: new ArrayBuffer(0) }))).rejects.toThrow()
    // Ora e regjistrimit mund të kalojë pak kufirin: kohëzgjatja ruhet deri në 60 s.
    await addFormVideo(store, db, clip({ durationS: 60.04 }))
    expect((await store.all('form_videos')).map((row) => row.duration_s)).toEqual([60])
    expect(await db._video_files.count()).toBe(1)
  })

  it('lista e ushtrimit: më e reja e para, me peshën dhe përsëritjet kur seti është ruajtur', async () => {
    const { db, store } = phone()
    await store.put('set_logs', { id: 'old-2', session_id: 'session-1', exercise_id: 'bench', position: 0, set_number: 2, weight_kg: 60, reps: 12, is_warmup: false })
    await addFormVideo(store, db, clip({ sessionId: 'session-1', date: '2026-11-01', durationS: 21 }))
    await addFormVideo(store, db, clip({ sessionId: 'session-2', date: '2026-11-08' }))
    await addFormVideo(store, db, clip({ exerciseId: 'squat', sessionId: 'session-2', setNumber: 1 }))
    const videos = await exerciseVideos(store, 'bench')
    expect(videos.map((video) => [video.date, video.setNumber, video.durationS, video.set])).toEqual([
      ['2026-11-08', 2, 24.2, null],
      ['2026-11-01', 2, 21, { weightKg: 60, reps: 12, seconds: null }],
    ])
  })

  it('krahasimi: videoja e këtij seti dhe ajo e herës së kaluar, me të njëjtin set kur ka', async () => {
    const { db, store } = phone()
    const previous = async (setNumber: number) => (await setComparison(store, { exerciseId: 'bench', sessionId: 'session-3', setNumber })).previous
    expect(await setComparison(store, { exerciseId: 'bench', sessionId: 'session-3', setNumber: 2 })).toEqual({ current: null, previous: null, set: null })
    await addFormVideo(store, db, clip({ sessionId: 'session-1', date: '2026-10-25', setNumber: 2 }))
    expect(await previous(2)).toMatchObject({ date: '2026-10-25', setNumber: 2 })
    // Herën e kaluar (seanca më e fundit me video) ka vetëm setin 1: ai, jo seti 2 i dy javëve më parë.
    await addFormVideo(store, db, clip({ sessionId: 'session-2', date: '2026-11-01', setNumber: 1 }))
    expect(await previous(2)).toMatchObject({ date: '2026-11-01', setNumber: 1 })
    await addFormVideo(store, db, clip({ sessionId: 'session-2', date: '2026-11-01', setNumber: 3 }))
    await addFormVideo(store, db, clip({ sessionId: 'session-2', date: '2026-11-01', setNumber: 2 }))
    const current = await addFormVideo(store, db, clip({ sessionId: 'session-3', date: '2026-11-08', setNumber: 2 }))
    expect(await setComparison(store, { exerciseId: 'bench', sessionId: 'session-3', setNumber: 2 })).toEqual({
      current: expect.objectContaining({ id: current }),
      previous: expect.objectContaining({ date: '2026-11-01', setNumber: 2 }),
      set: null,
    })
    // Seti i ruajtur pas videos (ose para saj) jep peshën dhe përsëritjet, edhe pa video të ruajtur.
    await store.put('set_logs', { session_id: 'session-3', exercise_id: 'bench', position: 0, set_number: 3, weight_kg: 62.5, reps: 10, is_warmup: false })
    expect((await setComparison(store, { exerciseId: 'bench', sessionId: 'session-3', setNumber: 3 })).set).toEqual({ weightKg: 62.5, reps: 10, seconds: null })
  })

  it('hapësira: fotot dhe videot e përdoruesit kundrejt 1 GB të planit falas; mesazhi nga 80%', async () => {
    const { db, store } = phone()
    expect(STORAGE_QUOTA_BYTES).toBe(1_000_000_000)
    expect(await storageUsage(store)).toEqual({ usedBytes: 0, quotaBytes: STORAGE_QUOTA_BYTES, ratio: 0, level: 'ok' })
    await store.put('progress_photos', { date: '2026-11-08', pose: 'front', storage_path: `${USER}/a.jpg`, bytes: 300_000_000 })
    await store.put('form_videos', { exercise_id: 'bench', date: '2026-11-08', storage_path: `${USER}/v.mp4`, mime_type: 'video/mp4', duration_s: 30, bytes: 499_000_000 })
    expect(await storageUsage(store)).toMatchObject({ usedBytes: 799_000_000, level: 'ok' })
    const id = await addFormVideo(store, db, clip({ data: new ArrayBuffer(1_000_000) }))
    expect(await storageUsage(store)).toMatchObject({ usedBytes: 800_000_000, ratio: 0.8, level: 'near' })
    await store.put('form_videos', { exercise_id: 'bench', date: '2026-11-08', storage_path: `${USER}/w.mp4`, mime_type: 'video/mp4', duration_s: 30, bytes: 200_000_000 })
    expect(await storageUsage(store)).toMatchObject({ usedBytes: 1_000_000_000, level: 'full' })
    // Videot e fshira nuk numërohen.
    await removeFormVideo(store, db, id)
    expect(await storageUsage(store)).toMatchObject({ usedBytes: 999_000_000, level: 'near' })
  })
})
