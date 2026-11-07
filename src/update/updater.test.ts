import { compareVersions, createUpdater, parseRelease, type Release, type UpdatePorts } from './updater'

const SHA = 'a'.repeat(64)
const release = (version: string, extra: Partial<Release> = {}): Release => ({
  version,
  apk: `TrainingHub-${version}.apk`,
  sha256: SHA,
  bytes: 28_000_000,
  notes: ['Trupi në 3D'],
  publishedAt: '2026-11-08T10:00:00Z',
  ...extra,
})

const HOUR = 3_600_000

function setup(overrides: Partial<UpdatePorts> = {}) {
  let now = Date.parse('2026-11-08T12:00:00Z')
  let cached: { at: number; release: Release | null } | null = null
  const calls: string[] = []
  const ports: UpdatePorts = {
    currentVersion: '0.15.0',
    online: () => true,
    latest: vi.fn(async () => release('0.16.0')),
    downloadUrl: vi.fn(async (apk: string) => `https://storage/signed/${apk}`),
    canInstall: vi.fn(async () => true),
    openInstallSettings: vi.fn(async () => {
      calls.push('settings')
    }),
    download: vi.fn(async (url: string, sha256: string, onProgress: (fraction: number) => void) => {
      calls.push(`download ${url} ${sha256.slice(0, 4)}`)
      onProgress(0.5)
      onProgress(1)
      return '/cache/update.apk'
    }),
    install: vi.fn(async (path: string, sha256: string) => {
      calls.push(`install ${path} ${sha256.slice(0, 4)}`)
    }),
    now: () => now,
    cache: { get: () => cached, set: (value) => (cached = value) },
    ...overrides,
  }
  const updater = createUpdater(ports)
  return { updater, ports, calls, advance: (ms: number) => (now += ms), cached: () => cached }
}

describe('përditësimi brenda app-it', () => {
  it('krahason versionet si numra, jo si tekst', () => {
    expect(compareVersions('0.10.0', '0.9.0')).toBeGreaterThan(0)
    expect(compareVersions('0.15.0', '0.15.0')).toBe(0)
    expect(compareVersions('1.0.0', '0.99.99')).toBeGreaterThan(0)
    expect(compareVersions('0.15.0', '0.15.1')).toBeLessThan(0)
  })

  it('pranon vetëm një latest.json të plotë: versioni, APK-ja me emrin e pritur dhe SHA-256', () => {
    expect(parseRelease(release('0.16.0'))).toEqual(release('0.16.0'))
    expect(parseRelease({ ...release('0.16.0'), apk: '../../etc/passwd' })).toBeNull()
    expect(parseRelease({ ...release('0.16.0'), apk: 'TrainingHub-0.17.0.apk' })).toBeNull()
    expect(parseRelease({ ...release('0.16.0'), sha256: 'xyz' })).toBeNull()
    expect(parseRelease({ ...release('0.16.0'), version: '0.16' })).toBeNull()
    expect(parseRelease({ ...release('0.16.0'), notes: 'jo listë' })).toEqual(release('0.16.0', { notes: [] }))
    expect(parseRelease(null)).toBeNull()
  })

  it('një version më i ri del si i disponueshëm; i njëjti ose më i vjetër jo', async () => {
    const { updater } = setup()
    await updater.check()
    expect(updater.getState()).toMatchObject({ status: 'available', release: { version: '0.16.0' } })

    const same = setup({ latest: async () => release('0.15.0') })
    await same.updater.check()
    expect(same.updater.getState()).toMatchObject({ status: 'current' })
  })

  it('kontrollon të shumtën një herë në 6 orë; ndërkohë kujton versionin e gjetur', async () => {
    const { updater, ports, advance } = setup()
    await updater.check()
    await updater.check()
    expect(ports.latest).toHaveBeenCalledTimes(1)

    // App-i rihapet: gjendja vjen nga kujtesa, pa kërkesë të re.
    const reopened = createUpdater(ports)
    await reopened.check()
    expect(reopened.getState()).toMatchObject({ status: 'available', release: { version: '0.16.0' } })
    expect(ports.latest).toHaveBeenCalledTimes(1)

    advance(6 * HOUR)
    await reopened.check()
    expect(ports.latest).toHaveBeenCalledTimes(2)
    // "Kontrollo tani" nuk pret.
    await reopened.check({ force: true })
    expect(ports.latest).toHaveBeenCalledTimes(3)
  })

  it('pa internet nuk kontrollon; "Kontrollo tani" pa internet e thotë', async () => {
    const offline = setup({ online: () => false })
    await offline.updater.check()
    expect(offline.ports.latest).not.toHaveBeenCalled()
    expect(offline.updater.getState()).toEqual({ status: 'idle' })
    await offline.updater.check({ force: true })
    expect(offline.updater.getState()).toEqual({ status: 'failed', reason: 'check' })
  })

  it('një gabim i kontrollit automatik nuk e shqetëson përdoruesin dhe provohet sërish pas 30 minutash', async () => {
    const failing = setup({ latest: vi.fn(async () => Promise.reject(new Error('500'))) })
    await failing.updater.check()
    expect(failing.updater.getState()).toEqual({ status: 'idle' })
    // Çdo rikthim në app nuk dërgon kërkesë të re menjëherë.
    await failing.updater.check()
    expect(failing.ports.latest).toHaveBeenCalledTimes(1)
    failing.advance(30 * 60_000)
    await failing.updater.check()
    expect(failing.ports.latest).toHaveBeenCalledTimes(2)
    await failing.updater.check({ force: true })
    expect(failing.updater.getState()).toMatchObject({ status: 'failed', reason: 'check' })
  })

  it('një gabim nuk e harron versionin e ri të gjetur më parë', async () => {
    let fail = false
    const { updater, ports, advance } = setup({ latest: vi.fn(async () => (fail ? Promise.reject(new Error('500')) : release('0.16.0'))) })
    await updater.check()
    fail = true
    advance(7 * HOUR)
    const reopened = createUpdater(ports)
    await reopened.check()
    expect(reopened.getState()).toMatchObject({ status: 'available', release: { version: '0.16.0' } })
  })

  it('"Përditëso": shkarkon nga lidhja e firmosur me SHA-256 e pritur, tregon përparimin dhe instalon', async () => {
    const { updater, calls } = setup()
    const states: string[] = []
    updater.subscribe((state) => states.push(state.status === 'downloading' ? `downloading ${state.progress}` : state.status))
    await updater.check()
    await updater.update()
    expect(calls).toEqual(['download https://storage/signed/TrainingHub-0.16.0.apk aaaa', 'install /cache/update.apk aaaa'])
    expect(states).toEqual(['checking', 'available', 'downloading 0', 'downloading 0', 'downloading 0.5', 'downloading 1', 'installing'])
  })

  it('pa lejen "Instalo app të panjohura" kërkon lejen, pa shkarkuar asgjë', async () => {
    const { updater, calls } = setup({ canInstall: async () => false })
    await updater.check()
    await updater.update()
    expect(updater.getState()).toMatchObject({ status: 'permission', release: { version: '0.16.0' } })
    expect(calls).toEqual([])
    await updater.allowInstall()
    expect(calls).toEqual(['settings'])
  })

  it('skedari që nuk përputhet ose shkarkimi i dështuar thuhen veç; provohet përsëri', async () => {
    const mismatch = setup({
      download: async () => {
        throw Object.assign(new Error('hash'), { code: 'HASH_MISMATCH' })
      },
    })
    await mismatch.updater.check()
    await mismatch.updater.update()
    expect(mismatch.updater.getState()).toMatchObject({ status: 'failed', reason: 'mismatch', release: { version: '0.16.0' } })

    const broken = setup({
      download: async () => {
        throw new Error('network')
      },
    })
    await broken.updater.check()
    await broken.updater.update()
    expect(broken.updater.getState()).toMatchObject({ status: 'failed', reason: 'download' })
    await broken.updater.update()
    expect(broken.ports.downloadUrl).toHaveBeenCalledTimes(2)
  })

  it('sistemi: dritarja e konfirmimit e kthen fletën te "Përditëso", që të mos ngecë po u la pa përgjigje', async () => {
    const { updater } = setup()
    await updater.check()
    await updater.update()
    expect(updater.getState()).toMatchObject({ status: 'installing' })
    updater.onInstallStatus({ status: 'pending_user', aborted: false, message: null })
    expect(updater.getState()).toMatchObject({ status: 'available', release: { version: '0.16.0' } })
  })

  it('sistemi: anulimi kthen te "i disponueshëm", një dështim thuhet; pa përditësim në pritje injorohet', async () => {
    const { updater } = setup()
    updater.onInstallStatus({ status: 'failure', aborted: false, message: 'x' })
    expect(updater.getState()).toEqual({ status: 'idle' })
    await updater.check()
    await updater.update()
    updater.onInstallStatus({ status: 'failure', aborted: true, message: 'User aborted' })
    expect(updater.getState()).toMatchObject({ status: 'available' })
    await updater.update()
    updater.onInstallStatus({ status: 'failure', aborted: false, message: 'INSTALL_FAILED_UPDATE_INCOMPATIBLE' })
    expect(updater.getState()).toMatchObject({ status: 'failed', reason: 'install' })
  })

  it('"Përditëso" lexon përsëri latest.json: një version në kujtesë që është hequr zëvendësohet nga i fundit', async () => {
    let latest = release('0.16.0')
    const { updater, calls } = setup({ latest: vi.fn(async () => latest) })
    await updater.check()
    latest = release('0.18.0', { sha256: 'b'.repeat(64) })
    await updater.update()
    expect(calls).toEqual(['download https://storage/signed/TrainingHub-0.18.0.apk bbbb', 'install /cache/update.apk bbbb'])
  })

  it('"Përditëso" kur versioni i ri është tërhequr: app-i është i fundit, pa shkarkim', async () => {
    let latest: Release | null = release('0.16.0')
    const { updater, calls } = setup({ latest: vi.fn(async () => latest) })
    await updater.check()
    latest = null
    await updater.update()
    expect(updater.getState()).toEqual({ status: 'current' })
    expect(calls).toEqual([])
  })

  it('një instalim që nuk nis thuhet si dështim i instalimit, jo i shkarkimit', async () => {
    const { updater } = setup({ install: async () => Promise.reject(new Error('INSTALL')) })
    await updater.check()
    await updater.update()
    expect(updater.getState()).toMatchObject({ status: 'failed', reason: 'install', release: { version: '0.16.0' } })
  })

  it('pa plugin-in native (ose me gabim te leja) nuk ngec te shkarkimi', async () => {
    const { updater } = setup({ canInstall: () => Promise.reject(new Error('not implemented')) })
    await updater.check()
    await updater.update()
    expect(updater.getState()).toMatchObject({ status: 'failed', reason: 'download', release: { version: '0.16.0' } })
  })

  it('nuk nis dy shkarkime njëherësh', async () => {
    let finish: (path: string) => void = () => {}
    const { updater, ports } = setup({ download: vi.fn(() => new Promise<string>((resolve) => (finish = resolve))) })
    await updater.check()
    const first = updater.update()
    await updater.update()
    await vi.waitFor(() => expect(ports.download).toHaveBeenCalled())
    finish('/cache/update.apk')
    await first
    expect(ports.downloadUrl).toHaveBeenCalledTimes(1)
  })
})
