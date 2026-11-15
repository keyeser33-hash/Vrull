import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { LocalDatabase } from '@/data/db'
import type { LocalStore } from '@/data/store'
import { language } from '@/i18n'

// Progresi › Arritjet dhe mbyllja e seancës me javën dhe arritjen (V43; bordet "Progresi · Arritjet",
// "Arritjet · detaji", "Mbyllja · java dhe rekordet"), me store të vërtetë: Shortcut to Size nga e hëna
// 2 nëntor 2026, ditët e hënë, e martë, e enjte, e premte. Java 0 4 nga 4 me ushqimin 5 ditë dhe ujin
// 5 ditë (i fundit të shtunën); Faza 1 · Java 1 · Stërvitja 1 më 9 nëntor me rekordin e parë.
const data = vi.hoisted(() => ({ store: null as unknown as LocalStore, db: null as unknown as LocalDatabase, clock: null as Date | null }))
vi.mock('@/data/app-data', async () => {
  const { createDatabase } = await import('@/data/db')
  const { createLocalStore } = await import('@/data/store')
  const db = createDatabase(`achievements-ui-${crypto.randomUUID()}`)
  const store = createLocalStore(db, { userId: () => '11111111-1111-4111-8111-111111111111', now: () => data.clock ?? new Date() })
  data.store = store
  data.db = db
  return { store, useLocalQuery: (await import('@/test/local-query')).useLocalQueryFor(store) }
})

const at = (date: string, time = '10:00') => new Date(`${date}T${time}:00`)

async function train(date: string, sets: { weightKg: number; reps: number; rir?: number }[]) {
  const { finishWorkout, saveSet, startWorkout, trainingSnapshot } = await import('@/data/training')
  data.clock = at(date, '21:00')
  const sessionId = await startWorkout(data.store)
  const [first] = (await trainingSnapshot(data.store))!.plan.slots
  for (const [index, set] of sets.entries()) await saveSet(data.store, { sessionId, slot: first, setNumber: index + 1, ...set })
  data.clock = at(date, '22:06')
  await finishWorkout(data.store, sessionId)
  return sessionId
}

/** Hapat e parë, Java 0 me ushqimin dhe ujin, dhe seanca e rekordit më 9 nëntor; kthen id-në e saj. */
async function seed() {
  const { completeOnboarding } = await import('@/data/profile')
  const { dayTargets } = await import('@/data/nutrition')
  const { waterDay } = await import('@/data/water')
  await Promise.all(data.db.tables.map((table) => table.clear()))
  await (await import('@/test/fake-remote')).pullOnce(data.db, '11111111-1111-4111-8111-111111111111')
  data.clock = at('2026-11-01', '08:00')
  await completeOnboarding(data.store, { weightKg: 88, trainingDays: [1, 2, 4, 5], trainingTime: '21:00', wakeTime: '08:20', sleepTime: '01:00' }, () => data.clock!)
  await data.store.put('body_measurements', { date: '2026-11-01', weight_kg: 88 })
  for (const date of ['2026-11-02', '2026-11-03', '2026-11-05', '2026-11-06']) await train(date, [{ weightKg: 50, reps: 14, rir: 2 }])
  for (const date of ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06']) {
    const kcal = Math.ceil((await dayTargets(data.store, date))!.kcal * 0.6)
    await data.store.put('diary_entries', { date, meal: 'lunch', food_id: null, grams: 100, kcal, protein_g: 100, carbs_g: 0, fat_g: 0, logged_at: at(date, '13:00').toISOString() })
  }
  for (const date of ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-07']) {
    await data.store.put('water_logs', { date, ml: (await waterDay(data.store, date)).targetMl, logged_at: at(date, '12:00').toISOString() })
  }
  return train('2026-11-09', [{ weightKg: 60, reps: 13 }])
}

async function renderAt(path: string) {
  const { AchievementsPage } = await import('./achievements')
  const { SessionSummaryPage } = await import('./session-summary')
  const router = createMemoryRouter(
    [
      { path: '/', element: <p>Sot</p> },
      { path: '/progresi/arritjet', element: <AchievementsPage /> },
      { path: '/seanca/mbyllja/:sessionId', element: <SessionSummaryPage /> },
    ],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />)
  return router
}

const tiles = async () => within(await screen.findByRole('list', { name: /^(Arritjet|Achievements)$/ })).getAllByRole('button')

beforeAll(async () => {
  await import('@/data/app-data')
})

afterEach(() => {
  vi.useRealTimers()
  language.set('sq')
})

describe('Progresi › Arritjet', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(at('2026-11-12', '09:00'))
  })

  it('3 nga 10: të fituarat e para me datën, të tjerat me rregullin dhe progresin; tab-et e Progresit', async () => {
    await seed()
    data.clock = at('2026-11-12', '09:00')
    await renderAt('/progresi/arritjet')

    const list = await tiles()
    // Kreu i Progresit si te Përmbledhja (bordi V23-Progresi): titulli, pastaj data dhe java e programit poshtë.
    const title = screen.getByRole('heading', { level: 1, name: 'Progresi' })
    expect(title.previousElementSibling).toBeNull()
    await waitFor(() => expect(title.nextElementSibling).toHaveTextContent(/^E enjte, 12 nëntor · Faza 1 · Java 1$/))
    const tabs = screen.getByRole('tablist', { name: 'Pamjet e Progresit' })
    expect(within(tabs).getAllByRole('tab').map((tab) => [tab.textContent, tab.getAttribute('href'), tab.getAttribute('aria-selected')])).toEqual([
      ['Përmbledhja', '/progresi', 'false'],
      ['Trupi', '/progresi/trupi', 'false'],
      ['Historiku', '/progresi/historiku', 'false'],
      ['Arritjet', '/progresi/arritjet', 'true'],
    ])
    expect(screen.getByText('nga 10 të fituara').previousSibling).toHaveTextContent('3')
    expect(list.map((tile) => tile.textContent)).toEqual([
      'R1E reRekordi i parëe1RM e re për herë të parë · 9 nëntor',
      'JPE reJava e plotëTë tre qëllimet në një javë · 7 nëntor',
      'S1Seanca e parëSeanca e parë e mbyllur · 2 nëntor',
      '4JVargu 4 javë4 javë rresht me stërvitjen e plotë · edhe 3',
      '1010 rekordeRekorde të e1RM-së gjithsej · 1 nga 10',
      'F1Faza 1 e plotëTë 16 stërvitjet e fazës · 1 nga 16',
      '2525 seancaSeanca të mbyllura · 5 nga 25',
      'U7Ushqimi 7 nga 7Çdo ditë e javës e regjistruar · më e mira 5',
      'L7Uji 7 nga 7Objektivi i ujit çdo ditë · më e mira 5',
      '13Programi i plotë13 javët e Shortcut to Size · 1 nga 13',
    ])
    // Arritjet u ruajtën me hapjen e faqes.
    expect((await data.store.all('achievements')).map((row) => row.key).sort()).toEqual(['first_record', 'first_session', 'full_week'])
  })

  it('fleta: si fitohet, javët e vargut, më afër tani; "Mbyll" kthen te lista', async () => {
    await seed()
    data.clock = at('2026-11-12', '09:00')
    const user = userEvent.setup()
    const router = await renderAt('/progresi/arritjet')

    await user.click((await tiles())[3])
    const sheet = screen.getByRole('dialog', { name: 'Vargu 4 javë' })
    expect(router.state.location.search).toBe('?arritja=streak_4')
    expect(sheet).toHaveAccessibleDescription('Vargu tani: 1 nga 4 javë')
    expect(within(sheet).getByText('4 javë rresht me qëllimin e stërvitjes. Dita rezervë e fazës vlen; java që mbetet pa të e rinis vargun.')).toBeInTheDocument()
    const weeks = within(sheet).getByRole('list', { name: 'Javët e vargut' })
    expect(within(weeks).getAllByRole('listitem').map((item) => [item.getAttribute('aria-label'), item.textContent])).toEqual([
      ['Java 1: 4 nga 4', 'Java 14/4'],
      ['Java 2: ende jo', 'Java 2–'],
      ['Java 3: ende jo', 'Java 3–'],
      ['Java 4: ende jo', 'Java 4–'],
    ])
    expect(within(sheet).getByText('Më afër tani').nextSibling).toHaveTextContent('Ushqimi 7 nga 7 · 5 nga 7')
    await user.click(within(sheet).getAllByRole('button', { name: 'Mbyll' }).at(-1)!)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(router.state.location.search).toBe('')

    await user.click((await tiles())[0])
    expect(screen.getByRole('dialog', { name: 'Rekordi i parë' })).toHaveAccessibleDescription('Fituar më 9 nëntor')
  })

  it('anglisht', async () => {
    language.set('en')
    await seed()
    data.clock = at('2026-11-12', '09:00')
    const user = userEvent.setup()
    await renderAt('/progresi/arritjet')

    const list = await tiles()
    expect(screen.getByRole('heading', { level: 1, name: 'Progress' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Achievements', selected: true })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Summary' })).toBeInTheDocument()
    expect(screen.getByText('of 10 earned')).toBeInTheDocument()
    expect(screen.getByText('Each is earned once')).toBeInTheDocument()
    expect(list.map((tile) => tile.textContent)).toEqual([
      'PBNewFirst personal bestA new e1RM for the first time · 9 November',
      'FWNewFull weekAll three goals in one week · 7 November',
      'S1First sessionFirst session finished · 2 November',
      '4W4-week streak4 weeks in a row with every workout · 3 to go',
      '1010 personal bestse1RM personal bests in total · 1 of 10',
      'P1Phase 1 completeAll 16 workouts of the phase · 1 of 16',
      '2525 sessionsSessions finished · 5 of 25',
      'F7Food 7 of 7Every day of the week logged · best 5',
      'W7Water 7 of 7Water target every day · best 5',
      '13Programme completeAll 13 weeks of Shortcut to Size · 1 of 13',
    ])
    await user.click(list[7])
    const sheet = screen.getByRole('dialog', { name: 'Food 7 of 7' })
    expect(sheet).toHaveAccessibleDescription('Best so far: 5 of 7 days')
    expect(within(sheet).getByText('How to earn it')).toBeInTheDocument()
    expect(within(sheet).getByText('Closest now').nextSibling).toHaveTextContent('Water 7 of 7 · 5 of 7')
  })
})

describe('mbyllja e seancës: java dhe arritja', () => {
  it('Java 1 · 1 nga 4 me segmentin e kësaj seance, stërvitja e nesërme, ushqimi, uji dhe "Arritje e re"', async () => {
    const sessionId = await seed()
    data.clock = at('2026-11-09', '22:07')
    await renderAt(`/seanca/mbyllja/${sessionId}`)

    expect(await screen.findByRole('heading', { level: 1, name: 'Rekord i ri' })).toBeInTheDocument()
    const week = await screen.findByRole('region', { name: 'Java 1' })
    expect(week).toHaveTextContent('Java 11nga 4 stërvitje')
    const segments = within(week).getByRole('img', { name: '1 nga 4 stërvitje, me këtë seancë' })
    expect([...segments.children].map((segment) => segment.hasAttribute('data-this'))).toEqual([true, false, false, false])
    expect(within(week).getByText('Nesër: Stërvitja 2 · Shpinë, biceps, bark. Edhe 3 për qëllimin e stërvitjes.')).toBeInTheDocument()
    expect(week).toHaveTextContent('Ushqimi 0 nga 5 ditëUji 0 nga 5 ditë')
    const fresh = await screen.findByRole('list', { name: 'Arritje e re' })
    expect(within(fresh).getByRole('link')).toHaveTextContent('Arritje e reRekordi i parë')
    expect(within(fresh).getByRole('link')).toHaveAttribute('href', '/progresi/arritjet')
    expect(await data.store.all('achievements')).toHaveLength(3)
  })

  it('pa arritje të re: më e afërta me sa mungon; anglisht', async () => {
    language.set('en')
    await seed()
    const plain = await train('2026-11-10', [{ weightKg: 40, reps: 10 }])
    data.clock = at('2026-11-10', '22:07')
    await renderAt(`/seanca/mbyllja/${plain}`)

    const week = await screen.findByRole('region', { name: 'Week 1' })
    expect(within(week).getByRole('img', { name: '2 of 4 workouts, including this session' })).toBeInTheDocument()
    expect(within(week).getByText('Thursday: Workout 3 · Shoulders, traps, calves. 2 more for your training goal.')).toBeInTheDocument()
    expect(week).toHaveTextContent('Food 0 of 5 daysWater 0 of 5 days')
    const nearest = await screen.findByRole('link', { name: /Food 7 of 7/ })
    expect(nearest).toHaveTextContent('Food 7 of 7 · 2 to go')
    expect(screen.queryByText('New achievement')).not.toBeInTheDocument()
  })
})
