import { createDatabase } from './db'
import { addPhoto, photoData, photoTimeline, type PhotoRemote, removePhoto, uploadPendingPhotos } from './photos'
import { createLocalStore } from './store'

const USER = '11111111-1111-4111-8111-111111111111'
const bytes = (...values: number[]) => new Uint8Array(values).buffer

function fakeRemote() {
  const files = new Map<string, ArrayBuffer>()
  const remote: PhotoRemote & { files: typeof files; offline: boolean } = {
    files,
    offline: false,
    async upload(path, data) {
      if (remote.offline) throw new Error('Pa internet')
      files.set(path, data)
    },
    async download(path) {
      const data = files.get(path)
      if (!data) throw new Error('Nuk gjendet')
      return data
    },
  }
  return remote
}

function setup(name = `photos-${crypto.randomUUID()}`) {
  const db = createDatabase(name)
  return { db, store: createLocalStore(db, { userId: () => USER }) }
}

describe('fotot e progresit', () => {
  it('foto ruhet në telefon, pret ngarkimin, dhe ngarkohet te dosja e përdoruesit', async () => {
    const { db, store } = setup()
    const remote = fakeRemote()
    const id = await addPhoto(store, db, { date: '2026-12-06', pose: 'front', data: bytes(1, 2, 3), width: 1200, height: 1600 })
    const [row] = await store.all('progress_photos')
    expect(row).toMatchObject({ id, date: '2026-12-06', pose: 'front', storage_path: `${USER}/${id}.jpg`, width: 1200, height: 1600, bytes: 3 })
    let [day] = await photoTimeline(store, db)
    expect(day).toMatchObject({ date: '2026-12-06', photos: { front: { id, uploaded: false } } })

    remote.offline = true
    expect(await uploadPendingPhotos(db, remote)).toBe(0)
    remote.offline = false
    expect(await uploadPendingPhotos(db, remote)).toBe(1)
    expect([...remote.files.keys()]).toEqual([`${USER}/${id}.jpg`])
    ;[day] = await photoTimeline(store, db)
    expect(day.photos.front?.uploaded).toBe(true)
    expect(await uploadPendingPhotos(db, remote)).toBe(0)
  })

  it('foto e re për të njëjtën ditë dhe pozë zëvendëson të mëparshmen', async () => {
    const { db, store } = setup()
    await addPhoto(store, db, { date: '2026-12-06', pose: 'side', data: bytes(1), width: 10, height: 10 })
    const second = await addPhoto(store, db, { date: '2026-12-06', pose: 'side', data: bytes(2), width: 10, height: 10 })
    expect((await store.all('progress_photos')).map((row) => row.id)).toEqual([second])
    expect(await db._photo_files.count()).toBe(1)
  })

  it('në një telefon tjetër foto shkarkohet një herë dhe ruhet; fshirja heq rreshtin dhe skedarin', async () => {
    const remote = fakeRemote()
    const first = setup()
    const id = await addPhoto(first.store, first.db, { date: '2026-12-06', pose: 'back', data: bytes(7, 8), width: 10, height: 10 })
    await uploadPendingPhotos(first.db, remote)

    const second = setup()
    const row = (await first.store.get('progress_photos', id))!
    await second.db.progress_photos.put({ ...row, _dirty: 0 })
    const [day] = await photoTimeline(second.store, second.db)
    expect(day.photos.back).toMatchObject({ id, local: false })
    expect(new Uint8Array((await photoData(second.db, remote, day.photos.back!))!)).toEqual(new Uint8Array([7, 8]))
    remote.files.clear()
    expect(new Uint8Array((await photoData(second.db, remote, day.photos.back!))!)).toEqual(new Uint8Array([7, 8]))

    await removePhoto(second.store, second.db, id)
    expect(await photoTimeline(second.store, second.db)).toEqual([])
    expect(await second.db._photo_files.count()).toBe(0)
  })

  it('foto që nuk është ngarkuar ende nga telefoni tjetër: null, pa gabim', async () => {
    const { db, store } = setup()
    await db.progress_photos.put({ id: 'x', user_id: USER, date: '2026-12-06', pose: 'front', storage_path: `${USER}/x.jpg`, created_at: '', updated_at: '', deleted_at: null, _dirty: 0 })
    const [day] = await photoTimeline(store, db)
    expect(await photoData(db, fakeRemote(), day.photos.front!)).toBeNull()
  })
})
