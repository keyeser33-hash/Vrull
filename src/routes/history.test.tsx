import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { LocalStore } from '@/data/store'
import type { Segment } from '@/data/training'
import { language } from '@/i18n'

// Historiku dhe seanca e kaluar (V2-E1-15) me store të vërtetë: Java 0, Faza 1 · Java 1 dhe
// Stërvitja 1 e Javës 2 (sot, e diel 8 nëntor 2026), si te bordet; ndryshimi i një seti nga fleta.
const data = vi.hoisted(() => ({ store: null as unknown as LocalStore, clock: null as Date | null }))
vi.mock('@/data/app-data', async () => {
  const { createDatabase } = await import('@/data/db')
  const { createLocalStore } = await import('@/data/store')
  const photoApi = await import('@/data/photos')
  const db = createDatabase(`history-ui-${crypto.randomUUID()}`)
  const store = createLocalStore(db, { userId: () => '11111111-1111-4111-8111-111111111111', now: () => data.clock ?? new Date() })
  data.store = store
  const remote = { upload: async () => {}, download: async () => new ArrayBuffer(0) }
  return {
    store,
    photos: {
      timeline: () => photoApi.photoTimeline(store, db),
      add: (input: Parameters<typeof photoApi.addPhoto>[2]) => photoApi.addPhoto(store, db, input),
      remove: (id: string) => photoApi.removePhoto(store, db, id),
      data: (photo: { id: string; storagePath: string }) => photoApi.photoData(db, remote, photo),
    },
    useLocalQuery: (await import('@/test/local-query')).useLocalQueryFor(store),
  }
})

interface Logged {
  weightKg: number | null
  reps: number
  rir?: number
  segments?: Segment[]
}

const at = (month: number, day: number) => new Date(2026, month, day, 17, 15)

async function workout(start: Date, minutes: number, sets: Record<string, Logged[]>) {
  const { finishWorkout, saveSet, startWorkout, trainingSnapshot } = await import('@/data/training')
  data.clock = start
  const snapshot = (await trainingSnapshot(data.store))!
  const sessionId = await startWorkout(data.store)
  let minute = 0
  for (const slot of snapshot.plan.slots) {
    for (const [index, entry] of (sets[snapshot.exercises[slot.exerciseId].name] ?? []).entries()) {
      minute += 2
      data.clock = new Date(start.getTime() + minute * 60_000)
      await saveSet(data.store, {
        sessionId,
        slot,
        setNumber: index + 1,
        weightKg: entry.weightKg,
        reps: entry.reps,
        rir: entry.rir ?? null,
        technique: entry.segments ? slot.technique.type : 'none',
        segments: entry.segments,
      })
    }
  }
  data.clock = new Date(start.getTime() + minutes * 60_000)
  await finishWorkout(data.store, sessionId)
  return sessionId
}

let sessions: { weekOne: string; today: string } | null = null

/** Një herë për skedarin: hapat e parë dhe gjashtë seanca (Java 0, Java 1 · Stërvitja 1, sot). */
async function seed() {
  if (sessions) return sessions
  const { completeOnboarding } = await import('@/data/profile')
  data.clock = new Date(2026, 9, 24, 9, 0)
  await completeOnboarding(data.store, { weightKg: 80, trainingDays: [7, 1, 2, 4], trainingTime: '17:15', wakeTime: '07:00', sleepTime: '23:00' }, () => data.clock!)
  await workout(at(9, 25), 48, { 'Bench Press': [1, 2, 3].map(() => ({ weightKg: 50, reps: 14, rir: 2 })), 'Standing Calf Raise': [{ weightKg: 50, reps: 28 }] })
  await workout(at(9, 26), 51, { 'Barbell Curl': [{ weightKg: 25, reps: 14, rir: 2 }] })
  await workout(at(9, 27), 41, { 'Dumbbell Shrug': [{ weightKg: 26, reps: 14, rir: 2 }] })
  await workout(at(9, 29), 44, { Squat: [{ weightKg: 60, reps: 14, rir: 3 }] })
  const weekOne = await workout(at(10, 1), 64, {
    'Bench Press': [
      { weightKg: 60, reps: 13 },
      { weightKg: 60, reps: 12 },
      { weightKg: 60, reps: 11 },
      { weightKg: 60, reps: 10, segments: [{ weightKg: 60, reps: 4 }] },
    ],
    'Standing Calf Raise': [{ weightKg: 60, reps: 28 }],
  })
  // Java 1 mbyllet me tri stërvitjet e tjera pa sete (si të kapërcyera me dorë, nuk numërohen).
  const { skipWorkout } = await import('@/data/training')
  for (const day of [2, 3, 5]) {
    data.clock = at(10, day)
    await skipWorkout(data.store)
  }
  const today = await workout(at(10, 8), 66, { 'Bench Press': [12, 10, 9, 9].map((reps) => ({ weightKg: 62.5, reps })) })
  data.clock = null
  sessions = { weekOne, today }
  return sessions
}

async function renderAt(path: string) {
  const { HistoryPage, PastSessionPage } = await import('./history')
  const { ProgressPage } = await import('./progress')
  const router = createMemoryRouter(
    [
      { path: '/progresi', element: <ProgressPage /> },
      { path: '/progresi/historiku', element: <HistoryPage /> },
      { path: '/progresi/historiku/:sessionId', element: <PastSessionPage /> },
    ],
    { initialEntries: path.split('|') },
  )
  render(<RouterProvider router={router} />)
  return router
}

describe('Historiku', () => {
  beforeAll(async () => {
    await import('@/data/app-data')
    URL.createObjectURL = () => 'blob:foto'
    URL.revokeObjectURL = () => {}
  })
  beforeEach(() => {
    // Vetëm ora e telefonit: e diel 8 nëntor 2026, pas stërvitjes.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 8, 19, 0))
  })
  afterEach(() => {
    vi.useRealTimers()
    language.set('sq')
  })

  it('pa seanca: gjendja bosh', async () => {
    await renderAt('/progresi/historiku')
    expect(await screen.findByRole('heading', { level: 2, name: 'Ende pa seanca' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Historiku' })).toBeInTheDocument()
  })

  it('seancat sipas javës së programit, kalendari i muajit dhe seanca e hapur', async () => {
    await seed()
    const user = userEvent.setup()
    await renderAt('/progresi/historiku')
    expect(await screen.findByText('Shortcut to Size · 6 seanca që nga 25 tetor')).toBeInTheDocument()

    const month = screen.getByRole('region', { name: 'Nëntor 2026' })
    expect(month).toHaveTextContent('2 seanca · 2 rekorde')
    expect(within(month).getByRole('img')).toHaveAccessibleName('Nëntor: seanca më 1 dhe 8 nëntor; sot 8 nëntor')
    expect(month).toHaveTextContent('Javët nisin të dielën')
    expect(within(month).getByRole('button', { name: 'Muaji tjetër: dhjetor' })).toBeDisabled()
    await user.click(within(month).getByRole('button', { name: 'Muaji i kaluar: tetor' }))
    const october = await screen.findByRole('region', { name: 'Tetor 2026' })
    expect(october).toHaveTextContent('4 seanca · 0 rekorde')
    expect(within(october).getByRole('img')).toHaveAccessibleName('Tetor: seanca më 25, 26, 27 dhe 29 tetor')
    expect(within(october).getByRole('button', { name: 'Muaji i kaluar: shtator' })).toBeDisabled()

    const weeks = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)
    expect(weeks).toEqual(['Tetor 2026', 'Faza 1 · Java 2', 'Faza 1 · Java 1', 'Java 0'])
    expect(screen.getByRole('region', { name: 'Faza 1 · Java 1' })).toHaveTextContent('1 nga 4')
    expect(screen.getByRole('region', { name: 'Java 0' })).toHaveTextContent('4 nga 4')
    const javaZero = within(screen.getByRole('region', { name: 'Java 0' })).getAllByRole('link')
    expect(javaZero.map((link) => link.textContent?.slice(0, 1))).toEqual(['4', '3', '2', '1'])
    expect(javaZero[3]).toHaveAccessibleName('E diel, 25 tetor, Stërvitja 1, gjoks, triceps, pulpa, 48 minuta, 4 sete')

    const todayLink = screen.getByRole('link', { name: /^Sot, e diel 8 nëntor, Stërvitja 1/ })
    expect(todayLink).toHaveAccessibleName('Sot, e diel 8 nëntor, Stërvitja 1, gjoks, triceps, pulpa, 1 orë e 6 minuta, 4 sete. Rekord: Bench Press e1RM 87,5\u00A0kg')
    expect(todayLink).toHaveTextContent('1:06 orë')
    await user.click(todayLink)
    expect(await screen.findByRole('heading', { level: 1, name: 'Dita e gjoksit' })).toBeInTheDocument()
    expect(screen.getByText('Faza 1 · Java 2 · Stërvitja 1: gjoks, triceps, pulpa')).toBeInTheDocument()
  })

  it('seanca e kaluar: pllakat, rekordi me setin e Javës 0, rest-pause dhe volumi', async () => {
    const { weekOne } = await seed()
    await renderAt(`/progresi/historiku/${weekOne}`)
    expect(await screen.findByRole('heading', { level: 1, name: 'Dita e gjoksit' })).toBeInTheDocument()
    expect(screen.getByText('E diel, 1 nëntor 2026')).toBeInTheDocument()
    expect(screen.getByText('Faza 1 · Java 1 · Stërvitja 1: gjoks, triceps, pulpa')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Kohëzgjatja 1 orë e 4 minuta' })).toHaveTextContent('1:04orë')
    expect(screen.getByRole('group', { name: '5 sete pune' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: '1 rekord' })).toBeInTheDocument()

    const record = screen.getByRole('region', { name: 'Bench Press' })
    expect(record).toHaveTextContent('Rekord i ri')
    expect(record).toHaveTextContent('+9,3 kg nga 76,7 te Java 0 (50 × 14, RIR 2)')
    const sets = within(record).getAllByRole('listitem')
    expect(sets.map((item) => item.textContent)).toEqual(['Seti 160 × 13Rekord86,0', 'Seti 260 × 1284,0', 'Seti 360 × 1182,0', expect.stringContaining('Seti 460 × 10 + 480,0')])
    expect(sets[3]).toHaveTextContent('Rest-pause 60 × 4 pas 15 s · nuk hyn te e1RM')

    // Fotot e ushtrimeve si te Programi (ExercisePhoto, bardh e zi), jo vend-mbajtësi "Pa foto".
    expect(record.querySelector('img')?.getAttribute('src')).toMatch(/^\/exercise-photos\/.+\.jpg$/)
    const others = screen.getByRole('list', { name: 'Ushtrimet e tjera' })
    const calves = within(others).getByText('Standing Calf Raise').closest('li')!
    expect(calves).toHaveTextContent('60 kg · 28pa e1RM')
    expect(calves.querySelector('img')).toHaveClass('grayscale')
    expect(screen.queryByText('Pa foto')).toBeNull()
    expect(screen.getByRole('region', { name: 'Ushtrimet · 2' })).toHaveTextContent('12–15 · pulpat 25–30 · + rest-pause')
    const volume = screen.getByRole('region', { name: 'Volumi · sete' })
    expect(within(volume).getAllByRole('term').map((term) => term.textContent)).toEqual(['Gjoksi', 'Shpatullat', 'Tricepsi', 'Pulpat'])
    expect(within(volume).getAllByRole('definition').map((value) => value.textContent)).toEqual(['4', '2', '2', '1'])
    // "Ndaj kartën" vjen me kartat e Etapës 4.
    expect(screen.queryByRole('button', { name: /Ndaj/ })).toBeNull()
  })

  it('ndrysho një set: parapamja e rekordit, ruajtja dhe rekordi që kalon te seti tjetër', async () => {
    const { weekOne } = await seed()
    const user = userEvent.setup()
    const router = await renderAt(`/progresi/historiku/${weekOne}`)
    await user.click(await screen.findByRole('button', { name: 'Ndrysho një set' }))
    expect(router.state.location.search).toBe('?ndrysho=1')
    expect(screen.getByText('Prek setin që do të ndryshosh.')).toBeInTheDocument()
    // Setet e ushtrimeve të tjera bëhen të prekshme po ashtu.
    expect(screen.getByRole('button', { name: 'Ndrysho setin 1 të Standing Calf Raise: 60 × 28' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Ndrysho setin 1 të Bench Press: 60 × 13' }))
    const sheet = screen.getByRole('dialog', { name: 'Ndrysho setin 1' })
    expect(sheet).toHaveAccessibleDescription('Bench Press · E diel, 1 nëntor')
    expect(within(sheet).getByText('e1RM 86,0 kg · rekord +9,3 kg')).toBeInTheDocument()
    expect(within(sheet).getByRole('button', { name: 'Ruaj ndryshimin' })).toBeDisabled()
    // Java 1 pa RIR: pa zgjedhës RIR.
    expect(within(sheet).queryByRole('group', { name: 'Sa të kishin mbetur (RIR)' })).toBeNull()
    for (let index = 0; index < 4; index++) await user.click(within(sheet).getByRole('button', { name: 'Ul peshën me 2,5 kg' }))
    expect(within(sheet).getByText('e1RM 71,7 kg · Seti nuk është më rekord.')).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Ruaj ndryshimin' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(router.state.location.search).toBe('?ndrysho=1')
    const record = await screen.findByRole('region', { name: 'Bench Press' })
    await waitFor(() => expect(record).toHaveTextContent('+7,3 kg nga 76,7 te Java 0 (50 × 14, RIR 2)'))
    expect(within(record).getAllByRole('listitem')[1]).toHaveTextContent('Rekord84,0')
    const [row] = (await data.store.where('set_logs', 'session_id', weekOne)).filter((set) => set.set_number === 1 && set.reps === 13)
    expect(row).toMatchObject({ weight_kg: 50, reps: 13, rir: null })

    // Pesha me tastierë: prekja e numrit, "62,5", Vendos; pastaj Mbaro.
    await user.click(screen.getByRole('button', { name: 'Ndrysho setin 1 të Bench Press: 50 × 13' }))
    const again = screen.getByRole('dialog', { name: 'Ndrysho setin 1' })
    await user.click(within(again).getByRole('button', { name: 'Shkruaj peshën, 50 kg' }))
    const field = within(again).getByLabelText('Pesha, kg')
    await user.clear(field)
    await user.type(field, '700')
    await user.click(within(again).getByRole('button', { name: 'Vendos' }))
    expect(within(again).getByRole('alert')).toHaveTextContent('Shkruaj një peshë nga 0 deri në 500 kg, p.sh. 62,5.')
    await user.clear(field)
    await user.type(field, '60')
    await user.click(within(again).getByRole('button', { name: 'Vendos' }))
    expect(within(again).getByText('e1RM 86,0 kg · rekord +9,3 kg')).toBeInTheDocument()
    await user.click(within(again).getByRole('button', { name: 'Ruaj ndryshimin' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(within(screen.getByRole('region', { name: 'Bench Press' })).getAllByRole('listitem')[0]).toHaveTextContent('Rekord86,0'))
    await user.click(screen.getByRole('button', { name: 'Mbaro' }))
    expect(router.state.location.search).toBe('')
    expect(screen.queryByRole('button', { name: /^Ndrysho setin/ })).toBeNull()
  })

  it('anglisht: javët, datat, titulli i ditës dhe rekordi', async () => {
    await seed()
    language.set('en')
    const user = userEvent.setup()
    await renderAt('/progresi/historiku')
    expect(await screen.findByText('Shortcut to Size · 6 sessions since 25 October')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'History' })).toBeInTheDocument()
    const month = screen.getByRole('region', { name: 'November 2026' })
    expect(month).toHaveTextContent('2 sessions · 2 records')
    expect(month).toHaveTextContent('Weeks start on Sunday')
    expect(within(month).getByRole('img')).toHaveAccessibleName('November: sessions on 1 and 8 November; today 8 November')
    expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual(['November 2026', 'Phase 1 · Week 2', 'Phase 1 · Week 1', 'Week 0'])
    expect(screen.getByRole('region', { name: 'Week 0' })).toHaveTextContent('4 of 4')
    const todayLink = screen.getByRole('link', { name: /^Today, Sunday 8 November, Workout 1/ })
    expect(todayLink).toHaveAccessibleName('Today, Sunday 8 November, Workout 1, chest, triceps, calves, 1 hour 6 minutes, 4 sets. Record: Bench Press e1RM 87.5\u00A0kg')
    expect(todayLink).toHaveTextContent('Chest, triceps, calves1:06 h')

    await user.click(screen.getByRole('link', { name: /^Sunday, 1 November/ }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Chest day' })).toBeInTheDocument()
    expect(screen.getByText('Sunday, 1 November 2026')).toBeInTheDocument()
    expect(screen.getByText('Phase 1 · Week 1 · Workout 1: chest, triceps, calves')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Duration 1 hour 4 minutes' })).toHaveTextContent('1:04h')
    expect(screen.getByRole('region', { name: 'Bench Press' })).toHaveTextContent('+9.3 kg from 76.7 in Week 0 (50 × 14, RIR 2)')
    expect(screen.getByRole('region', { name: 'Exercises · 2' })).toHaveTextContent('12–15 · calves 25–30 · + rest-pause')
    expect(screen.getByRole('region', { name: 'Volume · sets' })).toHaveTextContent('Chest')
    expect(screen.getByRole('button', { name: 'Edit a set' })).toBeInTheDocument()
  })

  it('Progresi hap historikun nga tab-i "Historiku" (0.23); historiku e mban tab-in të zgjedhur', async () => {
    await seed()
    const user = userEvent.setup()
    await renderAt('/progresi')
    const tabs = await screen.findByRole('tablist', { name: 'Pamjet e Progresit' })
    expect(within(tabs).getByRole('tab', { name: 'Përmbledhja' })).toHaveAttribute('aria-selected', 'true')
    await user.click(within(tabs).getByRole('tab', { name: 'Historiku' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Historiku' })).toBeInTheDocument()
    expect(within(screen.getByRole('tablist', { name: 'Pamjet e Progresit' })).getByRole('tab', { name: 'Historiku' })).toHaveAttribute('aria-selected', 'true')
  })
})
