import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { LocalDatabase } from '@/data/db'
import type { LocalStore } from '@/data/store'
import { language } from '@/i18n'

// Muzika "Trupi në ritëm" te seanca (V2-E1-12): mini-player-i në vendin e rezervuar, ekrani i plotë,
// pushimi, lidhja dhe leja, "Prek ritmin". Seanca e vërtetë mbi IndexedDB në memorie; plugin-i native
// i muzikës dhe tempo (GetSongBPM, AcousticBrainz) janë të imituara, pa asnjë kërkesë rrjeti.

const data = vi.hoisted(() => ({ store: null as unknown as LocalStore, db: null as unknown as LocalDatabase }))
vi.mock('@/data/app-data', async () => {
  const { createDatabase } = await import('@/data/db')
  const { createLocalStore } = await import('@/data/store')
  const db = createDatabase(`music-${crypto.randomUUID()}`)
  let clock = Date.now()
  const store = createLocalStore(db, { userId: () => '11111111-1111-4111-8111-111111111111', now: () => new Date((clock += 1000)) })
  data.store = store
  data.db = db
  return { store, useAppUpdate: () => ({ status: 'idle' }), updater: {}, useLocalQuery: (await import('@/test/local-query')).useLocalQueryFor(store) }
})

// Plugin-i i imituar (MusicPlugin.java): leja, sesioni që luan dhe kontrollet.
const native = vi.hoisted(() => {
  const listeners = new Set<(event: { session: unknown }) => void>()
  const state = {
    granted: true,
    sdk: 34,
    installer: 'com.google.android.packageinstaller' as string | null,
    session: null as Record<string, unknown> | null,
  }
  const emit = () => listeners.forEach((listener) => listener({ session: state.session }))
  const bridge = {
    available: () => true,
    getAccess: vi.fn(async () => ({ granted: state.granted, sdk: state.sdk, installer: state.installer })),
    openAccessSettings: vi.fn(async () => {}),
    openAppInfo: vi.fn(async () => {}),
    getNowPlaying: vi.fn(async () => ({ session: state.session })),
    control: vi.fn(async (_options: { action: string; positionMs?: number; queueItemId?: number }) => {}),
    openApp: vi.fn(async () => {}),
    startListening: vi.fn(async () => {
      if (!state.granted) throw Object.assign(new Error('Mungon qasja te njoftimet'), { code: 'NO_ACCESS' })
      queueMicrotask(emit)
    }),
    stopListening: vi.fn(async () => {}),
    addListener: vi.fn(async (_event: string, listener: (event: { session: unknown }) => void) => {
      listeners.add(listener)
      return { remove: async () => void listeners.delete(listener) }
    }),
  }
  return { state, bridge, emit }
})
vi.mock('@/lib/music-native', () => ({ nativeMusicBridge: native.bridge }))

// Tempo e imituar sipas titullit; "Prek ritmin" ruan te e njëjta hartë.
const tempos = vi.hoisted(() => ({
  values: new Map<string, { bpm: number; source: 'getsongbpm' | 'acousticbrainz' | 'tap'; url: string | null; at: number }>(),
  saved: [] as { title: string | null; bpm: number }[],
}))
vi.mock('@/data/song-tempo', () => ({
  findTempo: async (song: { title: string | null }) => {
    const tempo = tempos.values.get(song.title ?? '')
    return tempo ? { status: 'found', tempo } : { status: 'missing' }
  },
  saveTapTempo: async (song: { title: string | null }, bpm: number) => {
    const tempo = { bpm, source: 'tap' as const, url: null, at: 1 }
    tempos.values.set(song.title ?? '', tempo)
    tempos.saved.push({ title: song.title, bpm })
    return tempo
  },
}))

const playing = (overrides: Record<string, unknown> = {}) => ({
  packageName: 'com.spotify.music',
  appName: 'Spotify',
  title: 'Edhe një përsëritje',
  artist: 'Kaltrina V.',
  durationMs: 188_000,
  canOpen: true,
  state: 'playing',
  speed: 1,
  positionMs: 72_000,
  positionAt: Date.now(),
  actions: ['play', 'pause', 'next', 'previous', 'seekTo'],
  queue: { length: -1, title: null, upcoming: [] },
  ...overrides,
})

async function startSession() {
  const { completeOnboarding } = await import('@/data/profile')
  const { startWorkout } = await import('@/data/training')
  await import('@/data/app-data')
  await Promise.all(data.db.tables.map((table) => table.clear()))
  localStorage.clear()
  await completeOnboarding(data.store, { weightKg: 80, trainingDays: [1, 2, 4, 5], trainingTime: '18:00', wakeTime: '07:00', sleepTime: '23:00' })
  return startWorkout(data.store)
}

async function renderSession(path = '/seanca') {
  const { appRoutes } = await import('@/router')
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  await screen.findByRole('button', { name: /^(Ruaj setin|Log set)$/ })
  return router
}

const music = () => screen.findByRole('region', { name: /^(Muzika|Music)$/ })

beforeEach(async () => {
  native.state.granted = true
  native.state.sdk = 34
  native.state.installer = 'com.google.android.packageinstaller'
  native.state.session = playing()
  tempos.values.clear()
  tempos.saved = []
  tempos.values.set('Edhe një përsëritje', { bpm: 138, source: 'getsongbpm', url: 'https://getsongbpm.com/song/edhe/x1', at: 1 })
  vi.clearAllMocks()
  await startSession()
})

afterEach(() => {
  language.set('sq')
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
})

describe('mini-player-i te seanca', () => {
  it('kënga që luan me tempon, "Pauzë" dhe "Kënga tjetër" mbi "Ruaj setin"; prekja dërgon kërkesën te app-i', async () => {
    const user = userEvent.setup()
    await renderSession()
    const card = await music()
    await within(card).findByText('138 BPM · Kaltrina V.')
    expect(within(card).getByText('Edhe një përsëritje')).toBeInTheDocument()
    // Vendi i rezervuar: mbi veprimin kryesor.
    const save = screen.getByRole('button', { name: 'Ruaj setin' })
    expect(card.compareDocumentPosition(save) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await user.click(within(card).getByRole('button', { name: 'Pauzë' }))
    expect(native.bridge.control).toHaveBeenLastCalledWith({ action: 'pause' })
    await user.click(within(card).getByRole('button', { name: 'Kënga tjetër' }))
    expect(native.bridge.control).toHaveBeenLastCalledWith({ action: 'next' })
  })

  it('shfaq vetëm kontrollet që pranon app-i; kënga e re vjen nga ngjarja e plugin-it', async () => {
    native.state.session = playing({ actions: ['play'], state: 'paused' })
    await renderSession()
    const card = await music()
    expect(await within(card).findByRole('button', { name: 'Luaj' })).toBeInTheDocument()
    expect(within(card).queryByRole('button', { name: 'Kënga tjetër' })).toBeNull()
    tempos.values.set('Rekord i ri', { bpm: 136, source: 'acousticbrainz', url: null, at: 1 })
    native.state.session = playing({ title: 'Rekord i ri', artist: 'DJ Prush' })
    act(() => native.emit())
    await within(card).findByText('136 BPM · DJ Prush')
  })

  it('pa këngë: "Asnjë app muzike nuk luan", pa kontrolle', async () => {
    native.state.session = null
    await renderSession()
    const card = await music()
    expect(await within(card).findByText('Asnjë app muzike nuk luan')).toBeInTheDocument()
    expect(within(card).queryAllByRole('button')).toHaveLength(0)
  })

  it('një veprim që app-i nuk e pranon thuhet me fjalë te ekrani i plotë', async () => {
    const user = userEvent.setup()
    native.bridge.control.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'UNSUPPORTED' }))
    await renderSession('/seanca?ritmi=1')
    const dialog = await screen.findByRole('dialog', { name: 'Trupi në ritëm' })
    await user.click(await within(dialog).findByRole('button', { name: 'Kënga tjetër' }))
    expect(await within(dialog).findByText('App-i i muzikës nuk e pranon këtë veprim.')).toBeInTheDocument()
  })
})

describe('ekrani "Trupi në ritëm"', () => {
  it('muskujt e sotëm, tempo me lidhjen te GetSongBPM.com, kontrollet dhe pozicioni', async () => {
    const user = userEvent.setup()
    await renderSession()
    await user.click(await within(await music()).findByRole('button', { name: /^Hap Trupi në ritëm: Edhe një përsëritje, Kaltrina V., 138 BPM$/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Trupi në ritëm' })
    expect(within(dialog).getByText('Luhet te Spotify')).toBeInTheDocument()
    expect(within(dialog).getByText('Muskujt e sotëm', { selector: 'span' })).toBeInTheDocument()
    expect(within(dialog).getByRole('img', { name: /pulsojnë me 138 BPM\.$/ })).toBeInTheDocument()
    expect(within(dialog).getByText('138')).toBeInTheDocument()
    const link = within(dialog).getByRole('link', { name: 'Tempo nga GetSongBPM.com' })
    expect(link).toHaveAttribute('href', 'https://getsongbpm.com/song/edhe/x1')
    expect(within(dialog).getByRole('slider', { name: 'Pozicioni i këngës' })).toHaveAttribute('aria-valuetext', expect.stringMatching(/^1:1\d nga 3:08$/))
    await user.click(within(dialog).getByRole('button', { name: 'Kënga e mëparshme' }))
    expect(native.bridge.control).toHaveBeenLastCalledWith({ action: 'previous' })
    await user.click(within(dialog).getByRole('button', { name: 'Hap Spotify' }))
    expect(native.bridge.openApp).toHaveBeenCalled()
    // Pozicioni: rrëshqitësi dërgon seekTo kur lëshohet.
    const slider = within(dialog).getByRole('slider', { name: 'Pozicioni i këngës' })
    fireEvent.change(slider, { target: { value: '30' } })
    fireEvent.pointerUp(slider)
    expect(native.bridge.control).toHaveBeenLastCalledWith({ action: 'seekTo', positionMs: 30_000 })
    // Burimi i shkencës te karta.
    expect(within(dialog).getByText('Burimi: Terry et al., 2020, Psychological Bulletin')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Kthehu te seanca' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('pa radhë dhe me një këngë të ngadaltë: vetëm "Kalo këngën", pa premtuar tempon e së radhës', async () => {
    const user = userEvent.setup()
    tempos.values.set('Edhe një përsëritje', { bpm: 98, source: 'acousticbrainz', url: null, at: 1 })
    await renderSession('/seanca?ritmi=1')
    const dialog = await screen.findByRole('dialog', { name: 'Trupi në ritëm' })
    expect(await within(dialog).findByText('Kjo këngë ka 98 BPM. Për setet ndihmon muzika 120–140 BPM.')).toBeInTheDocument()
    expect(within(dialog).queryByRole('heading', { name: 'Pastaj' })).toBeNull()
    expect(within(dialog).getByText('Tempo nga AcousticBrainz')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Kalo këngën' }))
    expect(native.bridge.control).toHaveBeenLastCalledWith({ action: 'next' })
  })

  it('me radhë: "Pastaj" me tempon e këngëve, e sugjeruara 120–140; "Luaj tani" luan atë që prek përdoruesi', async () => {
    const user = userEvent.setup()
    tempos.values.set('Frymë mes seteve', { bpm: 104, source: 'getsongbpm', url: null, at: 1 })
    tempos.values.set('Rekord i ri', { bpm: 136, source: 'getsongbpm', url: null, at: 1 })
    tempos.values.set('Peshë e rëndë', { bpm: 126, source: 'getsongbpm', url: null, at: 1 })
    native.state.session = playing({
      packageName: 'com.google.android.apps.youtube.music',
      appName: null,
      actions: ['playPause', 'next', 'previous', 'skipToQueueItem'],
      queue: {
        length: 3,
        title: 'Mix',
        upcoming: [
          { id: 11, title: 'Frymë mes seteve', subtitle: 'Linda M.' },
          { id: 12, title: 'Rekord i ri', subtitle: 'DJ Prush' },
          { id: 13, title: 'Peshë e rëndë', subtitle: 'Arben D.' },
        ],
      },
    })
    await renderSession('/seanca?ritmi=1')
    const dialog = await screen.findByRole('dialog', { name: 'Trupi në ritëm' })
    expect(within(dialog).getByText('Luhet te YouTube Music')).toBeInTheDocument()
    const queue = within(dialog).getByRole('region', { name: 'Pastaj' })
    await within(queue).findByRole('button', { name: 'Luaj tani: Peshë e rëndë, Arben D., 126 BPM' })
    expect(within(queue).getAllByText('Setet')).toHaveLength(2)
    expect(within(queue).getByText('Pushimi')).toBeInTheDocument()
    // Nuk ka "Kalo këngën" kur radha njihet; kënga nuk ndërrohet vetë.
    expect(within(dialog).queryByRole('button', { name: 'Kalo këngën' })).toBeNull()
    expect(native.bridge.control).not.toHaveBeenCalled()
    await user.click(within(queue).getByRole('button', { name: 'Luaj tani: Rekord i ri, DJ Prush, 136 BPM' }))
    expect(native.bridge.control).toHaveBeenLastCalledWith({ action: 'skipToQueueItem', queueItemId: 12 })
    // YouTube Music pa Premium ndalet kur Vrull është përpara.
    expect(within(dialog).getByText('Pa Premium, YouTube Music ndalet kur Vrull është përpara.')).toBeInTheDocument()
  })

  it('gjatë pushimit pulsi bie në gjysmën e tempos dhe muzika nuk ndërrohet', async () => {
    const user = userEvent.setup()
    await renderSession()
    await user.click(screen.getByRole('button', { name: 'Ruaj setin' }))
    await screen.findByRole('button', { name: 'Kapërce' })
    await user.click(await within(await music()).findByRole('button', { name: /^Hap Trupi në ritëm/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Trupi në ritëm' })
    expect(within(dialog).getByText(/ · pas setit 1 nga \d$/)).toBeInTheDocument()
    expect(within(dialog).getByRole('timer', { name: /^Pushimi: mbeten / })).toBeInTheDocument()
    expect(within(dialog).getByRole('img', { name: /pulsojnë me 69 BPM\.$/ })).toBeInTheDocument()
    expect(within(dialog).getByText('Pulsi · gjysma')).toBeInTheDocument()
    expect(native.bridge.control).not.toHaveBeenCalled()
  })

  it('pulsi ndalet kur app-i del në sfond dhe rinis kur kthehet; me lëvizje të reduktuar trupi rri i ndezur', async () => {
    await renderSession('/seanca?ritmi=1')
    const dialog = await screen.findByRole('dialog', { name: 'Trupi në ritëm' })
    const body = await within(dialog).findByRole('img', { name: /pulsojnë me 138 BPM/ })
    const ring = () => body.querySelector('.animate-beat-ring') as HTMLElement
    await waitFor(() => expect(ring().style.animationPlayState).toBe('running'))
    expect(ring().style.getPropertyValue('--beat')).toBe('435ms')
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
    act(() => void document.dispatchEvent(new Event('visibilitychange')))
    await waitFor(() => expect(ring().style.animationPlayState).toBe('paused'))
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
    act(() => void document.dispatchEvent(new Event('visibilitychange')))
    await waitFor(() => expect(ring().style.animationPlayState).toBe('running'))
  })

  it('me "lëvizje të reduktuar" nuk ka animacion pulsi', async () => {
    const matchMedia = vi.fn((query: string) => ({ matches: query.includes('reduce'), addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    vi.stubGlobal('matchMedia', matchMedia)
    try {
      await renderSession('/seanca?ritmi=1')
      const dialog = await screen.findByRole('dialog', { name: 'Trupi në ritëm' })
      const body = await within(dialog).findByRole('img', { name: /ndriçojnë në prush\.$/ })
      expect(body.querySelector('[class*="animate-beat"]')).toBeNull()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe('lidhja dhe leja', () => {
  it('pa leje: karta "Lidh muzikën tënde"; "Më vonë" e heq për këtë seancë', async () => {
    const user = userEvent.setup()
    native.state.granted = false
    await renderSession()
    await user.click(await within(await music()).findByRole('button', { name: /Lidh muzikën tënde/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Lidh muzikën tënde' })
    expect(within(dialog).getByText(/Vrull lexon vetëm këngën që luhet dhe kontrollet e saj, asnjë njoftim\.$/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Më vonë' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.queryByRole('region', { name: 'Muzika' })).toBeNull()
  })

  it('Android 13+ me APK nga lidhja: kur leja nuk vjen, hapat e "Allow restricted settings"; pas lejes, mini-player-i', async () => {
    const user = userEvent.setup()
    native.state.granted = false
    await renderSession()
    await user.click(await within(await music()).findByRole('button', { name: /Lidh muzikën tënde/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Lidh muzikën tënde' })
    await user.click(within(dialog).getByRole('button', { name: 'Lidh muzikën' }))
    expect(native.bridge.openAccessSettings).toHaveBeenCalled()
    // Kthimi nga cilësimet pa leje.
    act(() => void document.dispatchEvent(new Event('visibilitychange')))
    const blocked = await screen.findByRole('dialog', { name: 'Lejo cilësimet e kufizuara' })
    expect(within(blocked).getByText('Prek ⋮ lart djathtas, pastaj "Allow restricted settings" dhe konfirmo.')).toBeInTheDocument()
    await user.click(within(blocked).getByRole('button', { name: 'Hap info e app-it' }))
    expect(native.bridge.openAppInfo).toHaveBeenCalled()
    await user.click(within(blocked).getByRole('button', { name: 'Lidh muzikën' }))
    native.state.granted = true
    act(() => void document.dispatchEvent(new Event('visibilitychange')))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await within(await music()).findByText('138 BPM · Kaltrina V.')
  })

  it('pa APK nga lidhja (ose para Android 13): vetëm kujtesa për "Qasja te njoftimet"', async () => {
    const user = userEvent.setup()
    native.state.granted = false
    native.state.installer = 'com.android.vending'
    await renderSession('/seanca?lidh-muziken=1')
    const dialog = await screen.findByRole('dialog', { name: 'Lidh muzikën tënde' })
    await user.click(within(dialog).getByRole('button', { name: 'Lidh muzikën' }))
    act(() => void document.dispatchEvent(new Event('visibilitychange')))
    expect(await within(dialog).findByRole('status')).toHaveTextContent('Leja nuk erdhi ende.')
    expect(screen.queryByRole('dialog', { name: 'Lejo cilësimet e kufizuara' })).toBeNull()
  })
})

describe('"Prek ritmin"', () => {
  it('pa tempo: katër prekje japin tempon, ×2 e korrigjon, "Ruaj" e ruan për këtë këngë', async () => {
    const user = userEvent.setup()
    tempos.values.clear()
    await renderSession('/seanca?ritmi=1')
    const dialog = await screen.findByRole('dialog', { name: 'Trupi në ritëm' })
    expect(await within(dialog).findByText('Tempo e panjohur')).toBeInTheDocument()
    await user.click(within(dialog).getAllByRole('button', { name: /^Prek ritmin/ })[0])
    const sheet = await screen.findByRole('dialog', { name: 'Prek ritmin' })
    expect(within(sheet).getByText('Tempoja nuk u gjet')).toBeInTheDocument()
    const save = within(sheet).getByRole('button', { name: 'Ruaj tempon' })
    expect(save).toBeDisabled()
    const now = vi.spyOn(performance, 'now')
    const circle = within(sheet).getByRole('button', { name: /^Prek në ritmin e këngës/ })
    // 84 BPM: një goditje çdo 714 ms.
    for (const at of [10_000, 10_714, 11_428]) {
      now.mockReturnValue(at)
      fireEvent.pointerDown(circle)
    }
    expect(within(sheet).getByText('BPM · 3 nga 4 prekje')).toBeInTheDocument()
    expect(within(sheet).getByRole('button', { name: 'Ruaj tempon' })).toBeDisabled()
    now.mockReturnValue(12_142)
    fireEvent.pointerDown(circle)
    expect(within(sheet).getByRole('button', { name: 'Ruaj 84 BPM' })).toBeEnabled()
    await user.click(within(sheet).getByRole('button', { name: 'Dyfisho tempon' }))
    now.mockRestore()
    await user.click(within(sheet).getByRole('button', { name: 'Ruaj 168 BPM' }))
    expect(tempos.saved).toEqual([{ title: 'Edhe një përsëritje', bpm: 168 }])
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Prek ritmin' })).toBeNull())
    expect(await within(screen.getByRole('dialog', { name: 'Trupi në ritëm' })).findByText('Tempo e prekur')).toBeInTheDocument()
  })
})

describe('anglisht', () => {
  it('mini-player-i, ekrani i plotë dhe lidhja në anglishten britanike', async () => {
    const user = userEvent.setup()
    language.set('en')
    await renderSession()
    const card = await music()
    await within(card).findByText('138 BPM · Kaltrina V.')
    expect(within(card).getByRole('button', { name: 'Pause' })).toBeInTheDocument()
    await user.click(within(card).getByRole('button', { name: /^Open Body beat: / }))
    const dialog = await screen.findByRole('dialog', { name: 'Body beat' })
    expect(within(dialog).getByText('Playing in Spotify')).toBeInTheDocument()
    expect(within(dialog).getByRole('link', { name: 'Tempo from GetSongBPM.com' })).toBeInTheDocument()
    expect(within(dialog).getByText("Today's muscles", { selector: 'span' })).toBeInTheDocument()
    expect(within(dialog).getByText('BPM · song')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Tap the beat: set the tempo by hand' })).toBeInTheDocument()
  })

  it('lidhja në anglisht', async () => {
    language.set('en')
    native.state.granted = false
    await renderSession('/seanca?lidh-muziken=1')
    const dialog = await screen.findByRole('dialog', { name: 'Connect your music' })
    expect(within(dialog).getByRole('button', { name: 'Connect music' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Later' })).toBeInTheDocument()
  })
})
