import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { LocalStore } from '@/data/store'
import { language } from '@/i18n/language'
import { at, trainedWeeks, USER } from './week-test-setup'

// Përmbledhja e javës dhe karta për ndarje (V43, SPEC §0.3c, bordet "Java", "Java · Rezerva" dhe
// "Karta"): java 26 tetor – 1 nëntor me 4 nga 4 stërvitje, pa ushqim dhe ujë (jo e plotë, pa faj);
// ora e diela 8 nëntor. Canvas-i dhe galeria janë të telefonit: këtu zëvendësohen.
const data = vi.hoisted(() => ({ store: null as unknown as LocalStore, clock: new Date(2026, 10, 8, 10, 0) }))
const native = vi.hoisted(() => ({ saved: [] as string[], shared: [] as string[] }))

vi.mock('@/data/app-data', async () => {
  const store = new Proxy({} as LocalStore, {
    get: (_, key: keyof LocalStore) => {
      const value = data.store[key]
      return typeof value === 'function' ? value.bind(data.store) : value
    },
  })
  return { store, useLocalQuery: (await import('@/test/local-query')).useLocalQueryFor(store) }
})
vi.mock('@/share/render', () => ({
  renderWeekCard: async () => ({ toDataURL: () => 'data:image/png;base64,UE5H' }),
  pngBase64: (canvas: { toDataURL: () => string }) => canvas.toDataURL().split(',')[1],
}))
vi.mock('@/lib/gallery-native', () => ({
  saveImageToGallery: async (_: string, name: string) => {
    native.saved.push(name)
    return 'saved'
  },
  shareImage: async (_: string, name: string) => {
    native.shared.push(name)
    return true
  },
}))

async function freshStore() {
  const { createDatabase } = await import('@/data/db')
  const { createLocalStore } = await import('@/data/store')
  data.clock = at(8, 11)
  data.store = createLocalStore(createDatabase(`week-summary-${crypto.randomUUID()}`), { userId: () => USER, now: () => data.clock })
  return { store: data.store, setClock: (date: Date) => (data.clock = date) }
}

async function renderAt(path: string) {
  const { WeekSummaryPage } = await import('./week-summary')
  const { WeekSharePage } = await import('./week-share')
  const router = createMemoryRouter(
    [
      { path: '/progresi', element: <h1>Progresi</h1> },
      { path: '/progresi/historiku', element: <h1>Historiku</h1> },
      { path: '/programi', element: <h1>Programi</h1> },
      { path: '/progresi/java/:monday', element: <WeekSummaryPage /> },
      { path: '/progresi/java/:monday/karta', element: <WeekSharePage /> },
    ],
    { initialEntries: ['/progresi', path], initialIndex: 1 },
  )
  render(<RouterProvider router={router} />)
  return router
}

describe('Përmbledhja e javës', () => {
  afterEach(() => act(() => language.set('sq')))

  it('java jo e plotë: "Java 1 u mbyll", qëllimet, stërvitja, ushqimi dhe java tjetër; edhe në anglisht', async () => {
    const context = await freshStore()
    await trainedWeeks(context)
    const { saveMeasurement } = await import('@/data/progress')
    await saveMeasurement(context.store, '2026-11-01', { weight_kg: 80.4 })
    await renderAt('/progresi/java/2026-10-26')
    expect(await screen.findByRole('heading', { level: 1, name: 'Java 1 u mbyll' })).toBeInTheDocument()
    expect(screen.getByText('Faza 1 · Java 1 · 26 tetor – 1 nëntor')).toBeInTheDocument()
    expect(screen.getByText('Një qëllim nga tre.')).toBeInTheDocument()
    const goals = within(screen.getByRole('list', { name: 'Qëllimet e javës' })).getAllByRole('listitem')
    expect(goals.map((goal) => goal.textContent)).toEqual(['Stërvitja4 nga 4', 'Ushqimi0 nga 5 ditë', 'Uji0 nga 5 ditë'])
    expect(within(goals[0]).getByRole('img', { name: 'Qëllimi u arrit' })).toBeInTheDocument()

    const training = screen.getByRole('region', { name: 'Stërvitja' })
    // Katër seanca 66 minuta: 4:24; setet e punës: 1 + 1 + 1 + 4.
    expect(within(training).getByText('Setet').nextSibling).toHaveTextContent('7')
    expect(within(training).getByText('Koha').nextSibling).toHaveTextContent('4:24')
    expect(within(training).getByRole('list', { name: 'Rekordet e javës' })).toHaveTextContent(/^Bench Presse1RM .+\skg · \+\d+,\d$/)

    const food = screen.getByRole('region', { name: 'Ushqimi, uji, pesha' })
    expect(food).toHaveTextContent('Mesatarja e ditës0 ditë me të paktën 60% të kalorive.Pa të dhëna')
    expect(food).toHaveTextContent(/Pesha, mesatarja 7-ditore80,4\skg · \+0,4$/)
    expect(screen.getByRole('link', { name: /^Java tjetër · E diel, 8 nëntor · 17:15Faza 1 · Java 2 · Stërvitja 1: Gjoks, triceps, pulpa9 ushtrime · ~\d+ min$/ })).toHaveAttribute('href', '/programi')
    expect(screen.getByText('Karta tregon vetëm stërvitjen.')).toBeInTheDocument()

    act(() => language.set('en'))
    expect(screen.getByRole('heading', { level: 1, name: 'Week 1 is done' })).toBeInTheDocument()
    expect(screen.getByText('Phase 1 · Week 1 · 26 October – 1 November')).toBeInTheDocument()
    expect(screen.getByText('One goal of three.')).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Weekly goals' })).getAllByRole('listitem')[1]).toHaveTextContent('Food0 of 5 days')
    expect(screen.getByRole('region', { name: 'Food, water, weight' })).toHaveTextContent('Daily average0 days with at least 60% of your calories.No data')
    expect(screen.getByRole('button', { name: 'Share your week' })).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/[ëç]/)
  })

  it('"Ndaj javën" hap kartën: vetëm stërvitja, "Ruaj në galeri" dhe "Ndaj"', async () => {
    const user = userEvent.setup()
    await trainedWeeks(await freshStore())
    const router = await renderAt('/progresi/java/2026-10-26')
    await user.click(await screen.findByRole('button', { name: 'Ndaj javën' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/progresi/java/2026-10-26/karta'))
    expect(await screen.findByRole('heading', { level: 1, name: 'Ndaj javën' })).toBeInTheDocument()
    expect(screen.getByText('Foto 1080 × 1350')).toBeInTheDocument()
    const name = /^Parapamja e kartës: Faza 1 · Java 1, Java 1 u mbyll, 4\/4 stërvitje, 7 sete, 1 rekord, 1 javë rresht, Shortcut to Size · Bench Press e1RM /
    await waitFor(() => expect(screen.getByRole('img', { name })).toHaveAttribute('src', 'data:image/png;base64,UE5H'))
    const preview = screen.getByRole('img', { name })
    // Pesha (80 kg), ushqimi dhe uji nuk janë te karta.
    expect(preview.getAttribute('alt')).not.toMatch(/80,0|kcal|proteinë|ujë|uji/)
    expect(screen.getByText('Karta tregon vetëm stërvitjen. Pesha, matjet, ushqimi dhe uji mbeten të tuat.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Ruaj në galeri' }))
    expect(await screen.findByRole('status')).toHaveTextContent('U ruajt te Pictures/Vrull.')
    expect(native.saved).toEqual(['vrull-java-2026-10-26.png'])
    await user.click(screen.getByRole('button', { name: 'Ndaj' }))
    await waitFor(() => expect(native.shared).toEqual(['vrull-java-2026-10-26.png']))

    act(() => language.set('en'))
    await waitFor(() => expect(screen.getByRole('img', { name: /^Card preview: Phase 1 · Week 1, Week 1 is done, 4\/4 workouts, 7 sets, 1 record, 1 week in a row/ })).toHaveAttribute('src', 'data:image/png;base64,UE5H'))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save to gallery' })).toBeEnabled())
    expect(screen.getByRole('button', { name: 'Share' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/progresi/java/2026-10-26'))
  })

  it('një javë para fillimit nuk ka përmbledhje', async () => {
    await trainedWeeks(await freshStore())
    await renderAt('/progresi/java/2026-12-07')
    expect(await screen.findByText('Kjo javë nuk ka përmbledhje.')).toBeInTheDocument()
  })
})
