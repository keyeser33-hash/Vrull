import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { CheckInAnswers } from '@/data/daily-state'
import type { LocalStore } from '@/data/store'
import { language } from '@/i18n/language'

// Rrathët "Si ndihesh?" dhe "Gati N%" dhe story-t e gjendjes së ditës (V50, V57, V2-E3-34b; bordet "Sot", "Story · Gjendja", "Story · Gjumi", "Story · Gati"):
// me app-in e vërtetë mbi një bazë lokale prove. Sot është e diela 8 nëntor 2026 (ditë stërvitjeje),
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

async function renderCard(entry = '/') {
  const { useLocalQuery, store } = await import('@/data/app-data')
  const { todayView } = await import('@/data/today')
  const { TodayStories } = await import('./today-stories')
  const { ReadinessSheets } = await import('./readiness-sheets')
  function Host() {
    const view = useLocalQuery(() => todayView(store), [])
    return view ? (
      <>
        <TodayStories view={view} />
        <ReadinessSheets view={view} />
      </>
    ) : null
  }
  const router = createMemoryRouter([{ path: '/', element: <Host /> }], { initialEntries: [entry] })
  render(<RouterProvider router={router} />)
  return router
}

async function stored(date = '2026-11-08') {
  const { readDailyState } = await import('@/data/daily-state')
  return readDailyState(data.store, date)
}

const level = (label: string, n: number) => ({ name: `${label}, niveli ${n} nga 5` })
const close = () => userEvent.click(screen.getByRole('button', { name: /^(Mbyll|Close)$/ }))
const heading = (name: string) => screen.getByRole('heading', { name })

/** Përgjigjet e katërta me ANSWERS-in e provave (gjendja Normale, energjia E ulët, 6 orë Normal, dhimbje Mesatare te Krahët). */
async function fillAll() {
  await userEvent.click(await screen.findByRole('button', { name: 'Si ndihesh?, e re' }))
  await userEvent.click(await screen.findByRole('button', level('Normale', 3)))
  await userEvent.click(screen.getByRole('button', level('E ulët', 2)))
  await userEvent.click(screen.getByRole('button', { name: 'Tjetra' }))
  await userEvent.click(screen.getByRole('button', level('Mesatare', 3)))
  await userEvent.click(screen.getByRole('button', { name: 'Krahët' }))
  await userEvent.click(screen.getByRole('button', { name: 'Tjetra' }))
}

describe('rrathët "Si ndihesh?" dhe "Gati" dhe story-t e tyre', () => {
  afterEach(async () => {
    cleanup()
    await act(() => language.set('sq'))
  })

  it('pa gjendje: rrethi "Si ndihesh?" i ri, pa "Gati"', async () => {
    await setup()
    await renderCard()
    expect(await screen.findByRole('button', { name: 'Si ndihesh?, e re' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Gati/ })).not.toBeInTheDocument()
  })

  it('hapet ekran i plotë në pyetjen e parë, me 5 shirita dhe "1 / 4"; "Jo sot" e bën rrethin gri pa ruajtur gjendje', async () => {
    const store = await setup()
    await renderCard()
    await userEvent.click(await screen.findByRole('button', { name: 'Si ndihesh?, e re' }))
    const story = await screen.findByRole('dialog', { name: 'Si ndihesh sot?' })
    expect(heading('Si është gjendja jote sot?')).toBeInTheDocument()
    expect(within(story).getByRole('progressbar')).toHaveAttribute('aria-valuetext', 'Story 1 nga 5: Gjendja')
    expect(within(story).getByText('1 / 4')).toBeInTheDocument()
    expect(within(story).getAllByRole('button').filter((button) => /niveli/.test(button.getAttribute('aria-label') ?? ''))).toHaveLength(5)
    await userEvent.click(within(story).getByRole('button', { name: 'Jo sot' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const { checkInSkipped } = await import('@/data/daily-state')
    expect(await checkInSkipped(store, '2026-11-08')).toBe(true)
    expect(await stored()).toBeNull()
    expect(await screen.findByRole('button', { name: 'Si ndihesh?' })).toBeInTheDocument()
  })

  it('rrjedha 4 + 1: një zgjedhje kalon vetë, gjumi ka "Tjetra", rreshti shkruhet kur janë të katërta dhe story i 5-të ka gatishmërinë', async () => {
    const store = await setup()
    await renderCard()
    await fillAll()
    expect(await screen.findByText(/^\d+%$/)).toBeInTheDocument()
    const state = await waitFor(async () => {
      const row = await stored()
      expect(row).not.toBeNull()
      return row!
    })
    expect(state).toMatchObject({ mood: 3, energy: 2, sleepMinutes: 360, sleepQuality: 3, soreness: 2, soreGroups: ['bicepsi', 'tricepsi', 'parakrahet'] })
    const { readinessOfState } = await import('@/data/daily-state')
    const { todayView } = await import('@/data/today')
    expect(state).toMatchObject({ recovery: (await todayView(store)).workout?.recovery, soreTrained: true })
    const percent = readinessOfState(state).percent
    expect(state.readiness).toBe(percent)
    const story = screen.getByRole('dialog', { name: 'Si ndihesh sot?' })
    expect(within(story).getByText(`${percent}%`)).toBeInTheDocument()
    const parts = within(within(story).getByRole('region', { name: 'Nga çfarë del' }) ?? story).getAllByRole('listitem')
    expect(parts).toHaveLength(5)
    expect(within(parts[0]).getByText(/6 orë, Normal/)).toBeInTheDocument()
    expect(within(parts[3]).getByText(/Mesatare te krahët/)).toBeInTheDocument()
    expect(within(story).getByText('Story 5 nga 5: Gatishmëria')).toBeInTheDocument()
    await close()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    // Rrethi bëhet "Gati N%" dhe "Si ndihesh?" zhduket; story i 5-të u pa, ndaj unaza është gri.
    expect(await screen.findByRole('button', { name: `Gati ${percent}%` })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Si ndihesh\?/ })).not.toBeInTheDocument()
    expect(await store.readDevice('stories-seen')).toEqual({ date: '2026-11-08', ids: ['checkin', 'ready'] })
  })

  it('prekja e një përgjigjeje duket menjëherë, pa pritur bazën (MESIMET)', async () => {
    const store = await setup()
    // Çdo shkrim lokal vonon 1,5 s, si Sot-i me të gjitha leximet e tij.
    const write = store.writeDevice.bind(store)
    store.writeDevice = async (key, value) => {
      await new Promise((resolve) => setTimeout(resolve, 1500))
      return write(key, value)
    }
    await renderCard()
    await userEvent.click(await screen.findByRole('button', { name: 'Si ndihesh?, e re' }))
    await userEvent.click(await screen.findByRole('button', level('E mirë', 4)))
    // Menjëherë, pa waitFor: pyetja tjetër është në ekran dhe shiriti i dytë.
    expect(heading('Sa energji ke?')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', 'Story 2 nga 5: Energjia')
    await userEvent.click(screen.getByRole('button', level('Normale', 3)))
    expect(heading('Si fjete?')).toBeInTheDocument()
    // Shkrimet e vonuara mbarojnë para provës tjetër (ekrani i provës lexon store-in e provës së radhës).
    const { readCheckInDraft } = await import('@/data/checkin-draft')
    await waitFor(async () => expect(await readCheckInDraft(store, '2026-11-08')).toEqual({ mood: 4, energy: 3 }), { timeout: 20_000 })
    store.writeDevice = write
  })

  it('gjendje e plotësuar pjesërisht: mbyllja e ruan, rrethi mbetet, dhe hapet te pyetja e parë pa përgjigje', async () => {
    const store = await setup()
    await renderCard()
    await userEvent.click(await screen.findByRole('button', { name: 'Si ndihesh?, e re' }))
    await userEvent.click(await screen.findByRole('button', level('E mirë', 4)))
    await userEvent.click(screen.getByRole('button', level('Shumë e lartë', 5)))
    expect(heading('Si fjete?')).toBeInTheDocument()
    await close()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await stored()).toBeNull()
    const { readCheckInDraft } = await import('@/data/checkin-draft')
    await waitFor(async () => expect(await readCheckInDraft(store, '2026-11-08')).toEqual({ mood: 4, energy: 5 }))
    // Rrethi mbetet (gjendja s'është plotësuar), por unaza është gri sepse story u mbyll.
    await userEvent.click(await screen.findByRole('button', { name: 'Si ndihesh?' }))
    expect(await screen.findByRole('heading', { name: 'Si fjete?' })).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', 'Story 3 nga 5: Gjumi')
    // Butoni mbrapa kthen te pyetja e mëparshme me përgjigjen e ruajtur.
    await userEvent.click(screen.getByRole('button', { name: 'Story i mëparshëm' }))
    expect(heading('Sa energji ke?')).toBeInTheDocument()
    expect(screen.getByRole('button', { ...level('Shumë e lartë', 5), pressed: true })).toBeInTheDocument()
  })

  it('gjumi: vlera nga profili, hapi 0,5 orë, cilësia; dhimbje "Asnjë" ruan dhe kalon pa "Tjetra"', async () => {
    await setup()
    await renderCard()
    await userEvent.click(await screen.findByRole('button', { name: 'Si ndihesh?, e re' }))
    await userEvent.click(await screen.findByRole('button', level('Normale', 3)))
    await userEvent.click(screen.getByRole('button', level('Normale', 3)))
    expect(screen.getByText('6 orë')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Rrit gjumin me gjysmë ore' }))
    expect(screen.getByText('6,5 orë')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Mirë' }))
    await userEvent.click(screen.getByRole('button', { name: 'Tjetra' }))
    expect(heading('A të dhemb diçka?')).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Grupet me dhimbje' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', level('Asnjë', 1)))
    expect(await screen.findByText(/^\d+%$/)).toBeInTheDocument()
    await waitFor(async () => expect(await stored()).toMatchObject({ sleepMinutes: 390, sleepQuality: 4, soreness: 0, soreGroups: [] }))
  })

  it('"Gati N%" hap story-n e 5-të, ditë stërvitjeje me gatishmëri të ulët: sugjerimi, dhe "Seanca më e lehtë" ruan vendimin dhe mbyll', async () => {
    const store = await setup()
    const { readinessOfState, saveDailyState, readDailyChoice } = await import('@/data/daily-state')
    const { checkInContext } = await import('@/data/readiness-view')
    const { todayView } = await import('@/data/today')
    await saveDailyState(store, '2026-11-08', ANSWERS, checkInContext(await todayView(store), ANSWERS))
    const before = readinessOfState((await stored())!)
    expect(before.level).toBe('low')
    await renderCard()
    await userEvent.click(await screen.findByRole('button', { name: /^Gati \d+%/ }))
    const story = await screen.findByRole('dialog', { name: 'Si ndihesh sot?' })
    expect(within(story).getByRole('region', { name: new RegExp(`${before.percent} për qind`) })).toBeInTheDocument()
    expect(within(story).getByText(/Dëgjo trupin sot\./)).toBeInTheDocument()
    expect(within(story).getByText(/^Stërvitja: .* ushtrim/)).toBeInTheDocument()
    expect(await within(story).findByRole('button', { name: 'Shtyje për nesër' })).toBeInTheDocument()
    await userEvent.click(await within(story).findByRole('button', { name: /^Seanca më e lehtë/ }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect((await readDailyChoice(store, '2026-11-08'))?.choice).toBe('lighter')
  })

  it('ndryshimi i një përgjigjeje pas plotësimit: ← kthen mbrapa, zgjedhja ruan rreshtin dhe kalon', async () => {
    const store = await setup()
    const { saveDailyState } = await import('@/data/daily-state')
    const { checkInContext } = await import('@/data/readiness-view')
    const { todayView } = await import('@/data/today')
    await saveDailyState(store, '2026-11-08', ANSWERS, checkInContext(await todayView(store), ANSWERS))
    await renderCard()
    await userEvent.click(await screen.findByRole('button', { name: /^Gati \d+%/ }))
    const story = await screen.findByRole('dialog')
    for (let step = 0; step < 4; step++) fireEvent.keyDown(story, { key: 'ArrowLeft' })
    expect(heading('Si është gjendja jote sot?')).toBeInTheDocument()
    expect(screen.getByRole('button', { ...level('Normale', 3), pressed: true })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', level('Shkëlqyer', 5)))
    expect(heading('Sa energji ke?')).toBeInTheDocument()
    await waitFor(async () => expect(await stored()).toMatchObject({ mood: 5, energy: 2, soreGroups: ['gjoksi'] }))
  })

  it('ditë pushimi: story i 5-të ka 4 pjesë, pa rikuperim', async () => {
    const store = await setup(at(11, 11))
    const { saveDailyState } = await import('@/data/daily-state')
    await saveDailyState(store, '2026-11-11', { ...ANSWERS, soreness: 0, soreGroups: [] })
    await renderCard()
    await userEvent.click(await screen.findByRole('button', { name: /^Gati \d+%/ }))
    const story = await screen.findByRole('dialog')
    const parts = within(within(story).getByRole('region', { name: 'Nga çfarë del' })).getAllByRole('listitem')
    expect(parts).toHaveLength(4)
    expect(within(story).queryByText('Rikuperimi')).not.toBeInTheDocument()
  })

  it('"Si ndihesh?" i hapur nga rikujtuesi (/?fleta=gjendja) fillon te pyetja e parë pa përgjigje', async () => {
    const store = await setup()
    const { saveCheckInAnswers } = await import('@/data/checkin-draft')
    await saveCheckInAnswers(store, '2026-11-08', { mood: 3, energy: 3 }, () => ({ recovery: null, soreTrained: false }))
    await renderCard('/?fleta=gjendja')
    expect(await screen.findByRole('heading', { name: 'Si fjete?' })).toBeInTheDocument()
  })

  it('anglishtja: rrathët, pyetjet, gjumi, dhimbjet dhe story i 5-të', async () => {
    await setup()
    await act(() => language.set('en'))
    await renderCard()
    await userEvent.click(await screen.findByRole('button', { name: 'How are you?, new' }))
    expect(await screen.findByRole('dialog', { name: 'How are you feeling today?' })).toBeInTheDocument()
    await userEvent.click(await screen.findByRole('button', { name: 'Normal, level 3 of 5' }))
    expect(heading('How much energy do you have?')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Low, level 2 of 5' }))
    expect(heading('How did you sleep?')).toBeInTheDocument()
    expect(screen.getByText('6 hours')).toBeInTheDocument()
    expect(screen.getByText('from your bedtime and wake-up time')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    await userEvent.click(screen.getByRole('button', { name: 'Slight, level 2 of 5' }))
    expect(screen.getByRole('button', { name: 'Legs' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(await screen.findByText('What it is made of')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', 'Story 5 of 5: Readiness')
    await close()
    expect(await screen.findByRole('button', { name: /^Ready \d+%/ })).toBeInTheDocument()
    await waitFor(async () => expect((await stored())?.soreness).toBe(1))
  })
})
