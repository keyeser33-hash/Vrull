import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { LocalStore } from '@/data/store'
import { language } from '@/i18n/language'

// Matësit e drejtpërdrejtë te Sot (V57, SPEC §0.3f; bordi "Sot", "Sot · Uji"): kalori, proteina me segment për vakt dhe uji
// me prekje (250 ml, "Zhbëj") dhe shtypje të gjatë (250, 330, 500 ml, "Sasi tjetër"). Sot është e diela 8 nëntor 2026, 10:00.
const data = vi.hoisted(() => ({ store: null as unknown as LocalStore, clock: new Date(2026, 10, 8, 10, 0) }))

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
const PROFILE = { weightKg: 80, trainingDays: [7, 1, 2, 4], trainingTime: '17:15', wakeTime: '07:00', sleepTime: '23:00' }

async function setup() {
  const { createDatabase } = await import('@/data/db')
  const { createLocalStore } = await import('@/data/store')
  data.clock = at(25, 10, 9)
  data.store = createLocalStore(createDatabase(`today-meters-${crypto.randomUUID()}`), { userId: () => USER, now: () => data.clock })
  const { completeOnboarding } = await import('@/data/profile')
  await completeOnboarding(data.store, PROFILE, () => data.clock)
  data.clock = at(8, 11)
  return data.store
}

async function renderMeters() {
  const { useLocalQuery, store } = await import('@/data/app-data')
  const { todayView } = await import('@/data/today')
  const { TodayMeters } = await import('./today-meters')
  function Host() {
    const view = useLocalQuery(() => todayView(store), [])
    return view ? <TodayMeters view={view} /> : null
  }
  const router = createMemoryRouter(
    [
      { path: '/', element: <Host /> },
      { path: '/ushqimi', element: <h1>Ushqimi</h1> },
    ],
    { initialEntries: ['/'] },
  )
  render(<RouterProvider router={router} />)
  return router
}

const waterButton = () => screen.findByRole('button', { name: /litra\. Shto 250 ml ujë/ })
async function waterMl() {
  const { waterDay } = await import('@/data/water')
  return (await waterDay(data.store, '2026-11-08')).totalMl
}

describe('matësit e drejtpërdrejtë te Sot', () => {
  afterEach(async () => {
    cleanup()
    await act(() => language.set('sq'))
  })

  it('kaloritë dhe proteina: çfarë mbetet, ngrënë / objektiv, një segment për vakt; të dyja hapin Ushqimin', async () => {
    const store = await setup()
    await store.put('diary_entries', { date: '2026-11-08', meal: 'breakfast_1', food_id: null, grams: 100, kcal: 400, protein_g: 38, carbs_g: 30, fat_g: 10, logged_at: at(8, 11, 8).toISOString() })
    const router = await renderMeters()
    const calories = await screen.findByRole('link', { name: /^Kalori: 400 nga [\d\s]+\. Hap ushqimin$/ })
    expect(calories).toHaveAttribute('href', '/ushqimi')
    expect(calories).toHaveTextContent(/^Kalori[\d\s]+kcal mbeten400 \/ [\d\s]+$/)
    const protein = screen.getByRole('link', { name: /^Proteina: 38 nga \d+ g\. Hap ushqimin$/ })
    expect(protein).toHaveTextContent(/^Proteina38 g \/ \d+ g1 nga \d+ vakte$/)
    // Një segment për çdo vakt të orarit.
    const { todayView } = await import('@/data/today')
    const meals = (await todayView(store)).meals
    expect(protein.querySelectorAll('.h-1')).toHaveLength(meals.length)
    expect(protein.querySelectorAll('.bg-foreground')).toHaveLength(1)
    await userEvent.click(protein)
    await waitFor(() => expect(router.state.location.pathname).toBe('/ushqimi'))
  })

  it('uji: një prekje shton 250 ml, njoftimi "U shtua 250 ml" dhe "Zhbëj" e heq', async () => {
    const user = userEvent.setup()
    await setup()
    await renderMeters()
    const button = await waterButton()
    expect(button).toHaveAccessibleName(/^0,0 nga \d,\d+ litra\. Shto 250 ml ujë\. Mbaje shtypur për sasi të tjera$/)
    expect(button).toHaveTextContent(/^Uji0,0 L \/ \d,\d+\+250\sml$/)
    await user.click(button)
    expect(await screen.findByRole('status')).toHaveTextContent('U shtua 250 ml')
    await waitFor(() => expect(button).toHaveTextContent(/^Uji0,25 L/))
    expect(await waterMl()).toBe(250)
    await user.click(screen.getByRole('button', { name: 'Zhbëj' }))
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
    expect(await waterMl()).toBe(0)
    await waitFor(() => expect(button).toHaveTextContent(/^Uji0,0 L/))
  })

  it('uji: prekja shfaqet menjëherë, edhe kur shkrimi në bazë vonon; një prekje e dytë mbledh mbi të', async () => {
    const user = userEvent.setup()
    const store = await setup()
    await renderMeters()
    const button = await waterButton()
    // Shkrimi i ujit nuk mbaron (si kur të gjitha leximet e Sot rinisen pas një shkrimi).
    const put = store.put.bind(store)
    store.put = ((table, values) => (table === 'water_logs' ? new Promise(() => {}) : put(table, values))) as LocalStore['put']
    await user.click(button)
    expect(button).toHaveTextContent(/^Uji0,25 L/)
    expect(button).toHaveAccessibleName(/^0,25 nga /)
    await user.click(button)
    expect(button).toHaveTextContent(/^Uji0,5 L/)
    expect(await waterMl()).toBe(0)
  })

  it('uji: shtypja e gjatë hap 250, 330, 500 ml dhe "Sasi tjetër"; 330 ml shtohet dhe fleta mbyllet', async () => {
    const user = userEvent.setup()
    await setup()
    const router = await renderMeters()
    const button = await waterButton()
    fireEvent.pointerDown(button, { pointerId: 1, clientX: 20, clientY: 20, button: 0 })
    const menu = await screen.findByRole('dialog', { name: 'Sa ujë shton?', hidden: false }, { timeout: 1500 })
    expect(within(menu).getAllByRole('button').map((item) => item.textContent?.replace(/\s/g, ' '))).toEqual(expect.arrayContaining(['250 ml', '330 ml', '500 ml', 'Sasi tjetër']))
    expect(router.state.location.search).toBe('?fleta=uji')
    fireEvent.pointerUp(button, { pointerId: 1 })
    fireEvent.click(button)
    expect(await waterMl()).toBe(0)
    await user.click(within(menu).getByRole('button', { name: /^330\sml$/ }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await waterMl()).toBe(330)
    expect(await screen.findByRole('status')).toHaveTextContent('U shtua 330 ml')
  })

  it('uji: "Sasi tjetër" pranon vetëm 50–2000 ml', async () => {
    const user = userEvent.setup()
    await setup()
    await renderMeters()
    fireEvent.contextMenu(await waterButton())
    await user.click(await screen.findByRole('button', { name: 'Sasi tjetër' }))
    const sheet = await screen.findByRole('dialog', { name: 'Sasi tjetër' })
    const add = within(sheet).getByRole('button', { name: 'Shto' })
    expect(add).toBeDisabled()
    expect(within(sheet).getByText('Shkruaj një sasi nga 50 deri në 2 000 ml.')).toBeInTheDocument()
    await user.type(within(sheet).getByRole('textbox', { name: 'Sasia në ml' }), '20')
    expect(add).toBeDisabled()
    await user.clear(within(sheet).getByRole('textbox', { name: 'Sasia në ml' }))
    await user.type(within(sheet).getByRole('textbox', { name: 'Sasia në ml' }), '400')
    expect(add).toBeEnabled()
    await user.click(add)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await waterMl()).toBe(400)
  })

  it('anglisht: tekstet, litrat me pikë dhe njoftimi', async () => {
    const user = userEvent.setup()
    await setup()
    await act(() => language.set('en'))
    await renderMeters()
    const button = await screen.findByRole('button', { name: /litres\. Add 250 ml of water/ })
    expect(button).toHaveTextContent(/^Water0\.0 L \/ \d\.\d+\+250\sml$/)
    await user.click(button)
    expect(await screen.findByRole('status')).toHaveTextContent('Added 250 ml')
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^Calories: 0 of [\d,]+\. Open food$/ })).toHaveTextContent('kcal left')
    expect(screen.getByRole('link', { name: /^Protein: 0 of \d+ g\. Open food$/ })).toHaveTextContent(/0 of \d+ meals$/)
  })
})
