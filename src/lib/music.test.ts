import { controlsOf, createMusic, isPlaying, type MusicBridge, musicAppName, parseSession, positionNow } from './music'

// Muzika (V29, V2-E1-12): sesioni i app-it të muzikës nga plugin-i native (MusicPlugin.java), i
// kthyer në një formë të qëndrueshme për ekranet dhe për njoftimin e seancës (E1-08). Plugin-i i imituar.

const spotify = {
  packageName: 'com.spotify.music',
  appName: 'Spotify',
  title: 'Edhe një përsëritje',
  artist: 'Kaltrina V.',
  album: 'Prova',
  durationMs: 188_000,
  hasArtwork: true,
  canOpen: true,
  state: 'playing',
  speed: 1,
  positionMs: 72_000,
  positionAt: 1_000_000,
  activeQueueItemId: -1,
  actions: ['play', 'pause', 'next', 'previous', 'seekTo'],
  queue: { length: -1, title: null, upcoming: [] },
}

describe('sesioni i medias nga plugin-i', () => {
  it('lexon titullin, artistin, gjendjen, pozicionin dhe veprimet që shpall app-i', () => {
    const session = parseSession(spotify)!
    expect(session).toMatchObject({
      packageName: 'com.spotify.music',
      appName: 'Spotify',
      title: 'Edhe një përsëritje',
      artist: 'Kaltrina V.',
      durationMs: 188_000,
      status: 'playing',
      positionMs: 72_000,
      positionAt: 1_000_000,
      queue: null,
      canOpen: true,
    })
    expect(controlsOf(session)).toEqual({ playPause: true, previous: true, next: true, seek: true, queue: false })
  })

  it('pa radhë (getQueue() == null) radha është null; me radhë jep këngët e ardhshme', () => {
    expect(parseSession(spotify)!.queue).toBeNull()
    const youtube = parseSession({
      ...spotify,
      packageName: 'com.google.android.apps.youtube.music',
      appName: null,
      actions: ['playPause', 'next', 'previous', 'skipToQueueItem'],
      queue: {
        length: 24,
        title: 'Mix',
        upcoming: [
          { id: 7, title: 'Rekord i ri', subtitle: 'DJ Prush' },
          { id: 8, title: 'Peshë e rëndë', subtitle: null },
          { id: 9, title: null, subtitle: 'Pa titull' },
        ],
      },
    })!
    expect(youtube.queue).toEqual([
      { id: 7, title: 'Rekord i ri', artist: 'DJ Prush' },
      { id: 8, title: 'Peshë e rëndë', artist: null },
    ])
    // "playPause" vlen për të dyja; radha vlen vetëm me skipToQueueItem dhe këngë në të.
    expect(controlsOf(youtube)).toEqual({ playPause: true, previous: true, next: true, seek: false, queue: true })
    expect(controlsOf({ ...youtube, queue: [] }).queue).toBe(false)
    expect(controlsOf({ ...youtube, actions: ['next'] }).queue).toBe(false)
  })

  it('një sesion pa paketë ose një vlerë e çuditshme nuk e prish ekranin', () => {
    expect(parseSession(null)).toBeNull()
    expect(parseSession({})).toBeNull()
    const odd = parseSession({ packageName: 'x.y', state: 'weird', durationMs: -1, speed: 'fast', actions: 'play', queue: null })!
    expect(odd).toMatchObject({ title: null, artist: null, durationMs: null, status: 'other', speed: 1, actions: [], queue: null })
    expect(controlsOf(odd)).toEqual({ playPause: false, previous: false, next: false, seek: false, queue: false })
  })

  it('emri i app-it: nga sistemi, përndryshe nga paketat e njohura, përndryshe null', () => {
    expect(musicAppName(parseSession(spotify)!)).toBe('Spotify')
    expect(musicAppName(parseSession({ ...spotify, appName: null })!)).toBe('Spotify')
    expect(musicAppName(parseSession({ ...spotify, appName: '', packageName: 'com.google.android.apps.youtube.music' })!)).toBe('YouTube Music')
    expect(musicAppName(parseSession({ ...spotify, appName: null, packageName: 'org.example.player' })!)).toBeNull()
  })

  it('pozicioni ecën vetë gjatë luajtjes, me shpejtësinë, deri te kohëzgjatja; në pauzë rri', () => {
    const playing = parseSession(spotify)!
    expect(positionNow(playing, 1_010_000)).toBe(82_000)
    expect(positionNow({ ...playing, speed: 2 }, 1_010_000)).toBe(92_000)
    expect(positionNow(playing, 1_000_000 + 500_000)).toBe(188_000)
    expect(positionNow({ ...playing, status: 'paused' }, 1_010_000)).toBe(72_000)
    expect(positionNow({ ...playing, durationMs: null }, 1_010_000)).toBe(82_000)
    expect(isPlaying(playing)).toBe(true)
    expect(isPlaying({ ...playing, status: 'paused' })).toBe(false)
  })
})

function fakeBridge(overrides: Partial<MusicBridge> = {}) {
  const listeners = new Set<(event: { session: unknown }) => void>()
  const bridge: MusicBridge & { emit: (session: unknown) => void } = {
    available: () => true,
    getAccess: vi.fn(async () => ({ granted: true, sdk: 34, installer: null })),
    openAccessSettings: vi.fn(async () => {}),
    openAppInfo: vi.fn(async () => {}),
    getNowPlaying: vi.fn(async () => ({ session: spotify })),
    control: vi.fn(async () => {}),
    openApp: vi.fn(async () => {}),
    startListening: vi.fn(async () => {}),
    stopListening: vi.fn(async () => {}),
    addListener: vi.fn(async (_event: 'nowPlaying', listener: (event: { session: unknown }) => void) => {
      listeners.add(listener)
      return { remove: async () => void listeners.delete(listener) }
    }),
    emit: (session) => listeners.forEach((listener) => listener({ session })),
    ...overrides,
  }
  return bridge
}

describe('API e muzikës (për seancën dhe njoftimin e E1-08)', () => {
  it('pa plugin (shfletuesi, provat) muzika nuk ofrohet dhe asgjë nuk thërret native-in', async () => {
    const bridge = fakeBridge({ available: () => false })
    const music = createMusic(bridge)
    expect(music.available()).toBe(false)
    expect(await music.access()).toEqual({ granted: false, sdk: null, sideloaded: false })
    expect(bridge.getAccess).not.toHaveBeenCalled()
  })

  it('leja: Android 13+ dhe APK jashtë dyqanit = "Allow restricted settings" mund të duhet', async () => {
    const music = createMusic(fakeBridge({ getAccess: async () => ({ granted: false, sdk: 34, installer: 'com.google.android.packageinstaller' }) }))
    expect(await music.access()).toEqual({ granted: false, sdk: 34, sideloaded: true })
    const store = createMusic(fakeBridge({ getAccess: async () => ({ granted: false, sdk: 34, installer: 'com.android.vending' }) }))
    expect((await store.access()).sideloaded).toBe(false)
  })

  it('dëgjimi nis me dëgjuesin e parë dhe ndalet me të fundit; çdo ngjarje vjen e lexuar', async () => {
    const bridge = fakeBridge()
    const music = createMusic(bridge)
    const first = vi.fn()
    const second = vi.fn()
    const stopFirst = music.subscribe(first)
    const stopSecond = music.subscribe(second)
    await vi.waitFor(() => expect(bridge.startListening).toHaveBeenCalledTimes(1))
    bridge.emit({ ...spotify, title: 'Kënga tjetër' })
    expect(first).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Kënga tjetër' }))
    expect(second).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Kënga tjetër' }))
    expect(music.current()).toMatchObject({ title: 'Kënga tjetër' })
    bridge.emit(null)
    expect(first).toHaveBeenLastCalledWith(null)
    stopFirst()
    expect(bridge.stopListening).not.toHaveBeenCalled()
    stopSecond()
    await vi.waitFor(() => expect(bridge.stopListening).toHaveBeenCalledTimes(1))
  })

  it('pa leje dëgjimi nuk nis dhe gjendja mbetet "pa leje"', async () => {
    const bridge = fakeBridge({ startListening: vi.fn(async () => Promise.reject(Object.assign(new Error('Mungon qasja'), { code: 'NO_ACCESS' }))) })
    const music = createMusic(bridge)
    const listener = vi.fn()
    music.subscribe(listener)
    await vi.waitFor(() => expect(music.state()).toBe('no-access'))
    expect(listener).not.toHaveBeenCalled()
  })

  it('kontrollet: kërkesa shkon te app-i; refuzimet kthehen me arsyen, pa hedhur gabim', async () => {
    const bridge = fakeBridge()
    const music = createMusic(bridge)
    expect(await music.control('next')).toBe('ok')
    expect(bridge.control).toHaveBeenCalledWith({ action: 'next' })
    expect(await music.control('seekTo', { positionMs: 30_000 })).toBe('ok')
    expect(bridge.control).toHaveBeenLastCalledWith({ action: 'seekTo', positionMs: 30_000 })
    expect(await music.control('skipToQueueItem', { queueItemId: 7 })).toBe('ok')
    expect(bridge.control).toHaveBeenLastCalledWith({ action: 'skipToQueueItem', queueItemId: 7 })

    const reject = (code: string) => fakeBridge({ control: async () => Promise.reject(Object.assign(new Error(code), { code })) })
    expect(await createMusic(reject('UNSUPPORTED')).control('next')).toBe('unsupported')
    expect(await createMusic(reject('NO_SESSION')).control('play')).toBe('no-session')
    expect(await createMusic(reject('NO_ACCESS')).control('pause')).toBe('no-access')
    expect(await createMusic(reject('BOOM')).control('pause')).toBe('error')
    expect(await createMusic(fakeBridge({ available: () => false })).control('pause')).toBe('unavailable')
  })

  it('hap app-in e muzikës te sesioni që luan', async () => {
    const bridge = fakeBridge()
    expect(await createMusic(bridge).openApp()).toBe('ok')
    expect(bridge.openApp).toHaveBeenCalled()
  })
})
