import type { LocalDatabase, VideoFile } from './db'
import type { LocalStore } from './store'
import type { LocalRow } from './tables'

// Videot e formës (V2-E1-13; SPEC V26, V27, §12). Si fotot e progresit (§8): rreshti te `form_videos`
// sinkronizohet si çdo tabelë; skedari ruhet në telefon (`_video_files`) dhe ngarkohet te bucket-i
// privat form-videos, në <user_id>/<id>.<mp4|webm>, kur ka internet. Në një telefon tjetër shkarkohet
// një herë kur luhet. Fshirja heq rreshtin (fshirje e butë, që arrin kudo), skedarin në telefon dhe
// objektin në bucket; pa internet, objekti pret si "varr" te `_video_files` (removed = 1).

export type VideoType = 'video/mp4' | 'video/webm'
export const VIDEO_TYPES: readonly VideoType[] = ['video/mp4', 'video/webm']
const EXTENSIONS: Record<VideoType, string> = { 'video/mp4': 'mp4', 'video/webm': 'webm' }

/**
 * Kufijtë e një videoje (SPEC §12): deri në 60 s, 720p me 30 kuadro dhe 2 Mbit/s, pa zë (rreth 15 MB
 * në minutë); asnjë skedar mbi 50 MB, kufiri i planit falas të Supabase-it për një ngarkim.
 */
export const FORM_VIDEO_LIMITS = {
  maxSeconds: 60,
  maxBytes: 50 * 1024 * 1024,
  videoBitsPerSecond: 2_000_000,
  width: 1280,
  height: 720,
  frameRate: 30,
} as const

/** Hapësira e planit falas të Supabase-it për skedarët (1 GB, verifikuar te supabase.com/pricing më 08.11.2026). */
export const STORAGE_QUOTA_BYTES = 1_000_000_000
/** Nga ky raport i hapësirës, ekrani i videos e thotë (V27). */
export const STORAGE_WARNING_RATIO = 0.8

export class VideoTooLargeError extends Error {
  readonly bytes: number
  constructor(bytes: number) {
    super(`Videoja ka ${bytes} bajtë, mbi kufirin ${FORM_VIDEO_LIMITS.maxBytes}.`)
    this.bytes = bytes
  }
}

/** Bucket-i form-videos, përmes Supabase Storage (app-data.ts) ose i imituar në prova. */
export interface VideoRemote {
  upload(path: string, data: ArrayBuffer, type: string): Promise<void>
  download(path: string): Promise<ArrayBuffer>
  /** Fshirja e një objekti që mungon nuk është gabim. */
  remove(path: string): Promise<void>
}

export interface NewFormVideo {
  exerciseId: string
  sessionId: string | null
  setNumber: number | null
  /** Dita e seancës (YYYY-MM-DD, zona e telefonit). */
  date: string
  data: ArrayBuffer
  type: VideoType
  durationS: number
  width?: number | null
  height?: number | null
}

/** Pesha dhe përsëritjet e setit të videos, kur seti është ruajtur. */
export interface VideoSet {
  weightKg: number | null
  reps: number | null
  seconds: number | null
}

export interface FormVideoRef {
  id: string
  exerciseId: string
  sessionId: string | null
  setNumber: number | null
  date: string
  type: VideoType
  durationS: number
  bytes: number
  width: number | null
  height: number | null
  storagePath: string
  createdAt: string
  set: VideoSet | null
}

const num = (value: unknown) => (value === null || value === undefined ? null : Number(value))

/** Ruan videon në telefon; një video e mëparshme e të njëjtit set në të njëjtën seancë zëvendësohet. */
export async function addFormVideo(store: LocalStore, db: LocalDatabase, input: NewFormVideo): Promise<string> {
  const userId = store.userId()
  if (!userId) throw new Error('Pa përdorues: hyr në llogari para se të ruash video.')
  if (!VIDEO_TYPES.includes(input.type)) throw new Error(`Lloj videoje i panjohur: ${input.type}`)
  const bytes = input.data.byteLength
  if (bytes === 0) throw new Error('Videoja është bosh.')
  if (bytes > FORM_VIDEO_LIMITS.maxBytes) throw new VideoTooLargeError(bytes)
  if (!(input.durationS > 0)) throw new Error('Videoja nuk ka kohëzgjatje.')

  if (input.sessionId && input.setNumber) {
    for (const old of await store.where('form_videos', 'session_id', input.sessionId)) {
      if (old.exercise_id === input.exerciseId && old.set_number === input.setNumber) await removeFormVideo(store, db, old.id)
    }
  }
  const id = crypto.randomUUID()
  const storagePath = `${userId}/${id}.${EXTENSIONS[input.type]}`
  // Skedari para rreshtit: ngarkimi pret rreshtin, ndaj një skedar pa rresht nuk ngarkohet kurrë.
  await db._video_files.put({ id, data: input.data, type: input.type, uploaded: 0, removed: 0, storagePath })
  await store.put('form_videos', {
    id,
    exercise_id: input.exerciseId,
    session_id: input.sessionId,
    set_number: input.setNumber,
    date: input.date,
    storage_path: storagePath,
    mime_type: input.type,
    duration_s: Math.round(Math.min(input.durationS, FORM_VIDEO_LIMITS.maxSeconds) * 10) / 10,
    bytes,
    width: input.width ?? null,
    height: input.height ?? null,
  })
  return id
}

/** Fshin videon: rreshti (kudo pas sinkronizimit), skedari në telefon, dhe objekti në bucket kur ka internet. */
export async function removeFormVideo(store: LocalStore, db: LocalDatabase, id: string) {
  const row = await db.form_videos.get(id)
  if (!row) return
  await store.remove('form_videos', id)
  const file = await db._video_files.get(id)
  // Pa skedar këtu (videoja u bë në telefonin tjetër): mund të jetë në bucket.
  await db._video_files.put({
    id,
    data: null,
    type: String(row.mime_type),
    uploaded: file ? file.uploaded : 1,
    removed: 1,
    storagePath: String(row.storage_path),
  })
}

function toRef(row: LocalRow, sets: Map<string, VideoSet>): FormVideoRef {
  const sessionId = (row.session_id as string | null) ?? null
  const setNumber = num(row.set_number)
  return {
    id: row.id,
    exerciseId: String(row.exercise_id),
    sessionId,
    setNumber,
    date: String(row.date),
    type: row.mime_type as VideoType,
    durationS: Number(row.duration_s),
    bytes: Number(row.bytes),
    width: num(row.width),
    height: num(row.height),
    storagePath: String(row.storage_path),
    createdAt: row.created_at,
    set: (sessionId && setNumber && sets.get(`${sessionId}:${row.exercise_id}:${setNumber}`)) || null,
  }
}

/** Setet e ruajtura (pa ngrohjet) të seancave, sipas "seancë:ushtrim:seti". */
async function setsOf(store: LocalStore, sessionIds: unknown[]) {
  const sessions = [...new Set(sessionIds.filter((id): id is string => typeof id === 'string' && id !== ''))]
  const sets = new Map<string, VideoSet>()
  for (const sessionId of sessions) {
    for (const set of await store.where('set_logs', 'session_id', sessionId)) {
      if (set.is_warmup) continue
      sets.set(`${sessionId}:${set.exercise_id}:${set.set_number}`, { weightKg: num(set.weight_kg), reps: num(set.reps), seconds: num(set.seconds) })
    }
  }
  return sets
}

const newestFirst = (a: FormVideoRef, b: FormVideoRef) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)

/** Videot e një ushtrimi, më e reja e para (faqja e ushtrimit). */
export async function exerciseVideos(store: LocalStore, exerciseId: string): Promise<FormVideoRef[]> {
  const rows = await store.where('form_videos', 'exercise_id', exerciseId)
  const sets = await setsOf(store, rows.map((row) => row.session_id))
  return rows.map((row) => toRef(row, sets)).sort(newestFirst)
}

/**
 * Për ekranin e videos: videoja e ruajtur e këtij seti (null kur s'ka), ajo e "herës së kaluar"
 * (seanca tjetër më e fundit me video të ushtrimit, me të njëjtin set kur e ka, përndryshe videoja e
 * fundit e asaj seance) dhe pesha me përsëritjet e setit kur është ruajtur.
 */
export async function setComparison(
  store: LocalStore,
  target: { exerciseId: string; sessionId: string; setNumber: number },
): Promise<{ current: FormVideoRef | null; previous: FormVideoRef | null; set: VideoSet | null }> {
  const videos = await exerciseVideos(store, target.exerciseId)
  const current = videos.find((video) => video.sessionId === target.sessionId && video.setNumber === target.setNumber) ?? null
  const others = videos.filter((video) => video.sessionId !== target.sessionId)
  const last = others[0]
  const sameSession = last ? others.filter((video) => (video.sessionId ?? video.id) === (last.sessionId ?? last.id)) : []
  const previous = sameSession.find((video) => video.setNumber === target.setNumber) ?? last ?? null
  const sets = await setsOf(store, [target.sessionId])
  return { current, previous, set: sets.get(`${target.sessionId}:${target.exerciseId}:${target.setNumber}`) ?? null }
}

/** Bajtët e videos: nga telefoni, ose nga bucket-i një herë (dhe ruhen); null kur nuk është ngarkuar ende. */
export async function formVideoData(db: LocalDatabase, remote: VideoRemote, video: Pick<FormVideoRef, 'id' | 'storagePath' | 'type'>): Promise<ArrayBuffer | null> {
  const local = await db._video_files.get(video.id)
  if (local?.removed) return null
  if (local?.data) return local.data
  try {
    const data = await remote.download(video.storagePath)
    await db._video_files.put({ id: video.id, data, type: video.type, uploaded: 1, removed: 0, storagePath: video.storagePath })
    return data
  } catch {
    return null
  }
}

/**
 * Sinkronizon skedarët me bucket-in: heq nga bucket-i videot e fshira (edhe nga telefoni tjetër) dhe
 * ngarkon ato që presin. Ato që dështojnë (pa internet, sesion i skaduar) provohen herën tjetër.
 */
export async function syncFormVideoFiles(db: LocalDatabase, remote: VideoRemote): Promise<{ uploaded: number; removed: number }> {
  let uploaded = 0
  let removed = 0
  const forget = async (file: VideoFile) => {
    try {
      if (file.uploaded) await remote.remove(file.storagePath)
      await db._video_files.delete(file.id)
      removed++
    } catch {
      // Mbetet në radhë.
    }
  }
  for (const file of await db._video_files.toArray()) {
    if (file.removed) {
      await forget(file)
      continue
    }
    const row = await db.form_videos.get(file.id)
    // Rreshti i fshirë nga telefoni tjetër: hiqet edhe kopja këtu (dhe objekti, nëse mbeti).
    if (row?.deleted_at) {
      await forget({ ...file, uploaded: 1 })
      continue
    }
    if (!row || file.uploaded || !file.data) continue
    try {
      await remote.upload(file.storagePath, file.data, file.type)
      await db._video_files.update(file.id, { uploaded: 1 })
      uploaded++
    } catch {
      // Pa internet ose sesion i skaduar: mbetet në radhë.
    }
  }
  return { uploaded, removed }
}

export interface StorageUsage {
  usedBytes: number
  quotaBytes: number
  ratio: number
  /** "near" nga 80%, "full" nga 100% e hapësirës së planit falas. */
  level: 'ok' | 'near' | 'full'
}

/**
 * Hapësira që zënë fotot e progresit dhe videot e formës të përdoruesit (nga rreshtat e sinkronizuar,
 * edhe ato të telefonit tjetër), kundrejt 1 GB të planit falas (V27).
 */
export async function storageUsage(store: LocalStore): Promise<StorageUsage> {
  const [photos, videos] = await Promise.all([store.all('progress_photos'), store.all('form_videos')])
  const usedBytes = [...photos, ...videos].reduce((total, row) => total + (Number(row.bytes) || 0), 0)
  const ratio = usedBytes / STORAGE_QUOTA_BYTES
  return { usedBytes, quotaBytes: STORAGE_QUOTA_BYTES, ratio, level: ratio >= 1 ? 'full' : ratio >= STORAGE_WARNING_RATIO ? 'near' : 'ok' }
}
