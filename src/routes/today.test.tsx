import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { LocalStore } from '@/data/store'
import { language } from '@/i18n/language'

// Bordi "Sot" (V2-E1-06): ekrani me app-in e vërtetë mbi një bazë lokale prove. Ora e telefonit
// është e diela 8 nëntor 2026 (data e bordeve), ose dita që zgjedh prova.
const data = vi.hoisted(() => ({ store: null as unknown as LocalStore, clock: new Date(2026, 10, 8, 10, 0) }))

vi.mock('@/lib/webgl', () => ({ webglAvailable: () => false }))
vi.mock('@/data/app-data', async () => {
  // Çdo provë ka bazën e vet; ekrani e lexon përmes `store`, si te app-i.
  const store = new Proxy({} as LocalStore, {
    get: (_, key: keyof LocalStore) => {
      const value = data.store[key]
      return typeof value === 'function' ? value.bind(data.store) : value
    },
  })
  return {
    store,
    updater: {},
    useAppUpdate: () => ({ status: 'idle' }),
    useLocalQuery: (await import('@/test/local-query')).useLocalQueryFor(store),
  }
})

const USER = '11111111-1111-4111-8111-111111111111'
const at = (day: number, month: number, hours = 10, minutes = 0) => new Date(2026, month - 1, day, hours, minutes)
const PROFILE = { weightKg: 80, trainingDays: [7, 1, 2, 4], trainingTime: '17:15', wakeTime: '07:00', sleepTime: '23:00' }

async function freshStore() {
  const { createDatabase } = await import('@/data/db')
  const { createLocalStore } = await import('@/data/store')
  data.clock = at(8, 11)
  data.store = createLocalStore(createDatabase(`today-screen-${crypto.randomUUID()}`), { userId: () => USER, now: () => data.clock })
  return data.store
}

async function onboarded() {
  const store = await freshStore()
  const { completeOnboarding } = await import('@/data/profile')
  data.clock = at(25, 10, 9)
  await completeOnboarding(store, PROFILE, () => data.clock)
  data.clock = at(8, 11)
  return store
}

/** Java 0 dhe Java 1 e Fazës 1 si te bordi: Bench Press 60 × 13 → sot 62,5 × 9–11. */
async function boardWeek() {
  const store = await onboarded()
  const { finishWorkout, saveSet, startWorkout, trainingSnapshot } = await import('@/data/training')
  const train = async (date: Date, sets: { weightKg: number; reps: number; rir?: number }[]) => {
    data.clock = date
    const sessionId = await startWorkout(store)
    const [first] = (await trainingSnapshot(store))!.plan.slots
    for (const [index, set] of sets.entries()) await saveSet(store, { sessionId, slot: first, setNumber: index + 1, ...set })
    data.clock = new Date(date.getTime() + 66 * 60_000)
    await finishWorkout(store, sessionId)
  }
  for (const day of [25, 26, 27, 29]) await train(at(day, 10, 17, 15), [{ weightKg: 50, reps: 14, rir: 2 }])
  await train(at(1, 11, 17, 15), [
    { weightKg: 60, reps: 13 },
    { weightKg: 60, reps: 12 },
    { weightKg: 60, reps: 11 },
    { weightKg: 60, reps: 10 },
  ])
  for (const day of [2, 3, 5]) await train(at(day, 11, 17, 15), [{ weightKg: 40, reps: 10 }])
  await store.put('diary_entries', { date: '2026-11-08', meal: 'breakfast_1', food_id: null, grams: 100, kcal: 400, protein_g: 38, carbs_g: 30, fat_g: 10, logged_at: at(8, 11, 8).toISOString() })
  data.clock = at(8, 11)
  return { store, train }
}

async function renderToday() {
  const { TodayPage } = await import('./today')
  const router = createMemoryRouter(
    [
      { path: '/', element: <TodayPage /> },
      { path: '/seanca', element: <h1>Seanca</h1> },
      { path: '/programet', element: <h1>Programet</h1> },
      { path: '/ushqimi', element: <h1>Ushqimi</h1> },
      { path: '/progresi/historiku/:sessionId', element: <h1>Seanca e kaluar</h1> },
    ],
    { initialEntries: ['/'] },
  )
  render(<RouterProvider router={router} />)
  return router
}

const banner = () => screen.getByRole('banner')
/** Çdo ditë e javës me emrin që lexon lexuesi i ekranit: butoni (ditë e bërë) ose rrethi. */
const weekLabels = (name: string) =>
  within(screen.getByRole('list', { name }))
    .getAllByRole('listitem')
    .map((item) => item.querySelector('button, [role="img"]')?.getAttribute('aria-label'))
/** Teksti i plotë i një paragrafi, me hapësirat që nuk thyhen (getByText i bën hapësira të zakonshme). */
const paragraph = (text: string) => (_: string, element: Element | null) => element?.tagName === 'P' && element.textContent === text
/** Butonat me prush: veprimi kryesor i ekranit, një ose asnjë. */
const emberButtons = () => screen.queryAllByRole('button').filter((button) => button.className.split(' ').includes('bg-ember'))

describe('Sot', () => {
  afterEach(() => act(() => language.set('sq')))

  it('dita e stërvitjes e bordit: kreu, java, karta, proteina dhe një veprim prushi; edhe në anglisht', async () => {
    await boardWeek()
    await renderToday()
    expect(await screen.findByRole('heading', { level: 1, name: 'Dita e gjoksit' })).toBeInTheDocument()
    expect(banner()).toHaveTextContent('E diel, 8 nëntor · Faza 1 · Java 2')
    expect(banner()).toHaveTextContent('Je gati. Shko fort.')
    expect(within(banner()).getByRole('link', { name: 'Profili dhe cilësimet' })).toHaveAttribute('href', '/cilesimet')

    expect(weekLabels('Java')).toEqual([
      'E hënë 2, e bërë',
      'E martë 3, e bërë',
      'E mërkurë 4, pushim',
      'E enjte 5, e bërë',
      'E premte 6, pushim',
      'E shtunë 7, pushim',
      'Sot, e diel 8, stërvitja e radhës',
    ])

    const card = screen.getByRole('region', { name: 'Stërvitja e sotme' })
    expect(within(card).getByText('Stërvitja 1 · 9 ushtrime · ~65 min')).toBeInTheDocument()
    expect(within(card).getByRole('heading', { level: 2, name: 'Gjoks, triceps, pulpa' })).toBeInTheDocument()
    expect(within(card).getByText(paragraph('Bench Press: synim 62,5\u00A0×\u00A09–\u206011.'))).toBeInTheDocument()
    expect(within(card).getByText('Gjoksi: gati')).toBeInTheDocument()
    expect(emberButtons().map((button) => button.textContent)).toEqual(['Fillo stërvitjen'])
    expect(screen.getByRole('button', { name: /^Proteina 38 gramë nga \d+$/ }).textContent).toBe('Proteina38\u00A0g')
    expect(screen.getByRole('button', { name: 'Kapërce këtë stërvitje' })).toBeInTheDocument()
    // Pjesët e etapave të tjera nuk shpiken: pa gatishmëri, ujë, fakte dhe sfidë.
    expect(screen.queryByText(/Gati|Uji|A e dije|Sfida/)).not.toBeInTheDocument()

    act(() => language.set('en'))
    expect(screen.getByRole('heading', { level: 1, name: 'Chest day' })).toBeInTheDocument()
    expect(banner()).toHaveTextContent('Sunday, 8 November · Phase 1 · Week 2')
    expect(banner()).toHaveTextContent("You're ready. Go hard.")
    expect(weekLabels('This week')).toEqual([
      'Monday 2, done',
      'Tuesday 3, done',
      'Wednesday 4, rest day',
      'Thursday 5, done',
      'Friday 6, rest day',
      'Saturday 7, rest day',
      'Today, Sunday 8, next workout',
    ])
    const english = screen.getByRole('region', { name: "Today's workout" })
    expect(within(english).getByText('Workout 1 · 9 exercises · ~65 min')).toBeInTheDocument()
    expect(within(english).getByRole('heading', { level: 2, name: 'Chest, triceps, calves' })).toBeInTheDocument()
    expect(within(english).getByText(paragraph('Bench Press: target 62.5\u00A0×\u00A09–\u206011.'))).toBeInTheDocument()
    expect(within(english).getByText('Chest: ready')).toBeInTheDocument()
    expect(emberButtons().map((button) => button.textContent)).toEqual(['Start workout'])
    expect(screen.getByRole('button', { name: /^Protein 38 grams of \d+$/ })).toBeInTheDocument()
  })

  it('"Fillo stërvitjen" hap seancën e stërvitjes së radhës; proteina hap Ushqimin', async () => {
    const user = userEvent.setup()
    const { store } = await boardWeek()
    const router = await renderToday()
    await user.click(await screen.findByRole('button', { name: 'Fillo stërvitjen' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/seanca'))
    const open = (await store.all('workout_sessions')).filter((row) => row.status === 'in_progress')
    expect(open).toEqual([expect.objectContaining({ week: 2, date: '2026-11-08' })])

    await act(() => router.navigate('/'))
    await user.click(await screen.findByRole('button', { name: /^Proteina 38 gramë/ }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/ushqimi'))
  })

  it('një ditë e bërë e javës hap seancën e saj te historiku', async () => {
    const user = userEvent.setup()
    const { store } = await boardWeek()
    const router = await renderToday()
    await user.click(await screen.findByRole('button', { name: 'E enjte 5, e bërë' }))
    const thursday = (await store.all('workout_sessions')).find((row) => row.date === '2026-11-05')
    await waitFor(() => expect(router.state.location.pathname).toBe(`/progresi/historiku/${thursday?.id}`))
    expect(await screen.findByRole('heading', { level: 1, name: 'Seanca e kaluar' })).toBeInTheDocument()
  })

  it('seanca e hapur: "Vazhdo stërvitjen" me setet e ruajtura, pa "Kapërce"', async () => {
    const { store } = await boardWeek()
    const { saveSet, startWorkout, trainingSnapshot } = await import('@/data/training')
    const sessionId = await startWorkout(store)
    const [bench] = (await trainingSnapshot(store))!.plan.slots
    await saveSet(store, { sessionId, slot: bench, setNumber: 1, weightKg: 62.5, reps: 12 })
    await renderToday()
    expect(await screen.findByRole('heading', { level: 1, name: 'Dita e gjoksit' })).toBeInTheDocument()
    expect(banner()).toHaveTextContent('Seanca është e hapur.')
    expect(screen.getByText('Stërvitja 1 · 1 nga 30 sete')).toBeInTheDocument()
    expect(emberButtons().map((button) => button.textContent)).toEqual(['Vazhdo stërvitjen'])
    expect(screen.queryByRole('button', { name: 'Kapërce këtë stërvitje' })).not.toBeInTheDocument()
    act(() => language.set('en'))
    expect(screen.getByText('Workout 1 · 1 of 30 sets')).toBeInTheDocument()
    expect(emberButtons().map((button) => button.textContent)).toEqual(['Continue workout'])
  })

  it('dita e pushimit: stërvitja e radhës me datën, pa prush', async () => {
    await boardWeek()
    data.clock = at(7, 11)
    await renderToday()
    expect(await screen.findByRole('heading', { level: 1, name: 'Ditë pushimi' })).toBeInTheDocument()
    expect(banner()).toHaveTextContent('E shtunë, 7 nëntor · Faza 1 · Java 2')
    expect(banner()).toHaveTextContent('Stërvitja e radhës: e diel, 8 nëntor.')
    expect(screen.getByRole('img', { name: 'Sot, e shtunë 7, pushim' })).toBeInTheDocument()
    const card = screen.getByRole('region', { name: 'Stërvitja e radhës' })
    expect(within(card).getByText('Stërvitja 1 · 9 ushtrime · ~65 min')).toBeInTheDocument()
    expect(within(card).getByRole('button', { name: 'Fillo stërvitjen' })).toBeEnabled()
    expect(emberButtons()).toEqual([])
    act(() => language.set('en'))
    expect(screen.getByRole('heading', { level: 1, name: 'Rest day' })).toBeInTheDocument()
    expect(banner()).toHaveTextContent('Next workout: Sunday, 8 November.')
    expect(within(screen.getByRole('region', { name: 'Next workout' })).getByText('Workout 1 · 9 exercises · ~65 min')).toBeInTheDocument()
  })

  it('pas mbylljes së sotme: "U krye për sot", dita e sotme e bërë, e radhës e hëna', async () => {
    const { train } = await boardWeek()
    await train(at(8, 11, 17, 15), [{ weightKg: 62.5, reps: 12 }])
    data.clock = at(8, 11, 19)
    await renderToday()
    expect(await screen.findByRole('heading', { level: 1, name: 'U krye për sot' })).toBeInTheDocument()
    expect(banner()).toHaveTextContent('Stërvitja e radhës: e hënë, 9 nëntor.')
    expect(screen.getByRole('button', { name: 'Sot, e diel 8, e bërë' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Shpinë, biceps, bark' })).toBeInTheDocument()
    expect(emberButtons()).toEqual([])
    act(() => language.set('en'))
    expect(screen.getByRole('heading', { level: 1, name: 'Done for today' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Back, biceps, abs' })).toBeInTheDocument()
  })

  it('grupi kryesor ende i lodhur: "Dëgjo trupin sot." dhe rikuperimi me fjalë', async () => {
    const { store, train } = await boardWeek()
    const { skipWorkout } = await import('@/data/training')
    // E diela: gjoksi; pastaj tri stërvitjet e tjera të javës kapërcehen, e radhës është përsëri gjoksi.
    await train(at(8, 11, 17, 15), [{ weightKg: 62.5, reps: 12 }])
    for (let skipped = 0; skipped < 3; skipped += 1) await skipWorkout(store)
    data.clock = at(9, 11)
    await renderToday()
    expect(await screen.findByRole('heading', { level: 1, name: 'Dita e gjoksit' })).toBeInTheDocument()
    expect(banner()).toHaveTextContent('E hënë, 9 nëntor · Faza 1 · Java 3')
    expect(banner()).toHaveTextContent('Dëgjo trupin sot.')
    expect(screen.getByText('Gjoksi: i lodhur')).toBeInTheDocument()
    act(() => language.set('en'))
    expect(banner()).toHaveTextContent('Listen to your body today.')
    expect(screen.getByText('Chest: tired')).toBeInTheDocument()
  })

  it('para setit të parë: Java 0, zgjidh peshën, "Fillo stërvitjen e parë"', async () => {
    await onboarded()
    await renderToday()
    expect(await screen.findByRole('heading', { level: 1, name: 'Dita e gjoksit' })).toBeInTheDocument()
    expect(banner()).toHaveTextContent('E diel, 8 nëntor · Java 0')
    expect(banner()).toHaveTextContent('Seanca e parë: gjej peshën e çdo ushtrimi.')
    expect(screen.getByText('Bench Press: zgjidh peshën ku mbyll 12–\u206015.')).toBeInTheDocument()
    expect(screen.getByText('Stërvitja 1 · 9 ushtrime · ~45 min')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Proteina 0 gramë/ })).toBeInTheDocument()
    expect(emberButtons().map((button) => button.textContent)).toEqual(['Fillo stërvitjen e parë'])
    act(() => language.set('en'))
    expect(banner()).toHaveTextContent('Sunday, 8 November · Week 0')
    expect(screen.getByText('Bench Press: pick a weight you can lift for 12–\u206015.')).toBeInTheDocument()
    expect(emberButtons().map((button) => button.textContent)).toEqual(['Start your first workout'])
  })

  it('"Kapërce këtë stërvitje" pyet në fletë dhe e çon treguesin te stërvitja tjetër', async () => {
    const user = userEvent.setup()
    await boardWeek()
    await renderToday()
    await user.click(await screen.findByRole('button', { name: 'Kapërce këtë stërvitje' }))
    const dialog = screen.getByRole('dialog', { name: 'Kapërce këtë stërvitje' })
    expect(dialog).toHaveAccessibleDescription('Kalon te stërvitja tjetër pa e bërë këtë. Stërvitja shënohet si e kapërcyer.')
    await user.click(within(dialog).getByRole('button', { name: 'Anulo' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Dita e gjoksit' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Kapërce këtë stërvitje' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Kapërce' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Dita e shpinës' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Shpinë, biceps, bark' })).toBeInTheDocument()
  })

  it('programi i përfunduar: rinis nga Faza 1 ose zgjidh një program tjetër', async () => {
    const user = userEvent.setup()
    const { store } = await boardWeek()
    const [state] = await store.all('program_state')
    await store.put('program_state', { id: state.id, completed_at: at(8, 11).toISOString() })
    await renderToday()
    expect(await screen.findByRole('heading', { level: 1, name: 'Programi u përfundua' })).toBeInTheDocument()
    expect(banner()).toHaveTextContent('E diel, 8 nëntor')
    expect(banner()).toHaveTextContent('Shortcut to Size')
    expect(banner()).not.toHaveTextContent('Faza')
    expect(screen.queryByRole('list', { name: 'Java' })).not.toBeInTheDocument()
    expect(screen.getByText('Rinise nga Faza 1: peshat e sugjeruara dalin nga 1RM-të e reja.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Zgjidh një program tjetër' })).toHaveAttribute('href', '/programet')
    act(() => language.set('en'))
    expect(screen.getByRole('heading', { level: 1, name: 'Programme complete' })).toBeInTheDocument()
    expect(emberButtons().map((button) => button.textContent)).toEqual(['Restart from Phase 1'])
    act(() => language.set('sq'))

    await user.click(screen.getByRole('button', { name: 'Rinis nga Faza 1' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Dita e gjoksit' })).toBeInTheDocument()
    expect(banner()).toHaveTextContent('Faza 1 · Java 1')
  })

  it('pa program aktiv: hap programet', async () => {
    await freshStore()
    await renderToday()
    expect(await screen.findByRole('heading', { level: 2, name: 'Pa program aktiv' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Sot' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Zgjidh programin' })).toHaveAttribute('href', '/programet')
    act(() => language.set('en'))
    expect(screen.getByRole('heading', { level: 2, name: 'No active programme' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Choose a programme' })).toBeInTheDocument()
  })
})
