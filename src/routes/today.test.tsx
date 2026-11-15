import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { LocalStore } from '@/data/store'
import { language } from '@/i18n/language'

// Sot i ri (V57, V63, SPEC §0.3f; bordet "Sot", "Sot · Pushim", "Sot · Diela", "Kthimi"): ekrani me app-in e vërtetë mbi një bazë
// lokale prove. Ora e telefonit është e diela 8 nëntor 2026 (data e bordeve), ose dita që zgjedh prova.
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

/** Java 0 dhe Java 1 e Fazës 1 si te bordi: Bench Press 60 × 13 → sot 62,5 × 9–⁠11. */
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
      { path: '/progresi/java/:monday', element: <h1>Përmbledhja e javës</h1> },
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
  afterEach(async () => {
    cleanup()
    await act(() => language.set('sq'))
  })

  it('dita e stërvitjes e bordit: rrathët, matësit, ritmi, karta me pilulën, java me pika dhe një veprim prushi; edhe në anglisht', async () => {
    await boardWeek()
    await renderToday()
    const card = await screen.findByRole('region', { name: 'Stërvitja e sotme' })
    expect(screen.getByRole('heading', { level: 1, name: 'Sot' })).toBeInTheDocument()
    expect(banner()).toHaveTextContent('E diel, 8 nëntor · Faza 1 · Java 2')
    expect(within(banner()).getByRole('link', { name: 'Profili dhe cilësimet' })).toHaveAttribute('href', '/cilesimet')

    // Radha e SPEC §0.3f: rrathët · matësit · ritmi · karta · java · kutia.
    const order = [
      await screen.findByRole('list', { name: 'Rrathët e ditës' }),
      screen.getByRole('region', { name: 'Kaloritë, proteina dhe uji sot' }),
      screen.getByRole('region', { name: /^Ritmi i ditës, nga 07:00 deri në 23:00$/ }),
      card,
      screen.getByRole('region', { name: 'Java 2' }),
      screen.getByRole('link', { name: 'Kutia e AI-së' }),
    ]
    order.slice(1).forEach((element, index) => expect(order[index].compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy())
    expect(within(order[0]).getAllByRole('button').map((button) => button.getAttribute('aria-label'))).toEqual(['Si ndihesh?, e re'])
    // Pa pllakën "Gati", kartën "Si ndihesh sot?", ushqimin dhe ujin e madh, matësit e javës dhe "A e dije?".
    expect(screen.queryByText(/A e dije|Sfida|Java jote/)).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Uji' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Si ndihesh sot?' })).not.toBeInTheDocument()

    const week = screen.getByRole('region', { name: 'Java 2' })
    expect(within(week).getByRole('link', { name: 'Qëllimet' })).toHaveAttribute('href', '/sot/java')
    expect(within(week).getByText('Pikat: stërvitja · ushqimi · uji')).toBeInTheDocument()
    expect(weekLabels('Java')).toEqual([
      'E hënë 2, e bërë. stërvitja u bë, ushqimi jo, uji jo',
      'E martë 3, e bërë. stërvitja u bë, ushqimi jo, uji jo',
      'E mërkurë 4, pushim. ushqimi jo, uji jo',
      'E enjte 5, e bërë. stërvitja u bë, ushqimi jo, uji jo',
      'E premte 6, pushim. ushqimi jo, uji jo',
      'E shtunë 7, pushim. ushqimi jo, uji jo',
      'Sot, e diel 8, stërvitja e radhës. stërvitja jo, ushqimi jo, uji jo',
    ])

    expect(within(card).getByText('Sot · 17:15 · Stërvitja 1')).toBeInTheDocument()
    expect(within(card).getByText('Pas 7 orë 15 min')).toBeInTheDocument()
    expect(within(card).getByRole('heading', { level: 2, name: 'Gjoks, triceps, pulpa' })).toBeInTheDocument()
    expect(within(card).getByText('9 ushtrime · ~65 min')).toBeInTheDocument()
    expect(within(card).getByText(paragraph('Bench Press: synim 62,5 × 9–⁠11.'))).toBeInTheDocument()
    expect(within(card).getByText('Gjoksi: gati')).toBeInTheDocument()
    expect(emberButtons().map((button) => button.textContent)).toEqual(['Fillo stërvitjen'])
    expect(screen.getByRole('button', { name: 'Kapërce këtë stërvitje' })).toHaveAttribute('aria-haspopup', 'dialog')

    act(() => language.set('en'))
    expect(screen.getByRole('heading', { level: 1, name: 'Today' })).toBeInTheDocument()
    expect(banner()).toHaveTextContent('Sunday, 8 November · Phase 1 · Week 2')
    expect(screen.getByRole('list', { name: 'Today’s circles' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'How do you feel?, new' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Calories, protein and water today' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Your day, from 07:00 to 23:00' })).toBeInTheDocument()
    expect(weekLabels('This week').at(-1)).toBe('Today, Sunday 8, next workout. no workout, food not reached, water not reached')
    expect(within(screen.getByRole('region', { name: 'Week 2' })).getByRole('link', { name: 'Goals' })).toBeInTheDocument()
    expect(screen.getByText('Dots: workout · food · water')).toBeInTheDocument()
    const english = screen.getByRole('region', { name: "Today's workout" })
    expect(within(english).getByText('Today · 17:15 · Workout 1')).toBeInTheDocument()
    expect(within(english).getByText('In 7 hours 15 min')).toBeInTheDocument()
    expect(within(english).getByText('9 exercises · ~65 min')).toBeInTheDocument()
    expect(within(english).getByRole('heading', { level: 2, name: 'Chest, triceps, calves' })).toBeInTheDocument()
    expect(within(english).getByText(paragraph('Bench Press: target 62.5 × 9–⁠11.'))).toBeInTheDocument()
    expect(within(english).getByText('Chest: ready')).toBeInTheDocument()
    expect(emberButtons().map((button) => button.textContent)).toEqual(['Start workout'])
    expect(screen.getByRole('button', { name: 'Skip this workout' })).toBeInTheDocument()
  })

  it('"Fillo stërvitjen" hap seancën e stërvitjes së radhës; kaloritë hapin Ushqimin', async () => {
    const user = userEvent.setup()
    const { store } = await boardWeek()
    const router = await renderToday()
    await user.click(await screen.findByRole('button', { name: 'Fillo stërvitjen' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/seanca'))
    const open = (await store.all('workout_sessions')).filter((row) => row.status === 'in_progress')
    expect(open).toEqual([expect.objectContaining({ week: 2, date: '2026-11-08' })])

    await act(() => router.navigate('/'))
    await user.click(await screen.findByRole('link', { name: /^Kalori: 400 nga/ }))
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

  it('një ditë e kaluar hap fletën e saj me seancën; "Hap seancën" çon te historiku', async () => {
    const user = userEvent.setup()
    const { store } = await boardWeek()
    const router = await renderToday()
    await user.click(await screen.findByRole('button', { name: /^E enjte 5, e bërë/ }))
    const sheet = await screen.findByRole('dialog', { name: 'E enjte, 5 nëntor' })
    expect(router.state.location.search).toBe('?dita=2026-11-05')
    const thursday = (await store.all('workout_sessions')).find((row) => row.date === '2026-11-05')
    await user.click(await within(sheet).findByRole('link', { name: 'Hap seancën' }))
    await waitFor(() => expect(router.state.location.pathname).toBe(`/progresi/historiku/${thursday?.id}`))
    expect(await screen.findByRole('heading', { level: 1, name: 'Seanca e kaluar' })).toBeInTheDocument()
  })

  it('fleta e një dite të kaluar pa seancë: pushimi, ushqimi i arritur (60%), uji që nuk u arrit, gjendja; "Hap ditën e ushqimit"', async () => {
    const user = userEvent.setup()
    const { store } = await boardWeek()
    const { dayTargets } = await import('@/data/nutrition')
    const kcal = Math.ceil((await dayTargets(store, '2026-11-04'))!.kcal * 0.6)
    await store.put('diary_entries', { date: '2026-11-04', meal: 'lunch', food_id: null, grams: 100, kcal, protein_g: 100, carbs_g: 0, fat_g: 0, logged_at: at(4, 11, 13).toISOString() })
    await store.put('water_logs', { date: '2026-11-04', ml: 500, logged_at: at(4, 11, 12).toISOString() })
    const { saveDailyState } = await import('@/data/daily-state')
    const state = await saveDailyState(store, '2026-11-04', { mood: 4, energy: 4, sleepMinutes: 450, sleepQuality: 4, soreness: 0, soreGroups: [] })
    const router = await renderToday()
    await user.click(await screen.findByRole('button', { name: /^E mërkurë 4, pushim/ }))
    const sheet = await screen.findByRole('dialog', { name: 'E mërkurë, 4 nëntor' })
    expect(await within(sheet).findByText('Ditë pushimi')).toBeInTheDocument()
    expect(within(sheet).queryByRole('link', { name: 'Hap seancën' })).not.toBeInTheDocument()
    expect(within(sheet).getByText(/^[\d\s]+ \/ [\d\s]+ kcal · 100 g proteinë$/)).toHaveTextContent(new RegExp(`^${String(kcal).slice(0, 1)}.* kcal · 100 g proteinë arritur$`))
    expect(within(sheet).getByText(/^0,5 \/ \d,\d+ L$/)).toHaveTextContent(/jo arritur$/)
    expect(within(sheet).getByText(new RegExp(`^Gati ${state.readiness}% · `))).toBeInTheDocument()
    act(() => language.set('en'))
    expect(screen.getByRole('dialog', { name: 'Wednesday, 4 November' })).toBeInTheDocument()
    expect(within(sheet).getByText('Rest day')).toBeInTheDocument()
    expect(within(sheet).getByText(/^[\d,\s]+ \/ [\d,\s]+ kcal · 100 g protein$/)).toHaveTextContent(/protein reached$/)
    expect(within(sheet).getByText(/^0\.5 \/ \d\.\d+ L$/)).toHaveTextContent(/not reached$/)
    act(() => language.set('sq'))
    await user.click(within(sheet).getByRole('link', { name: 'Hap ditën e ushqimit' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/ushqimi'))
    expect(router.state.location.search).toBe('?data=2026-11-04')
  })

  it('fleta e një dite me seancë: stërvitja, minutat dhe setet; prekja e sotmes e mbyll fletën', async () => {
    const user = userEvent.setup()
    await boardWeek()
    const router = await renderToday()
    await user.click(await screen.findByRole('button', { name: /^E hënë 2, e bërë/ }))
    const sheet = await screen.findByRole('dialog', { name: 'E hënë, 2 nëntor' })
    expect(await within(sheet).findByRole('link', { name: 'Hap seancën' })).toBeInTheDocument()
    expect(within(sheet).getByText(/^\d+ min · \d+ sete/)).toBeInTheDocument()
    expect(within(sheet).getByText(/^Stërvitja \d · /)).toBeInTheDocument()
    // Sot e mbyll fletën (butoni mbrapa).
    await user.click(screen.getByRole('button', { name: /^Sot, e diel 8/ }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(router.state.location.search).toBe('')
  })

  it('seanca e hapur: "Vazhdo stërvitjen" me setet e ruajtura, pa "Kapërce" dhe pa pilulën', async () => {
    const { store } = await boardWeek()
    const { saveSet, startWorkout, trainingSnapshot } = await import('@/data/training')
    const sessionId = await startWorkout(store)
    const [bench] = (await trainingSnapshot(store))!.plan.slots
    await saveSet(store, { sessionId, slot: bench, setNumber: 1, weightKg: 62.5, reps: 12 })
    await renderToday()
    const card = await screen.findByRole('region', { name: 'Stërvitja e sotme' })
    expect(within(card).getByText('Sot · 17:15 · Stërvitja 1 · 1 nga 30 sete')).toBeInTheDocument()
    expect(within(card).queryByText(/^Pas /)).not.toBeInTheDocument()
    expect(emberButtons().map((button) => button.textContent)).toEqual(['Vazhdo stërvitjen'])
    expect(screen.queryByRole('button', { name: 'Kapërce këtë stërvitje' })).not.toBeInTheDocument()
    act(() => language.set('en'))
    expect(screen.getByText('Today · 17:15 · Workout 1 · 1 of 30 sets')).toBeInTheDocument()
    expect(emberButtons().map((button) => button.textContent)).toEqual(['Continue workout'])
  })

  it('dita e pushimit: pa kartë dhe pa prush, stërvitja e radhës si rresht që hap fletën e ditës së ardhshme (vetëm për ta parë)', async () => {
    const user = userEvent.setup()
    await boardWeek()
    data.clock = at(7, 11)
    await renderToday()
    expect(await screen.findByRole('region', { name: 'Kaloritë, proteina dhe uji sot' })).toBeInTheDocument()
    expect(banner()).toHaveTextContent('E shtunë, 7 nëntor · Faza 1 · Java 2')
    expect(screen.queryByRole('region', { name: /^Stërvitja e/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Kapërce këtë stërvitje' })).not.toBeInTheDocument()
    expect(emberButtons()).toEqual([])
    expect(screen.getByRole('img', { name: 'Sot, e shtunë 7, pushim. ushqimi jo, uji jo' })).toBeInTheDocument()
    // Pa pikën e stërvitjes te ritmi i ditës: sot s'ka stërvitje.
    expect(screen.queryByRole('button', { name: /^Stërvitja, / })).not.toBeInTheDocument()
    const next = screen.getByRole('button', { name: /^Nesër · e diel, 8 nëntor · Stërvitja 1/ })
    expect(next).toHaveTextContent('Gjoks, triceps, pulpa')
    expect(next).toHaveTextContent('9 ushtrime · ~65 min')
    await user.click(next)
    const sheet = await screen.findByRole('dialog', { name: 'E diel, 8 nëntor' })
    expect(await within(sheet).findByText('Stërvitja e planifikuar')).toBeInTheDocument()
    expect(within(sheet).getByText('Gjoks, triceps, pulpa')).toBeInTheDocument()
    expect(within(sheet).getByText('Vetëm për ta parë. Peshat dalin kur nis stërvitja.')).toBeInTheDocument()
    expect(within(sheet).getAllByRole('listitem').length).toBe(9)
    act(() => language.set('en'))
    expect(screen.getByRole('dialog', { name: 'Sunday, 8 November' })).toBeInTheDocument()
    expect(await screen.findByText('Planned workout')).toBeInTheDocument()
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
    expect(screen.getByRole('button', { name: /^E martë 10, e humbur/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Nesër · e enjte, 12 nëntor · Stërvitja 3/ })).toBeInTheDocument()
    expect(emberButtons().map((button) => button.textContent)).toEqual(['Po, sot në 17:15'])

    await userEvent.setup().click(within(card).getByRole('button', { name: 'Po, sot në 17:15' }))
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Dje nuk u stërvite' })).not.toBeInTheDocument())
    expect(screen.getByRole('region', { name: 'Stërvitja e sotme' })).toHaveTextContent('Sot · 17:15 · Stërvitja 3')
    expect(emberButtons().map((button) => button.textContent)).toEqual(['Fillo stërvitjen'])
    const { nutritionDay } = await import('@/data/nutrition')
    expect((await nutritionDay(data.store, '2026-11-11', data.clock)).dayType).toBe('training')
    // E marta mbetet e humbur te java.
    expect(screen.getByRole('button', { name: /^E martë 10, e humbur/ })).toBeInTheDocument()
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
    expect(screen.getByRole('button', { name: /^Tuesday 10, missed/ })).toBeInTheDocument()
    act(() => language.set('sq'))
    await userEvent.setup().click(within(screen.getByRole('region', { name: 'Dje nuk u stërvite' })).getByRole('button', { name: 'Jo, të enjten' }))
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Dje nuk u stërvite' })).not.toBeInTheDocument())
    expect(screen.queryByRole('region', { name: 'Stërvitja e sotme' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Nesër · e enjte, 12 nëntor · Stërvitja 3/ })).toBeInTheDocument()
  })

  it('pas mbylljes së sotme: stërvitja e sotme e bërë te ritmi dhe java, e radhës e hëna si rresht', async () => {
    const { train } = await boardWeek()
    await train(at(8, 11, 17, 15), [{ weightKg: 62.5, reps: 12 }])
    data.clock = at(8, 11, 19)
    await renderToday()
    const next = await screen.findByRole('button', { name: /^Nesër · e hënë, 9 nëntor · Java \d · Stërvitja 2/ })
    expect(next).toHaveTextContent('Shpinë, biceps, bark')
    expect(screen.getByRole('img', { name: /^Sot, e diel 8, e bërë\. stërvitja u bë/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Stërvitja, 17:15, e bërë' })).toBeInTheDocument()
    expect(emberButtons()).toEqual([])
    act(() => language.set('en'))
    expect(screen.getByRole('button', { name: /^Tomorrow · Monday, 9 November · Week \d · Workout 2/ })).toHaveTextContent('Back, biceps, abs')
  })

  it('e diela pas 20:00: rrethi "Java jote" hap përmbledhjen e javës dhe bëhet i shikuar; pa kartën e vjetër', async () => {
    const user = userEvent.setup()
    const { train } = await boardWeek()
    await train(at(8, 11, 17, 15), [{ weightKg: 62.5, reps: 12 }])
    data.clock = at(8, 11, 20, 30)
    const router = await renderToday()
    const ring = await screen.findByRole('list', { name: 'Rrathët e ditës' })
    expect(within(ring).getAllByRole('button').map((button) => button.getAttribute('aria-label'))).toEqual(['Si ndihesh?, e re', 'Java jote, e re'])
    expect(screen.queryByRole('region', { name: 'Java 2 u mbyll' })).not.toBeInTheDocument()
    act(() => language.set('en'))
    expect(screen.getByRole('button', { name: 'Your week, new' })).toBeInTheDocument()
    act(() => language.set('sq'))
    await user.click(screen.getByRole('button', { name: 'Java jote, e re' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/progresi/java/2026-11-02'))
    expect(await data.store.readDevice('stories-seen')).toEqual({ date: '2026-11-08', ids: ['week:2026-11-02'] })
    await act(() => router.navigate('/'))
    expect(await screen.findByRole('button', { name: 'Java jote' })).toBeInTheDocument()
  })

  it('rrethi "Mentori" del vetëm kur ka shënim të javës; hap titullin, tekstin dhe hapat', async () => {
    const user = userEvent.setup()
    const { store } = await boardWeek()
    await renderToday()
    await screen.findByRole('list', { name: 'Rrathët e ditës' })
    expect(screen.queryByRole('button', { name: /^Mentori/ })).not.toBeInTheDocument()
    cleanup()
    await store.put('mentor_notes', { kind: 'raport_javor', title: 'Java 2 shkoi mirë', body: 'Bench Press u ngjit.', steps: ['Rrit 2,5 kg'], sources: [], language: 'sq', period_start: '2026-11-02', period_end: '2026-11-08' })
    await renderToday()
    await user.click(await screen.findByRole('button', { name: 'Mentori, e re' }))
    const sheet = await screen.findByRole('dialog', { name: 'Java 2 shkoi mirë' })
    expect(within(sheet).getByText('Bench Press u ngjit.')).toBeInTheDocument()
    expect(within(sheet).getByText('Rrit 2,5 kg')).toBeInTheDocument()
  })

  it('e hëna e stërvitjes: karta e stërvitjes; grupi kryesor ende i lodhur', async () => {
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
    expect(emberButtons().map((button) => button.textContent)).toEqual(['Fillo stërvitjen'])
    act(() => language.set('en'))
    expect(screen.getByText('Chest: tired')).toBeInTheDocument()
  })

  it('"Mirë se u ktheve" pas 10 ditësh: pa faj, çelësi "Seanca e parë më e lehtë" ndryshon peshat', async () => {
    const user = userEvent.setup()
    await boardWeek()
    data.clock = at(15, 11)
    await renderToday()
    const card = await screen.findByRole('region', { name: 'Mirë se u ktheve' })
    expect(card).toHaveTextContent('10 ditë pa stërvitje. Ndodh. Programi të pret aty ku e le.')
    expect(within(card).getByText('Sot · 17:15 · Stërvitja 1')).toBeInTheDocument()
    const lighter = within(card).getByRole('switch', { name: /^Seanca e parë më e lehtë/ })
    expect(lighter).toBeChecked()
    expect(within(card).getByText((_, element) => element?.tagName === 'SPAN' && element.textContent === 'Peshat 90%. Bench Press 55 × 9–⁠11 në vend të 62,5.')).toBeInTheDocument()
    expect(emberButtons().map((button) => button.textContent)).toEqual(['Fillo stërvitjen'])
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
  })

  it('para setit të parë: Java 0, zgjidh peshën, "Fillo stërvitjen e parë"', async () => {
    await onboarded()
    await renderToday()
    const card = await screen.findByRole('region', { name: 'Stërvitja e sotme' })
    expect(banner()).toHaveTextContent('E diel, 8 nëntor · Java 0')
    expect(within(card).getByText('Bench Press: zgjidh peshën ku mbyll 12–⁠15.')).toBeInTheDocument()
    expect(within(card).getByText('9 ushtrime · ~45 min')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^Kalori: 0 nga/ })).toBeInTheDocument()
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
