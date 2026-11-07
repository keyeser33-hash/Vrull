import type { LocalDatabase } from './db'
import type { LocalStore } from './store'

// Fotot e progresit (SPEC §8, TH-12): rreshti te `progress_photos` sinkronizohet si çdo tabelë;
// skedari ruhet në telefon dhe ngarkohet te bucket-i privat (<user_id>/<id>.jpg) kur ka internet.
// Në një telefon tjetër shkarkohet një herë dhe ruhet në telefon.

export type Pose = 'front' | 'side' | 'back'
export const POSES: { pose: Pose; label: string }[] = [
  { pose: 'front', label: 'Para' },
  { pose: 'side', label: 'Anash' },
  { pose: 'back', label: 'Mbrapa' },
]

export interface PhotoRemote {
  upload(path: string, data: ArrayBuffer, type: string): Promise<void>
  download(path: string): Promise<ArrayBuffer>
}

export interface PhotoRef {
  id: string
  date: string
  pose: Pose
  storagePath: string
  /** Skedari është në këtë telefon. */
  local: boolean
  /** Skedari është në bucket (ose erdhi prej andej). */
  uploaded: boolean
}

export interface PhotoDay {
  date: string
  photos: Partial<Record<Pose, PhotoRef>>
}

/** Foto e re për një ditë dhe pozë; një foto e mëparshme e së njëjtës ditë dhe poze zëvendësohet. */
export async function addPhoto(
  store: LocalStore,
  db: LocalDatabase,
  input: { date: string; pose: Pose; data: ArrayBuffer; width: number; height: number },
): Promise<string> {
  const userId = store.userId()
  if (!userId) throw new Error('Pa përdorues: hyr në llogari para se të ruash foto.')
  for (const old of await store.where('progress_photos', 'date', input.date)) {
    if (old.pose === input.pose) await removePhoto(store, db, old.id)
  }
  const id = crypto.randomUUID()
  const storagePath = `${userId}/${id}.jpg`
  await db._photo_files.put({ id, data: input.data, type: 'image/jpeg', uploaded: 0, storagePath })
  await store.put('progress_photos', {
    id,
    date: input.date,
    pose: input.pose,
    storage_path: storagePath,
    width: input.width,
    height: input.height,
    bytes: input.data.byteLength,
  })
  return id
}

export async function removePhoto(store: LocalStore, db: LocalDatabase, id: string) {
  await store.remove('progress_photos', id)
  await db._photo_files.delete(id)
}

/** Ditët me foto, më e reja e para. */
export async function photoTimeline(store: LocalStore, db: LocalDatabase): Promise<PhotoDay[]> {
  const [rows, files] = await Promise.all([store.all('progress_photos'), db._photo_files.toArray()])
  const fileById = new Map(files.map((file) => [file.id, file]))
  const days = new Map<string, PhotoDay>()
  for (const row of rows) {
    const date = String(row.date)
    const file = fileById.get(row.id)
    const day = days.get(date) ?? { date, photos: {} }
    day.photos[row.pose as Pose] = {
      id: row.id,
      date,
      pose: row.pose as Pose,
      storagePath: String(row.storage_path),
      local: Boolean(file),
      uploaded: file ? file.uploaded === 1 : true,
    }
    days.set(date, day)
  }
  return [...days.values()].sort((a, b) => b.date.localeCompare(a.date))
}

/** Bajtët e fotos: nga telefoni, ose nga bucket-i një herë; null kur nuk është ngarkuar ende. */
export async function photoData(db: LocalDatabase, remote: PhotoRemote, photo: Pick<PhotoRef, 'id' | 'storagePath'>): Promise<ArrayBuffer | null> {
  const local = await db._photo_files.get(photo.id)
  if (local) return local.data
  try {
    const data = await remote.download(photo.storagePath)
    await db._photo_files.put({ id: photo.id, data, type: 'image/jpeg', uploaded: 1, storagePath: photo.storagePath })
    return data
  } catch {
    return null
  }
}

/** Ngarkon fotot që presin; kthen sa u ngarkuan. Ato që dështojnë provohen herën tjetër. */
export async function uploadPendingPhotos(db: LocalDatabase, remote: PhotoRemote): Promise<number> {
  let done = 0
  for (const file of await db._photo_files.where('uploaded').equals(0).toArray()) {
    try {
      await remote.upload(file.storagePath, file.data, file.type)
      await db._photo_files.update(file.id, { uploaded: 1 })
      done++
    } catch {
      // Pa internet ose sesion i skaduar: mbetet në radhë.
    }
  }
  return done
}
