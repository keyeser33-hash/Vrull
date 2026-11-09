import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { LocalStore } from '@/data/store'
import { language } from '@/i18n/language'

// Bordet "Sot" (V2-E1-06; pamja e 0.23: "Sot", "Kthimi", "Sot · Diela"): ekrani me app-in e vërtetë mbi një bazë lokale prove. Ora e telefonit
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
      { path: '/kutia', element: <h1>Kutia</h1> },
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

/** Matësit e qëllimeve të javës: lidhja që hap Qëllimet e javës. */
const goalsLink = () => screen.getAllByRole('link').find((link) => link.getAttribute('href') === '/sot/java' && link.getAttribute('aria-label'))!

describe('Sot', () => {
  afterEach(() => act(() => language.set('sq')))

  it('dita e stërvitjes e bordit (0.23): "Sot", java me qëllimet, karta, ushqimi dhe një veprim prushi; edhe në anglisht', async () => {
    await boardWeek()
    await renderToday()
    const card = await screen.findByRole('region', { name: 'Stërvitja e sotme' })
    expect(screen.getByRole('heading', { level: 1, name: 'Sot' })).toBeInTheDocument()
    expect(banner()).toHaveTextContent('E diel, 8 nëntor · Faza 1 · Java 2')
    expect(within(banner()).getByRole('link', { name: 'Profili dhe cilësimet' })).toHaveAttribute('href', '/cilesimet')

    const week = screen.getByRole('region', { name: 'Java 2' })
    expect(within(week).getByRole('link', { name: 'Qëllimet' })).toHaveAttribute('href', '/sot/java')
    expect(weekLabels('Java')).toEqual([
      'E hënë 2, e bërë',
      'E martë 3, e bërë',
      'E mërkurë 4, pushim',
      'E enjte 5, e bërë',
      'E premte 6, pushim',
      'E shtunë 7, pushim',
      'Sot, e diel 8, stërvitja e radhës',
    ])
    await waitFor(() => expect(goalsLink()).toHaveAccessibleName('Qëllimet e javës: stërvitja 3 nga 4, ushqimi 0 nga 5 ditë, uji 0 nga 5 ditë'))
    expect(goalsLink()).toHaveTextContent('Stërvitja3 nga 4Ushqimi0 nga 5 ditëUji0 nga 5 ditë')

    expect(within(card).getByText('Sot · 17:15 · Stërvitja 1')).toBeInTheDocument()
    expect(within(card).getByRole('heading', { level: 2, name: 'Gjoks, triceps, pulpa' })).toBeInTheDocument()
    expect(within(card).getByText('9 ushtrime · ~65 min')).toBeInTheDocument()
    expect(within(card).getByText(paragraph('Bench Press: synim 62,5 × 9–⁠11.'))).toBeInTheDocument()
    expect(within(card).getByText('Gjoksi: gati')).toBeInTheDocument()
    expect(emberButtons().map((button) => button.textContent)).toEqual(['Fillo stërvitjen'])
    expect(screen.getByRole('button', { name: 'Kapërce këtë stërvitje' })).toHaveAttribute('aria-haspopup', 'dialog')
    const food = screen.getByRole('link', { name: /^Ushqimi: 400 nga [\d ]+ kcal, proteina 38 nga \d+ gramë$/ })
    expect(food).toHaveAttribute('href', '/ushqimi')
    expect(food).toHaveTextContent(/^Ushqimi.*400 \/ [\d\s]+ kcal38 \/ \d+ g proteinë$/)
    expect(await screen.findByRole('region', { name: 'Uji' })).toHaveTextContent('Ditë stërvitjeje: +0,5 L')
    // Pjesët e etapave të tjera nuk shpiken: pa gatishmëri, fakte dhe sfidë; pa kartën "Java jote" para të dielës 20:00.
    expect(screen.queryByText(/Gati|A e dije|Sfida|Java jote/)).not.toBeInTheDocument()

    act(() => language.set('en'))
    expect(screen.getByRole('heading', { level: 1, name: 'Today' })).toBeInTheDocument()
    expect(banner()).toHaveTextContent('Sunday, 8 November · Phase 1 · Week 2')
    expect(weekLabels('This week')).toEqual([
      'Monday 2, done',
      'Tuesday 3, done',
      'Wednesday 4, rest day',
      'Thursday 5, done',
      'Friday 6, rest day',
      'Saturday 7, rest day',
      'Today, Sunday 8, next workout',
    ])
    expect(within(screen.getByRole('region', { name: 'Week 2' })).getByRole('link', { name: 'Goals' })).toBeInTheDocument()
    expect(goalsLink()).toHaveAccessibleName('Weekly goals: workouts 3 of 4, food 0 of 5 days, water 0 of 5 days')
    const english = screen.getByRole('region', { name: "Today's workout" })
    expect(within(english).getByText('Today · 17:15 · Workout 1')).toBeInTheDocument()
    expect(within(english).getByText('9 exercises · ~65 min')).toBeInTheDocument()
    expect(within(english).getByRole('heading', { level: 2, name: 'Chest, triceps, calves' })).toBeInTheDocument()
    expect(within(english).getByText(paragraph('Bench Press: target 62.5 × 9–⁠11.'))).toBeInTheDocument()
    expect(within(english).getByText('Chest: ready')).toBeInTheDocument()
    expect(emberButtons().map((button) => button.textContent)).toEqual(['Start workout'])
    expect(screen.getByRole('button', { name: 'Skip this workout' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^Food: 400 of [\d,]+ kcal, protein 38 of \d+ grams$/ })).toHaveTextContent(/38 \/ \d+ g protein$/)
    expect(screen.getByRole('region', { name: 'Water' })).toHaveTextContent('Training day: +0.5 L')
  })

  it('"Fillo stërvitjen" hap seancën e stërvitjes së radhës; ushqimi hap Ushqimin', async () => {
    const user = userEvent.setup()
    const { store } = await boardWeek()
    const router = await renderToday()
    await user.click(await screen.findByRole('button', { name: 'Fillo stërvitjen' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/seanca'))
    const open = (await store.all('workout_sessions')).filter((row) => row.status === 'in_progress')
    expect(open).toEqual([expect.objectContaining({ week: 2, date: '2026-11-08' })])

    await act(() => router.navigate('/'))
    await user.click(await screen.findByRole('link', { name: /^Ushqimi: 400 nga/ }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/ushqimi'))
  })

  it('kutia e AI-së rri poshtë, gati; teksti që pret dërgimin del te ajo dhe e hap kutinë', async () => {
    const user = userEvent.setup()
    const { boxText } = await import('@/lib/box-text')
    await boardWeek()
    boxText.set('Në drekë 200 g pulë')
    const router = await renderToday()
    const dock = await screen.findByRole('link', { name: 'Kutia e AI-së: Pret dërgimin' })
    expect(dock).toHaveTextContent('Në drekë 200 g pulë')
    await user.click(dock)
    await waitFor(() => expect(router.state.location.pathname).toBe('/kutia'))
    boxText.set('')
    await act(() => router.navigate('/'))
    expect(await screen.findByRole('link', { name: 'Kutia e AI-së' })).toHaveTextContent('Shkruaj ose thuaj çfarë bëre')
    // Kutia nuk është veprimi kryesor i ekranit: prushi mbetet i stërvitjes.
    expect(emberButtons()).toHaveLength(1)
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
    const card = await screen.findByRole('region', { name: 'Stërvitja e sotme' })
    expect(within(card).getByText('Sot · 17:15 · Stërvitja 1 · 1 nga 30 sete')).toBeInTheDocument()
    expect(emberButtons().map((button) => button.textContent)).toEqual(['Vazhdo stërvitjen'])
    expect(screen.queryByRole('button', { name: 'Kapërce këtë stërvitje' })).not.toBeInTheDocument()
    act(() => language.set('en'))
    expect(screen.getByText('Today · 17:15 · Workout 1 · 1 of 30 sets')).toBeInTheDocument()
    expect(emberButtons().map((button) => button.textContent)).toEqual(['Continue workout'])
  })

  it('dita e pushimit: stërvitja e radhës me datën, pa prush', async () => {
    await boardWeek()
    data.clock = at(7, 11)
    await renderToday()
    const card = await screen.findByRole('region', { name: 'Stërvitja e radhës' })
    expect(banner()).toHaveTextContent('E shtunë, 7 nëntor · Faza 1 · Java 2')
    expect(within(card).getByText('Ditë pushimi')).toBeInTheDocument()
    expect(within(card).getByText('Nesër · 17:15 · Stërvitja 1')).toBeInTheDocument()
    expect(within(card).getByText('9 ushtrime · ~65 min')).toBeInTheDocument()
    expect(within(card).getByRole('button', { name: 'Fillo stërvitjen' })).toBeEnabled()
    expect(screen.getByRole('img', { name: 'Sot, e shtunë 7, pushim' })).toBeInTheDocument()
    expect(emberButtons()).toEqual([])
    act(() => language.set('en'))
    const english = screen.getByRole('region', { name: 'Next workout' })
    expect(within(english).getByText('Rest day')).toBeInTheDocument()
    expect(within(english).getByText('Tomorrow · 17:15 · Workout 1')).toBeInTheDocument()
  })

  it('dita e humbur: e mërkura pyet për të martën; "Po" e bën sot ditë stërvitjeje', async () => {
    const { train } = await boardWeek()
    await train(at(8, 11, 17, 15), [{ weightKg: 62.5, reps: 12 }])
    await train(at(9, 11, 17, 15), [{ weightKg: 40, reps: 10 }])
    data.clock = at(11, 11)
    await renderToday()
    const card = await screen.findByRole('region', { name: 'Dje nuk u stërvite' })
    expect(within(card).getByText('E martë, 10 nëntor')).toBeInTheDocument()
    expect(within(card).getByText(/^Stërvitja 3, .+, të pret\. E bën sot\?$/)).toBeInTheDocument()
    expect(within(card).getByText(/^Me "Po", sot bëhet ditë stërvitjeje: .+ kcal dhe vaktet rreth stërvitjes\./)).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'E martë 10, e humbur' })).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Stërvitja e radhës' })).getByText('Ditë pushimi')).toBeInTheDocument()
    expect(emberButtons().map((button) => button.textContent)).toEqual(['Po, sot në 17:15'])

    await userEvent.setup().click(within(card).getByRole('button', { name: 'Po, sot në 17:15' }))
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Dje nuk u stërvite' })).not.toBeInTheDocument())
    expect(screen.getByRole('region', { name: 'Stërvitja e sotme' })).toHaveTextContent('Sot · 17:15 · Stërvitja 3')
    expect(emberButtons().map((button) => button.textContent)).toEqual(['Fillo stërvitjen'])
    const { nutritionDay } = await import('@/data/nutrition')
    expect((await nutritionDay(data.store, '2026-11-11', data.clock)).dayType).toBe('training')
    // E marta mbetet e humbur te java.
    expect(screen.getByRole('img', { name: 'E martë 10, e humbur' })).toBeInTheDocument()
  })

  it('dita e humbur: "Jo, të enjten" e lë pushim; në anglisht', async () => {
    const { train } = await boardWeek()
    await train(at(8, 11, 17, 15), [{ weightKg: 62.5, reps: 12 }])
    await train(at(9, 11, 17, 15), [{ weightKg: 40, reps: 10 }])
    data.clock = at(11, 11)
    await renderToday()
    act(() => language.set('en'))
    const card = await screen.findByRole('region', { name: 'You didn’t train yesterday' })
    expect(within(card).getByRole('button', { name: 'Yes, today at 17:15' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Tuesday 10, missed' })).toBeInTheDocument()
    act(() => language.set('sq'))
    await userEvent.setup().click(within(screen.getByRole('region', { name: 'Dje nuk u stërvite' })).getByRole('button', { name: 'Jo, të enjten' }))
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Dje nuk u stërvite' })).not.toBeInTheDocument())
    expect(within(screen.getByRole('region', { name: 'Stërvitja e radhës' })).getByText('Ditë pushimi')).toBeInTheDocument()
  })

  it('pas mbylljes së sotme: "U krye për sot", dita e sotme e bërë, e radhës e hëna', async () => {
    const { train } = await boardWeek()
    await train(at(8, 11, 17, 15), [{ weightKg: 62.5, reps: 12 }])
    data.clock = at(8, 11, 19)
    await renderToday()
    const card = await screen.findByRole('region', { name: 'Stërvitja e radhës' })
    expect(within(card).getByText('U krye për sot')).toBeInTheDocument()
    expect(within(card).getByText('Nesër · 17:15 · Stërvitja 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sot, e diel 8, e bërë' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Shpinë, biceps, bark' })).toBeInTheDocument()
    expect(emberButtons()).toEqual([])
    // Qëllimi i stërvitjes u arrit (4 nga 4): unaza e shkëndijës një herë në javë (bordi "Lëvizja").
    await waitFor(() => expect(goalsLink().querySelectorAll('.border-ember-text')).toHaveLength(1))
    expect(await data.store.readDevice('goal-celebrated')).toEqual({ monday: '2026-11-02', keys: ['training'] })
    act(() => language.set('en'))
    expect(within(screen.getByRole('region', { name: 'Next workout' })).getByText('Done for today')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Back, biceps, abs' })).toBeInTheDocument()
    cleanup()
    await renderToday()
    await waitFor(() => expect(goalsLink()).toHaveAccessibleName('Weekly goals: workouts 4 of 4, food 0 of 5 days, water 0 of 5 days'))
    expect(goalsLink().querySelectorAll('.border-ember-text')).toHaveLength(0)
  })

  it('e diela pas 20:00 pa stërvitje sot: karta "Java jote" zë vendin e kartës, me stërvitjen e radhës poshtë', async () => {
    const user = userEvent.setup()
    const { train } = await boardWeek()
    await train(at(8, 11, 17, 15), [{ weightKg: 62.5, reps: 12 }])
    data.clock = at(8, 11, 20, 30)
    const router = await renderToday()
    const card = await screen.findByRole('region', { name: 'Java 2 u mbyll' })
    expect(card).toHaveTextContent('Java jote · 2–8 nëntor')
    expect(within(card).getByRole('img', { name: 'Qëllimet e javës: stërvitja 4 nga 4, ushqimi 0 nga 5 ditë, uji 0 nga 5 ditë' })).toHaveTextContent('Stërvitja4/4Ushqimi0/5Uji0/5')
    expect(within(card).getByRole('list')).toHaveTextContent('Vargu2 javë')
    expect(within(card).getByRole('link', { name: 'Shiko javën' })).toHaveAttribute('href', '/progresi/java/2026-11-02')
    // Pa javën me rripin, pa "Kapërce": karta e javës është e vetmja kartë kryesore.
    expect(screen.queryByRole('region', { name: 'Java 2' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Stërvitja e radhës' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Kapërce këtë stërvitje' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^Nesër · 17:15 · Faza 1 · Java 2 · Stërvitja 2Shpinë, biceps, bark/ })).toHaveAttribute('href', '/programi')
    act(() => language.set('en'))
    expect(screen.getByRole('region', { name: 'Week 2 is done' })).toHaveTextContent('Your week · 2–8 November')
    expect(screen.getByRole('link', { name: 'See your week' })).toBeInTheDocument()
    act(() => language.set('sq'))
    await user.click(screen.getByRole('link', { name: 'Shiko javën' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/progresi/java/2026-11-02'))
  })

  it('e hëna e stërvitjes: karta e stërvitjes dhe rreshti i shkurtër i javës; grupi kryesor ende i lodhur', async () => {
    const { store, train } = await boardWeek()
    const { skipWorkout } = await import('@/data/training')
    // E diela: gjoksi; pastaj tri stërvitjet e tjera të javës kapërcehen, e radhës është përsëri gjoksi.
    await train(at(8, 11, 17, 15), [{ weightKg: 62.5, reps: 12 }])
    for (let skipped = 0; skipped < 3; skipped += 1) await skipWorkout(store)
    data.clock = at(9, 11)
    await renderToday()
    const card = await screen.findByRole('region', { name: 'Stërvitja e sotme' })
    expect(banner()).toHaveTextContent('E hënë, 9 nëntor · Faza 1 · Java 3')
    expect(within(card).getByText('Gjoksi: i lodhur')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Shiko javën 2–8 nëntor' })).toHaveTextContent('Java 2 u mbyllJava 2 · 2–8 nëntorShiko')
    expect(screen.getByRole('region', { name: 'Java 3' })).toBeInTheDocument()
    expect(emberButtons().map((button) => button.textContent)).toEqual(['Fillo stërvitjen'])
    act(() => language.set('en'))
    expect(screen.getByText('Chest: tired')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'See the week of 2–8 November' })).toBeInTheDocument()
  })

  it('"Mirë se u ktheve" pas 10 ditësh: pa faj, çelësi "Seanca e parë më e lehtë" ndryshon peshat; java e re pas kartës', async () => {
    const user = userEvent.setup()
    await boardWeek()
    data.clock = at(15, 11)
    await renderToday()
    const card = await screen.findByRole('region', { name: 'Mirë se u ktheve' })
    expect(card).toHaveTextContent('10 ditë pa stërvitje. Ndodh. Programi të pret aty ku e le.')
    expect(within(card).getByText('Sot · 17:15 · Stërvitja 1')).toBeInTheDocument()
    const lighter = within(card).getByRole('switch', { name: /^Seanca e parë më e lehtë/ })
    expect(lighter).toBeChecked()
    expect(within(card).getByText((_, element) => element?.tagName === 'SPAN' && element.textContent === 'Peshat 90%. Bench Press 55\u00A0×\u00A09–\u206011 në vend të 62,5.')).toBeInTheDocument()
    expect(emberButtons().map((button) => button.textContent)).toEqual(['Fillo stërvitjen'])
    // Java e re vjen pas kartës, pa rripin; pa kartën e ditës së humbur dhe pa "Kapërce".
    expect(screen.getByRole('region', { name: 'Java e re' })).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Java' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Kapërce këtë stërvitje' })).not.toBeInTheDocument()

    await user.click(lighter)
    await waitFor(() => expect(within(card).getByRole('switch', { name: /^Seanca e parë më e lehtë/ })).not.toBeChecked())
    expect(within(card).getByText('Peshat e javës, si në program.')).toBeInTheDocument()
    const { lighterFirstSession } = await import('@/data/welcome-back')
    expect(await lighterFirstSession(data.store)).toBe(false)

    act(() => language.set('en'))
    const english = screen.getByRole('region', { name: 'Welcome back' })
    expect(english).toHaveTextContent('10 days without training. It happens. Your programme is waiting where you left it.')
    expect(within(english).getByRole('switch', { name: /^Lighter first session/ })).not.toBeChecked()
    expect(within(english).getByText('The week’s weights, as in the programme.')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'New week' })).toBeInTheDocument()
  })

  it('para setit të parë: Java 0, zgjidh peshën, "Fillo stërvitjen e parë"', async () => {
    await onboarded()
    await renderToday()
    const card = await screen.findByRole('region', { name: 'Stërvitja e sotme' })
    expect(banner()).toHaveTextContent('E diel, 8 nëntor · Java 0')
    expect(within(card).getByText('Bench Press: zgjidh peshën ku mbyll 12–⁠15.')).toBeInTheDocument()
    expect(within(card).getByText('9 ushtrime · ~45 min')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^Ushqimi: 0 nga/ })).toBeInTheDocument()
    expect(emberButtons().map((button) => button.textContent)).toEqual(['Fillo stërvitjen e parë'])
    act(() => language.set('en'))
    expect(banner()).toHaveTextContent('Sunday, 8 November · Week 0')
    expect(screen.getByText('Bench Press: pick a weight you can lift for 12–⁠15.')).toBeInTheDocument()
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
    expect(screen.getByRole('heading', { level: 2, name: 'Gjoks, triceps, pulpa' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Kapërce këtë stërvitje' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Kapërce' }))
    expect(await screen.findByRole('heading', { level: 2, name: 'Shpinë, biceps, bark' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('programi i përfunduar: rinis nga Faza 1 ose zgjidh një program tjetër', async () => {
    const user = userEvent.setup()
    const { store } = await boardWeek()
    const [state] = await store.all('program_state')
    await store.put('program_state', { id: state.id, completed_at: at(8, 11).toISOString() })
    await renderToday()
    const card = await screen.findByRole('region', { name: 'Programi u përfundua' })
    expect(card).toHaveTextContent('Shortcut to Size')
    expect(banner()).toHaveTextContent('E diel, 8 nëntor')
    expect(banner()).not.toHaveTextContent('Faza')
    expect(screen.queryByRole('list', { name: 'Java' })).not.toBeInTheDocument()
    expect(screen.getByText('Rinise nga Faza 1: peshat e sugjeruara dalin nga 1RM-të e reja.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Zgjidh një program tjetër' })).toHaveAttribute('href', '/programet')
    act(() => language.set('en'))
    expect(screen.getByRole('heading', { level: 2, name: 'Programme complete' })).toBeInTheDocument()
    expect(emberButtons().map((button) => button.textContent)).toEqual(['Restart from Phase 1'])
    act(() => language.set('sq'))

    await user.click(screen.getByRole('button', { name: 'Rinis nga Faza 1' }))
    expect(await screen.findByRole('heading', { level: 2, name: 'Gjoks, triceps, pulpa' })).toBeInTheDocument()
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
