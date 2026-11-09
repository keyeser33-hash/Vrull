import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { CheckInAnswers } from '@/data/daily-state'
import type { LocalStore } from '@/data/store'
import { language } from '@/i18n/language'

// Karta "Si ndihesh sot?", pllaka "Gati" dhe fletat e tyre (V50, V2-E3-04/05; bordet "Sot · Si ndihesh sot?", "Gjendja e
// ditës", "Fleta Gati"): me app-in e vërtetë mbi një bazë lokale prove. Sot është e diela 8 nëntor 2026 (ditë stërvitjeje),
// ose e mërkura 11 nëntor (pushim).
const data = vi.hoisted(() => ({ store: null as unknown as LocalStore, clock: new Date(2026, 10, 8, 10, 0) }))

vi.mock('@/lib/webgl', () => ({ webglAvailable: () => false }))
vi.mock('@/data/app-data', async () => {
  const store = new Proxy({} as LocalStore, {
    get: (_, key: keyof LocalStore) => {
      const value = data.store[key]
      return typeof value === 'function' ? value.bind(data.store) : value
    },
  })
  return { store, useLocalQuery: (await import('@/test/local-query')).useLocalQueryFor(store) }
})

const USER = '11111111-1111-4111-8111-111111111111'
const at = (day: number, month: number, hours = 10, minutes = 0) => new Date(2026, month - 1, day, hours, minutes)
const PROFILE = { weightKg: 80, trainingDays: [7, 1, 2, 4], trainingTime: '17:15', wakeTime: '07:10', sleepTime: '01:10' }
const ANSWERS: CheckInAnswers = { mood: 3, energy: 2, sleepMinutes: 360, sleepQuality: 3, soreness: 2, soreGroups: ['gjoksi'] }

async function setup(clock = at(8, 11)) {
  const { createDatabase } = await import('@/data/db')
  const { createLocalStore } = await import('@/data/store')
  data.clock = at(25, 10, 9)
  data.store = createLocalStore(createDatabase(`readiness-card-${crypto.randomUUID()}`), { userId: () => USER, now: () => data.clock })
  const { completeOnboarding } = await import('@/data/profile')
  await completeOnboarding(data.store, PROFILE, () => data.clock)
  data.clock = clock
  return data.store
}

async function renderCard() {
  const { useLocalQuery, store } = await import('@/data/app-data')
  const { todayView } = await import('@/data/today')
  const { ReadinessCard } = await import('./readiness-card')
  function Host() {
    const view = useLocalQuery(() => todayView(store), [])
    return view ? <ReadinessCard view={view} /> : null
  }
  const router = createMemoryRouter([{ path: '/', element: <Host /> }], { initialEntries: ['/'] })
  render(<RouterProvider router={router} />)
  return router
}

async function stored(date = '2026-11-08') {
  const { readDailyState } = await import('@/data/daily-state')
  return readDailyState(data.store, date)
}

describe('karta "Si ndihesh sot?" dhe pllaka "Gati"', () => {
  afterEach(async () => {
    cleanup()
    await act(() => language.set('sq'))
  })

  it('pa gjendje: karta me "Plotëso" dhe "Jo sot", pa pllakë', async () => {
    await setup()
    await renderCard()
    expect(await screen.findByRole('heading', { name: 'Si ndihesh sot?' })).toBeInTheDocument()
    expect(screen.getByText('Katër pyetje, 10 sekonda. Vrull e përshtat seancën sipas teje.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Plotëso' })).toBeInTheDocument()
    expect(screen.queryByText('Gati')).not.toBeInTheDocument()
  })

  it('"Jo sot" e fsheh kartën për atë ditë dhe nuk ruan gjendje', async () => {
    const store = await setup()
    await renderCard()
    await userEvent.click(await screen.findByRole('button', { name: 'Jo sot' }))
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Si ndihesh sot?' })).not.toBeInTheDocument())
    const { checkInSkipped } = await import('@/data/daily-state')
    expect(await checkInSkipped(store, '2026-11-08')).toBe(true)
    expect(await stored()).toBeNull()
    expect(screen.queryByRole('button', { name: /Gatishmëria/ })).not.toBeInTheDocument()
  })

  it('me gjendje: pllaka e ka përqindjen nga rreshti (rikuperimi i çastit të check-in-it)', async () => {
    const store = await setup()
    const { readinessOfState, saveDailyState } = await import('@/data/daily-state')
    const { checkInContext } = await import('@/data/readiness-view')
    const { todayView } = await import('@/data/today')
    await saveDailyState(store, '2026-11-08', ANSWERS, checkInContext(await todayView(store), ANSWERS))
    const expected = readinessOfState((await stored())!)
    expect((await stored())?.readiness).toBe(expected.percent)
    await renderCard()
    const tile = await screen.findByRole('button', { name: /Gatishmëria/ })
    expect(tile).toHaveAccessibleName(new RegExp(`${expected.percent} për qind`))
    expect(within(tile).getByText(`${expected.percent}%`)).toBeInTheDocument()
    expect(within(tile).getByText(expected.level === 'low' ? 'E ulët' : expected.level === 'high' ? 'E lartë' : 'Normale')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Si ndihesh sot?' })).not.toBeInTheDocument()
  })

  it('fleta e check-in-it: vlera e gjumit nga profili, çipat, ruajtja me gatishmërinë', async () => {
    const store = await setup()
    await renderCard()
    await userEvent.click(await screen.findByRole('button', { name: 'Plotëso' }))
    const sheet = await screen.findByRole('dialog', { name: 'Gjendja e ditës' })
    expect(within(sheet).getByText('Nga ora e gjumit · 01:10–07:10')).toBeInTheDocument()
    expect(within(sheet).getByText('6 orë')).toBeInTheDocument()
    // Pa dhimbje, pa figurë dhe pa çipa.
    expect(within(sheet).queryByRole('group', { name: 'Grupet me dhimbje' })).not.toBeInTheDocument()
    await userEvent.click(within(sheet).getByRole('button', { name: 'Rrit gjumin me gjysmë ore' }))
    expect(within(sheet).getByText('6,5 orë')).toBeInTheDocument()
    await userEvent.click(within(sheet).getByRole('button', { name: 'Ul gjumin me gjysmë ore' }))
    await userEvent.click(within(within(sheet).getByRole('group', { name: 'Energjia' })).getByRole('button', { name: 'E ulët' }))
    await userEvent.click(within(sheet).getByRole('button', { name: 'Mesatare' }))
    const chips = within(sheet).getByRole('group', { name: 'Grupet me dhimbje' })
    expect(within(chips).getAllByRole('button').map((chip) => chip.textContent)).toEqual(['Gjoksi', 'Shpina', 'Shpatullat', 'Krahët', 'Këmbët', 'Barku'])
    await userEvent.click(within(chips).getByRole('button', { name: 'Krahët' }))
    expect(within(sheet).getByRole('img', { name: /të zgjedhur: Krahët/ })).toBeInTheDocument()
    await userEvent.click(within(sheet).getByRole('button', { name: 'Ruaj' }))

    const tile = await screen.findByRole('button', { name: /Gatishmëria/ })
    const state = await stored()
    expect(state).toMatchObject({ mood: 3, energy: 2, sleepMinutes: 360, sleepQuality: 3, soreness: 2, soreGroups: ['bicepsi', 'tricepsi', 'parakrahet'] })
    const { readinessOfState } = await import('@/data/daily-state')
    const { todayView } = await import('@/data/today')
    // Rreshti mban rikuperimin e stërvitjes së sotme dhe dhimbjen (triceps stërvitet sot).
    expect(state).toMatchObject({ recovery: (await todayView(store)).workout?.recovery, soreTrained: true })
    const percent = readinessOfState(state!).percent
    expect(state?.readiness).toBe(percent)
    expect(within(tile).getByText(`${percent}%`)).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('"Jo sot" te fleta e mbyll si "Jo sot" te karta', async () => {
    const store = await setup()
    await renderCard()
    await userEvent.click(await screen.findByRole('button', { name: 'Plotëso' }))
    const sheet = await screen.findByRole('dialog', { name: 'Gjendja e ditës' })
    await userEvent.click(within(sheet).getByRole('button', { name: 'Jo sot' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const { checkInSkipped } = await import('@/data/daily-state')
    expect(await checkInSkipped(store, '2026-11-08')).toBe(true)
    expect(await stored()).toBeNull()
  })

  it('fleta "Gati" ditë stërvitjeje: përqindja, pesë pjesët, fjalia e nivelit të ulët; "Ndrysho gjendjen" e hap të mbushur dhe ruan ndryshimin', async () => {
    const store = await setup()
    const { readinessOfState, saveDailyState } = await import('@/data/daily-state')
    const { checkInContext } = await import('@/data/readiness-view')
    const { todayView } = await import('@/data/today')
    const view = await todayView(store)
    expect(view.workout).not.toBeNull()
    await saveDailyState(store, '2026-11-08', ANSWERS, checkInContext(view, ANSWERS))
    const before = readinessOfState((await stored())!)
    await renderCard()
    await userEvent.click(await screen.findByRole('button', { name: /Gatishmëria/ }))
    const sheet = await screen.findByRole('dialog', { name: 'Gatishmëria' })
    expect(within(sheet).getByRole('region', { name: new RegExp(`${before.percent} për qind`) })).toBeInTheDocument()
    const parts = within(within(sheet).getByRole('region', { name: 'Nga çfarë del' })).getAllByRole('listitem')
    expect(parts.map((item) => within(item).getByText(/^(Gjumi|Energjia|Rikuperimi|Dhimbjet|Gjendja)$/).textContent)).toEqual(['Gjumi', 'Energjia', 'Rikuperimi', 'Dhimbjet', 'Gjendja'])
    expect(within(parts[0]).getByText('6 orë, Normal')).toBeInTheDocument()
    expect(within(parts[0]).getByText('pesha 30%')).toBeInTheDocument()
    expect(within(parts[1]).getByText('E ulët')).toBeInTheDocument()
    expect(within(parts[3]).getByText(/Mesatare te gjoksi/)).toBeInTheDocument()
    expect(within(sheet).getByText('Nuk është vlerësim mjekësor.')).toBeInTheDocument()
    if (before.level === 'low') expect(within(sheet).getByText('Nën 60% Vrull propozon seancën më të lehtë. Vendos ti.')).toBeInTheDocument()

    await userEvent.click(within(sheet).getByRole('button', { name: 'Ndrysho gjendjen' }))
    const form = await screen.findByRole('dialog', { name: 'Gjendja e ditës' })
    expect(within(within(form).getByRole('group', { name: 'Energjia' })).getByRole('button', { name: 'E ulët', pressed: true })).toBeInTheDocument()
    expect(within(form).getByRole('button', { name: 'Mesatare', pressed: true })).toBeInTheDocument()
    expect(within(form).getByRole('button', { name: 'Gjoksi', pressed: true })).toBeInTheDocument()
    expect(within(form).queryByRole('button', { name: 'Jo sot' })).not.toBeInTheDocument()
    await userEvent.click(within(within(form).getByRole('group', { name: 'Gjendja' })).getByRole('button', { name: 'Shkëlqyer' }))
    await userEvent.click(within(within(form).getByRole('group', { name: 'Energjia' })).getByRole('button', { name: 'Shumë e lartë' }))
    await userEvent.click(within(form).getByRole('button', { name: 'Ruaj' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const state = await stored()
    expect(state).toMatchObject({ mood: 5, energy: 5, soreGroups: ['gjoksi'] })
    const after = readinessOfState(state!).percent
    expect(after).toBeGreaterThan(before.percent)
    expect(state?.readiness).toBe(after)
    expect(await screen.findByText(`${after}%`)).toBeInTheDocument()
  })

  it('fleta "Gati" në ditë pushimi ka 4 rreshta, pa rikuperim', async () => {
    const store = await setup(at(11, 11))
    const { saveDailyState } = await import('@/data/daily-state')
    await saveDailyState(store, '2026-11-11', { ...ANSWERS, soreness: 0, soreGroups: [] })
    await renderCard()
    await userEvent.click(await screen.findByRole('button', { name: /Gatishmëria/ }))
    const sheet = await screen.findByRole('dialog', { name: 'Gatishmëria' })
    const parts = within(within(sheet).getByRole('region', { name: 'Nga çfarë del' })).getAllByRole('listitem')
    expect(parts).toHaveLength(4)
    expect(within(sheet).queryByText('Rikuperimi')).not.toBeInTheDocument()
    expect(within(parts[2]).getByText('Asnjë')).toBeInTheDocument()
  })

  it('14 ditët: vlera e ruajtur e ditëve të kaluara, "—" pa check-in, sot nga rreshti, mesatarja', async () => {
    const store = await setup()
    const { saveDailyState } = await import('@/data/daily-state')
    const day7 = (await saveDailyState(store, '2026-11-07', { ...ANSWERS, energy: 4 })).readiness!
    const day5 = (await saveDailyState(store, '2026-11-05', { ...ANSWERS, energy: 5, mood: 5 })).readiness!
    const now = (await saveDailyState(store, '2026-11-08', ANSWERS)).readiness!
    expect(new Set([day7, day5, now]).size).toBe(3)
    await renderCard()
    await userEvent.click(await screen.findByRole('button', { name: /Gatishmëria/ }))
    const sheet = await screen.findByRole('dialog', { name: 'Gatishmëria' })
    const days = within(within(sheet).getByRole('region', { name: '14 ditët e fundit' })).getAllByRole('listitem')
    await waitFor(() => expect(days.filter((day) => /pa check-in/.test(day.getAttribute('aria-label') ?? ''))).toHaveLength(11))
    expect(days).toHaveLength(14)
    expect(days[13].getAttribute('aria-label')).toMatch(new RegExp(`^Sot, .*8 nëntor, ${now}%`))
    expect(days[12].getAttribute('aria-label')).toMatch(new RegExp(`7 nëntor, ${day7}%$`))
    expect(days[10].getAttribute('aria-label')).toMatch(new RegExp(`5 nëntor, ${day5}%$`))
    expect(days[0]).toHaveTextContent('—')
    expect(within(sheet).getByText(`mesatarja ${Math.round((day7 + day5 + now) / 3)}%`)).toBeInTheDocument()
  })

  it('anglishtja: karta, fleta e check-in-it dhe fleta "Gati"', async () => {
    const store = await setup()
    await act(() => language.set('en'))
    await renderCard()
    expect(await screen.findByRole('heading', { name: 'How are you feeling today?' })).toBeInTheDocument()
    expect(screen.getByText('Four questions, 10 seconds. Vrull adapts the session to you.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Fill in' }))
    const form = await screen.findByRole('dialog', { name: 'Daily check-in' })
    expect(within(form).getByText('From your bedtime · 01:10–07:10')).toBeInTheDocument()
    expect(within(form).getByText('6 hours')).toBeInTheDocument()
    await userEvent.click(within(form).getByRole('button', { name: 'Slight' }))
    expect(within(form).getByRole('button', { name: 'Legs' })).toBeInTheDocument()
    await userEvent.click(within(form).getByRole('button', { name: 'Save' }))
    await userEvent.click(await screen.findByRole('button', { name: /Readiness \d+ per cent/ }))
    const sheet = await screen.findByRole('dialog', { name: 'Readiness' })
    expect(within(sheet).getByText('What it is made of')).toBeInTheDocument()
    expect(within(sheet).getByText('Last 14 days')).toBeInTheDocument()
    expect(within(sheet).getByText('Not a medical assessment.')).toBeInTheDocument()
    expect(within(sheet).getByRole('button', { name: 'Change check-in' })).toBeInTheDocument()
    expect((await stored())?.soreness).toBe(1)
    expect(store).toBe(data.store)
  })
})
