// Përditësimi brenda app-it (SPEC §3b, TH-23), pa UI dhe pa Supabase: kontrolli i latest.json,
// shkarkimi i APK-së me SHA-256 të pritur dhe instalimi. Portat jepen nga app-data (Supabase) dhe
// nga plugin-i native AppUpdater; këtu jeton vetëm rendi dhe gjendja që sheh përdoruesi.

export interface Release {
  version: string
  apk: string
  sha256: string
  bytes: number
  notes: string[]
  publishedAt: string
}

export type UpdateState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'current' }
  | { status: 'available'; release: Release }
  /** Android-i ende nuk e lejon Training Hub të instalojë app ("Instalo app të panjohura"). */
  | { status: 'permission'; release: Release }
  | { status: 'downloading'; release: Release; progress: number }
  | { status: 'installing'; release: Release }
  | { status: 'failed'; reason: 'check' | 'download' | 'mismatch' | 'install'; release?: Release }

export interface InstallStatus {
  status: 'pending_user' | 'failure'
  /** Përdoruesi e anuloi dritaren e sistemit. */
  aborted: boolean
  message: string | null
}

export interface UpdatePorts {
  currentVersion: string
  online(): boolean
  /** latest.json nga ruajtja e versioneve; null kur s'ka asnjë. */
  latest(): Promise<unknown>
  /** Lidhje e firmosur, me afat, për APK-në. */
  downloadUrl(apk: string): Promise<string>
  canInstall(): Promise<boolean>
  openInstallSettings(): Promise<void>
  /** Shkarkon dhe verifikon SHA-256; gabimi me `code: 'HASH_MISMATCH'` kur skedari nuk përputhet. */
  download(url: string, sha256: string, onProgress: (fraction: number) => void): Promise<string>
  install(path: string, sha256: string): Promise<void>
  now(): number
  cache: { get(): CachedCheck | null; set(value: CachedCheck): void }
}

/** Kontrolli i fundit: kur u bë dhe versioni që u gjet (null: asnjë version në bucket). */
export interface CachedCheck {
  at: number
  release: Release | null
}

export const CHECK_INTERVAL_MS = 6 * 3_600_000
/** Pas një kontrolli automatik që dështoi, tjetri vjen pas 30 minutash, jo në çdo rikthim në app. */
export const FAILED_CHECK_RETRY_MS = 30 * 60_000
const VERSION = /^\d+\.\d+\.\d+$/
const SHA256 = /^[0-9a-f]{64}$/

export function compareVersions(a: string, b: string) {
  const [x, y] = [a, b].map((value) => value.split('.').map(Number))
  for (let index = 0; index < 3; index++) {
    if (x[index] !== y[index]) return x[index] - y[index]
  }
  return 0
}

/** latest.json nga rrjeti: pranohet vetëm kur çdo fushë ka formën e pritur dhe APK-ja i përket versionit. */
export function parseRelease(value: unknown): Release | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  const { version, apk, sha256, bytes, publishedAt } = raw
  if (typeof version !== 'string' || !VERSION.test(version)) return null
  if (apk !== `TrainingHub-${version}.apk`) return null
  if (typeof sha256 !== 'string' || !SHA256.test(sha256)) return null
  if (typeof bytes !== 'number' || !(bytes > 0)) return null
  if (typeof publishedAt !== 'string') return null
  const notes = Array.isArray(raw.notes) ? raw.notes.filter((note): note is string => typeof note === 'string') : []
  return { version, apk, sha256, bytes, notes, publishedAt }
}

export function createUpdater(ports: UpdatePorts) {
  let state: UpdateState = { status: 'idle' }
  const listeners = new Set<(state: UpdateState) => void>()
  const set = (next: UpdateState) => {
    state = next
    for (const listener of listeners) listener(state)
  }
  const fromRelease = (release: Release | null): UpdateState =>
    release && compareVersions(release.version, ports.currentVersion) > 0 ? { status: 'available', release } : { status: 'current' }
  const busy = () => state.status === 'checking' || state.status === 'downloading' || state.status === 'installing'
  const pending = () => ('release' in state ? state.release : undefined)
  const fetchRelease = async () => {
    const release = parseRelease(await ports.latest())
    ports.cache.set({ at: ports.now(), release })
    return release
  }

  return {
    getState: () => state,
    subscribe(listener: (state: UpdateState) => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },

    /** Kontrolli automatik vjen të shumtën një herë në 6 orë; `force` ("Kontrollo tani") jo. */
    async check({ force = false }: { force?: boolean } = {}) {
      if (busy()) return
      const cached = ports.cache.get()
      if (!force && cached && ports.now() - cached.at < CHECK_INTERVAL_MS) {
        if (state.status === 'idle') set(fromRelease(cached.release))
        return
      }
      if (!ports.online()) {
        if (force) set({ status: 'failed', reason: 'check' })
        return
      }
      const before = state
      set({ status: 'checking' })
      try {
        set(fromRelease(await fetchRelease()))
      } catch {
        // Versioni i njohur mbetet; kontrolli automatik provohet sërish pas 30 minutash.
        const release = cached?.release ?? null
        ports.cache.set({ at: ports.now() - CHECK_INTERVAL_MS + FAILED_CHECK_RETRY_MS, release })
        // Kontrolli automatik hesht; vetëm "Kontrollo tani" e thotë.
        set(force ? { status: 'failed', reason: 'check' } : before.status === 'idle' && release ? fromRelease(release) : before)
      }
    },

    async update() {
      let release = pending()
      if (!release || busy()) return
      set({ status: 'downloading', release, progress: 0 })
      try {
        if (!(await ports.canInstall())) {
          set({ status: 'permission', release })
          return
        }
        // latest.json përsëri: versioni në kujtesë mund të jetë hequr nga bucket-i pas dy versioneve
        // të reja, ose të jetë tërhequr.
        if (ports.online()) {
          const fresh = fromRelease(await fetchRelease())
          if (fresh.status !== 'available') {
            set(fresh)
            return
          }
          release = fresh.release
          set({ status: 'downloading', release, progress: 0 })
        }
        const current = release
        const url = await ports.downloadUrl(current.apk)
        const path = await ports.download(url, current.sha256, (progress) => set({ status: 'downloading', release: current, progress }))
        set({ status: 'installing', release: current })
        await ports.install(path, current.sha256)
      } catch (error) {
        const code = (error as { code?: unknown } | null)?.code
        const reason = code === 'HASH_MISMATCH' ? 'mismatch' : state.status === 'installing' ? 'install' : 'download'
        set({ status: 'failed', reason, release })
      }
    },

    allowInstall: () => ports.openInstallSettings(),

    /**
     * Përgjigja e sistemit pas instalimit; suksesi e mbyll vetë app-in. Kur sistemi hap dritaren e
     * konfirmimit, fleta kthehet te "Përditëso": po u la dritarja pa përgjigje (Home), ose Android-i
     * nuk e hapi dot, nuk vjen asnjë përgjigje tjetër dhe përdoruesi duhet të mund të provojë sërish.
     */
    onInstallStatus(event: InstallStatus) {
      if (state.status !== 'installing') return
      const { release } = state
      if (event.status === 'pending_user' || event.aborted) set({ status: 'available', release })
      else set({ status: 'failed', reason: 'install', release })
    },
  }
}

export type Updater = ReturnType<typeof createUpdater>
