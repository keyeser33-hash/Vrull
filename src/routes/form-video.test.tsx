import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { LocalDatabase } from '@/data/db'
import type { LocalStore } from '@/data/store'
import { language } from '@/i18n'
import type { Camera, Facing } from '@/lib/form-camera'
import type { FakeStorage } from '@/test/fake-remote'

// Videot e formës (V2-E1-13; bordi "Seanca · Video"): ikona e kamerës te kreu i seancës, kamera për
// ushtrimin dhe setin në ekran, krahasimi me herën e kaluar, "Ruaj te seti N"; seksioni i faqes së
// ushtrimit me luajtjen dhe fshirjen. Store i vërtetë mbi IndexedDB në memorie, Storage i imituar
// (src/test/fake-remote), kamera e imituar: asnjë kërkesë rrjeti.
const USER = '11111111-1111-4111-8111-111111111111'
const data = vi.hoisted(() => ({
  store: null as unknown as LocalStore,
  db: null as unknown as LocalDatabase,
  storage: null as unknown as FakeStorage,
}))

vi.mock('@/data/app-data', async () => {
  const { createDatabase } = await import('@/data/db')
  const { createLocalStore } = await import('@/data/store')
  const { createFakeStorage } = await import('@/test/fake-remote')
  const videos = await import('@/data/form-videos')
  const db = createDatabase(`form-video-${crypto.randomUUID()}`)
  let clock = Date.parse('2026-11-08T08:00:00.000Z')
  const store = createLocalStore(db, { userId: () => '11111111-1111-4111-8111-111111111111', now: () => new Date((clock += 1000)) })
  const storage = createFakeStorage({ userId: () => '11111111-1111-4111-8111-111111111111' })
  Object.assign(data, { store, db, storage })
  return {
    store,
    formVideos: {
      add: (input: Parameters<typeof videos.addFormVideo>[2]) => videos.addFormVideo(store, db, input),
      remove: (id: string) => videos.removeFormVideo(store, db, id),
      data: (video: Parameters<typeof videos.formVideoData>[2]) => videos.formVideoData(db, storage, video),
    },
    useLocalQuery: (await import('@/test/local-query')).useLocalQueryFor(store),
  }
})

// Kamera e imituar: hapet sipas `camera.next` (ose dështon me arsyen), regjistrimi kthen një video prove.
const camera = vi.hoisted(() => ({
  opened: [] as Facing[],
  failWith: null as string | null,
  current: null as (Camera & { limit(): void }) | null,
}))
vi.mock('@/lib/form-camera', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/form-camera')>()
  return {
    ...actual,
    async openCamera(facing: Facing) {
      camera.opened.push(facing)
      if (camera.failWith) throw new actual.CameraError(camera.failWith as never)
      let onLimit = () => {}
      const fake = {
        stream: {} as MediaStream,
        facing,
        record: vi.fn((limit: () => void) => {
          onLimit = limit
        }),
        stop: vi.fn(async () => ({ blob: new Blob([new Uint8Array([1, 2, 3])], { type: 'video/mp4' }), type: 'video/mp4' as const, durationS: 24.2, width: 720, height: 1280 })),
        close: vi.fn(),
        limit: () => onLimit(),
      }
      camera.current = fake
      return fake
    },
  }
})

// Capacitor: në shfletues si parazgjedhje; prova e Home në Android ndez telefonin dhe thërret pause/resume.
const native = vi.hoisted(() => ({ isNative: false, listeners: [] as { event: string; listener: () => void }[] }))
vi.mock('@capacitor/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@capacitor/core')>()
  return { ...actual, Capacitor: { ...actual.Capacitor, isNativePlatform: () => native.isNative } }
})
vi.mock('@capacitor/app', () => ({
  App: {
    addListener: (event: string, listener: () => void) => {
      const entry = { event, listener }
      native.listeners.push(entry)
      return Promise.resolve({ remove: () => Promise.resolve(void native.listeners.splice(native.listeners.indexOf(entry), 1)) })
    },
  },
}))
const appEvent = (event: string) => {
  for (const entry of native.listeners.filter((item) => item.event === event)) entry.listener()
}

const fetchSpy = vi.spyOn(globalThis, 'fetch')

async function reset() {
  const { completeOnboarding } = await import('@/data/profile')
  for (const table of ['form_videos', 'set_logs', 'workout_sessions', 'program_state', 'slot_prescriptions', 'program_slots', 'program_days', 'program_blocks', 'programs', 'exercises', 'user_settings'] as const) {
    // Zbrazje e vërtetë: një rresht i fshirë butë nga prova e mëparshme nuk duhet të ndikojë te tjetra.
    await data.db[table].clear()
  }
  await data.db._video_files.clear()
  localStorage.clear()
  await completeOnboarding(data.store, { weightKg: 80, trainingDays: [1, 2, 4, 5], trainingTime: '18:00', wakeTime: '07:00', sleepTime: '23:00' })
  camera.opened = []
  camera.failWith = null
  camera.current = null
}

/** Seanca e hapur e Java 0 · Stërvitja 1, me ushtrimin e parë. */
async function openSession() {
  const { startWorkout, trainingSnapshot } = await import('@/data/training')
  const sessionId = await startWorkout(data.store)
  const snapshot = (await trainingSnapshot(data.store))!
  const [slot] = snapshot.plan.slots
  return { sessionId, slot, name: snapshot.exercises[slot.exerciseId].name }
}

async function renderAt(path: string) {
  await import('@/data/app-data')
  const { SessionPage } = await import('./session')
  const { ExercisePage } = await import('./exercise')
  const router = createMemoryRouter(
    [
      { path: '/seanca', element: <SessionPage /> },
      { path: '/ushtrimi/:exerciseId', element: <ExercisePage /> },
    ],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />)
  return router
}

const video = (overrides: Record<string, unknown>) => ({
  date: '2026-11-01',
  storage_path: `${USER}/${crypto.randomUUID()}.mp4`,
  mime_type: 'video/mp4',
  duration_s: 21,
  bytes: 3,
  ...overrides,
})

describe('videot e formës (V2-E1-13)', () => {
  beforeAll(async () => {
    await import('@/data/app-data')
  })
  beforeEach(async () => {
    await reset()
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:video'), revokeObjectURL: vi.fn() }))
  })
  afterEach(() => {
    act(() => language.set('sq'))
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('nga kreu i seancës: kamera për ushtrimin dhe setin, regjistrimi dhe "Ruaj te seti 1"', async () => {
    const { sessionId, slot, name } = await openSession()
    const user = userEvent.setup()
    const router = await renderAt('/seanca')

    await user.click(await screen.findByRole('button', { name: 'Filmo veten' }))
    const dialog = await screen.findByRole('dialog', { name: 'Video e formës' })
    expect(router.state.location.search).toBe('?video=1')
    expect(within(dialog).getByText(`${name} · Seti 1`)).toBeInTheDocument()
    expect(within(dialog).getByRole('img', { name: 'Pamja e kamerës' })).toBeInTheDocument()
    expect(within(dialog).getByText('Private: vetëm ti i sheh. Ruhen në telefon dhe në cloud.')).toBeInTheDocument()
    await waitFor(() => expect(camera.opened).toEqual(['environment']))
    const save = within(dialog).getByRole('button', { name: 'Ruaj te seti 1' })
    expect(save).toBeDisabled()
    // Para regjistrimit s'ka asgjë për të krahasuar.
    expect(within(dialog).queryByRole('heading', { name: 'Krahasimi me herën e kaluar' })).not.toBeInTheDocument()

    await user.click(await within(dialog).findByRole('button', { name: 'Regjistro' }))
    expect(within(dialog).getByRole('timer', { name: 'Regjistron: 0:00 nga 1:00' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Ndërro kamerën' })).toBeDisabled()
    await user.click(within(dialog).getByRole('button', { name: 'Ndalo regjistrimin' }))
    expect(await within(dialog).findByText('Regjistruar 0:24')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Regjistro përsëri' })).toBeInTheDocument()
    expect(within(dialog).getByRole('heading', { name: 'Krahasimi me herën e kaluar' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Luaj videon: 8 nëntor · Seti 1' })).toBeInTheDocument()
    expect(within(dialog).getByText('Herën e kaluar pa video')).toBeInTheDocument()

    await user.click(save)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(router.state.location.search).toBe('')
    const [row] = await data.store.all('form_videos')
    expect(row).toMatchObject({
      exercise_id: slot.exerciseId,
      session_id: sessionId,
      set_number: 1,
      mime_type: 'video/mp4',
      duration_s: 24.2,
      bytes: 3,
      storage_path: `${USER}/${row.id}.mp4`,
    })
    expect(await data.db._video_files.get(row.id)).toMatchObject({ uploaded: 0, removed: 0 })
    // Kamera fiket kur mbyllet ekrani; seanca mbetet aty ku ishte.
    expect(camera.current?.close).toHaveBeenCalled()
    expect(screen.getByRole('heading', { level: 1, name })).toBeInTheDocument()

    // Përsëri te i njëjti set: videoja e ruajtur është "Sot"; një regjistrim i ri do ta zëvendësonte.
    await user.click(screen.getByRole('button', { name: 'Filmo veten' }))
    const again = await screen.findByRole('dialog', { name: 'Video e formës' })
    expect(await within(again).findByRole('button', { name: 'Luaj videon: 8 nëntor · Seti 1' })).toBeInTheDocument()
    expect(within(again).getByText('Regjistruar 0:24')).toBeInTheDocument()
    expect(await within(again).findByRole('button', { name: 'Regjistro përsëri' })).toBeEnabled()
    expect(within(again).getByRole('button', { name: 'Ruaj te seti 1' })).toBeDisabled()
  })

  it('krahasimi me herën e kaluar, kufiri 1:00 dhe mesazhi i hapësirës nga 80%', async () => {
    const { slot } = await openSession()
    await data.store.put('workout_sessions', { id: 'last-week', date: '2026-11-01', status: 'completed' })
    await data.store.put('set_logs', { session_id: 'last-week', exercise_id: slot.exerciseId, position: 0, set_number: 1, weight_kg: 60, reps: 12, is_warmup: false, logged_at: '2026-11-01T18:10:00.000Z' })
    await data.store.put('form_videos', video({ exercise_id: slot.exerciseId, session_id: 'last-week', set_number: 1, bytes: 850_000_000 }))
    const user = userEvent.setup()
    await renderAt('/seanca?video=1')

    const dialog = await screen.findByRole('dialog', { name: 'Video e formës' })
    expect(await within(dialog).findByRole('button', { name: 'Luaj videon: 1 nëntor · Seti 1, 60 × 12' })).toBeInTheDocument()
    expect(within(dialog).getByText('Ende pa video')).toBeInTheDocument()
    expect(within(dialog).getByText('Fotot dhe videot zënë 850 MB nga 1 GB e planit falas të Supabase-it. Fshi videot e vjetra te faqja e ushtrimit, ose kalo në planin me pagesë.')).toBeInTheDocument()

    await user.click(await within(dialog).findByRole('button', { name: 'Regjistro' }))
    await act(async () => camera.current!.limit())
    expect(await within(dialog).findByText('U ndal te 1:00, gjatësia më e madhe e një videoje.')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Ruaj te seti 1' })).toBeEnabled()
  })

  it('pa leje kamere: mesazhi me "Provo përsëri"; ndërrimi i kamerës hap kamerën e përparme', async () => {
    await openSession()
    camera.failWith = 'denied'
    const user = userEvent.setup()
    await renderAt('/seanca?video=1')

    const dialog = await screen.findByRole('dialog', { name: 'Video e formës' })
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Vrull nuk e hap dot kamerën. Lejo kamerën për Vrull te cilësimet e telefonit dhe provo përsëri.',
    )
    expect(within(dialog).getByRole('button', { name: 'Regjistro' })).toBeDisabled()
    camera.failWith = null
    await user.click(within(dialog).getByRole('button', { name: 'Provo përsëri' }))
    await waitFor(() => expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument())
    await user.click(within(dialog).getByRole('button', { name: 'Ndërro kamerën' }))
    await waitFor(() => expect(camera.opened).toEqual(['environment', 'environment', 'user']))
  })

  it('app-i në sfond: regjistrimi ndalet dhe mbahet, kamera fiket dhe rihapet kur kthehet', async () => {
    await openSession()
    let visibility: DocumentVisibilityState = 'visible'
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility })
    try {
      const user = userEvent.setup()
      await renderAt('/seanca?video=1')
      const dialog = await screen.findByRole('dialog', { name: 'Video e formës' })
      await user.click(await within(dialog).findByRole('button', { name: 'Regjistro' }))
      const first = camera.current!

      visibility = 'hidden'
      act(() => void document.dispatchEvent(new Event('visibilitychange')))
      expect(first.stop).toHaveBeenCalled()
      expect(await within(dialog).findByText('Regjistruar 0:24')).toBeInTheDocument()
      await waitFor(() => expect(first.close).toHaveBeenCalled())
      expect(within(dialog).getByRole('button', { name: 'Regjistro përsëri' })).toBeDisabled()

      visibility = 'visible'
      act(() => void document.dispatchEvent(new Event('visibilitychange')))
      await waitFor(() => expect(camera.opened).toEqual(['environment', 'environment']))
      expect(await within(dialog).findByRole('button', { name: 'Regjistro përsëri' })).toBeEnabled()
      expect(within(dialog).getByRole('button', { name: 'Ruaj te seti 1' })).toBeEnabled()
    } finally {
      // Kthehet getter-i i jsdom-it (te Document.prototype).
      Reflect.deleteProperty(document, 'visibilityState')
    }
  })

  it('Home në Android: pause i Capacitor-it e ndal regjistrimin edhe pa visibilitychange; resume e rihap kamerën', async () => {
    // Prova në emulator: WebView-ja nuk e dha visibilitychange dhe regjistrimi vazhdoi në sfond.
    native.isNative = true
    try {
      await openSession()
      const user = userEvent.setup()
      await renderAt('/seanca?video=1')
      const dialog = await screen.findByRole('dialog', { name: 'Video e formës' })
      await user.click(await within(dialog).findByRole('button', { name: 'Regjistro' }))
      const first = camera.current!

      act(() => appEvent('pause'))
      expect(first.stop).toHaveBeenCalled()
      expect(await within(dialog).findByText('Regjistruar 0:24')).toBeInTheDocument()
      await waitFor(() => expect(first.close).toHaveBeenCalled())

      act(() => appEvent('resume'))
      await waitFor(() => expect(camera.opened).toEqual(['environment', 'environment']))
      expect(await within(dialog).findByRole('button', { name: 'Regjistro përsëri' })).toBeEnabled()
    } finally {
      native.isNative = false
    }
  })

  it('në anglisht', async () => {
    const { name } = await openSession()
    act(() => language.set('en'))
    const user = userEvent.setup()
    await renderAt('/seanca')

    await user.click(await screen.findByRole('button', { name: 'Film yourself' }))
    const dialog = await screen.findByRole('dialog', { name: 'Form video' })
    expect(within(dialog).getByText(`${name} · Set 1`)).toBeInTheDocument()
    expect(within(dialog).getByText('Private: only you can see them. Kept on your phone and in the cloud.')).toBeInTheDocument()
    await user.click(await within(dialog).findByRole('button', { name: 'Record' }))
    await user.click(within(dialog).getByRole('button', { name: 'Stop recording' }))
    expect(await within(dialog).findByText('Recorded 0:24')).toBeInTheDocument()
    expect(within(dialog).getByRole('heading', { name: 'Compared with last time' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Play video: 8 November · Set 1' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Save to set 1' })).toBeEnabled()
  })

  it('faqja e ushtrimit: videot, luajtja dhe fshirja nga telefoni dhe nga Storage', async () => {
    const { slot } = await openSession()
    const { addFormVideo, syncFormVideoFiles } = await import('@/data/form-videos')
    await data.store.put('workout_sessions', { id: 'last-week', date: '2026-11-01', status: 'completed' })
    await data.store.put('set_logs', { session_id: 'last-week', exercise_id: slot.exerciseId, position: 0, set_number: 2, weight_kg: 60, reps: 12, is_warmup: false, logged_at: '2026-11-01T18:14:00.000Z' })
    const id = await addFormVideo(data.store, data.db, {
      exerciseId: slot.exerciseId,
      sessionId: 'last-week',
      setNumber: 2,
      date: '2026-11-01',
      data: new Uint8Array([4, 5]).buffer,
      type: 'video/mp4',
      durationS: 21,
    })
    await syncFormVideoFiles(data.db, data.storage)
    expect(data.storage.objects()).toEqual([`${USER}/${id}.mp4`])
    const user = userEvent.setup()
    await renderAt(`/ushtrimi/${slot.exerciseId}`)

    expect(await screen.findByRole('heading', { name: 'Videot e formës' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Luaj videon: 1 nëntor · Seti 2, 60 × 12' }))
    const sheet = await screen.findByRole('dialog', { name: 'Video e formës' })
    expect(sheet).toHaveAccessibleDescription('1 nëntor · Seti 2 · 60 × 12')
    await waitFor(() => expect(sheet.querySelector('video')).toHaveAttribute('src', 'blob:video'))

    await user.click(within(sheet).getByRole('button', { name: 'Fshi videon' }))
    expect(within(sheet).getByText('Videoja fshihet nga telefoni dhe nga cloud-i.')).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Po, fshije' }))
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Videot e formës' })).not.toBeInTheDocument())
    expect(await data.store.all('form_videos')).toEqual([])
    expect(await syncFormVideoFiles(data.db, data.storage)).toEqual({ uploaded: 0, removed: 1 })
    expect(data.storage.objects()).toEqual([])
  })
})
