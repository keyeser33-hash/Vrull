import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { LocalStore } from '@/data/store'
import { language } from '@/i18n'

// Ushqimi › Plani im (V34, V2-E2-05): e hënë 7 dhjetor, ditë stërvitjeje; 88 kg, ulur, shtim, që
// objektivat janë 2 930 kcal dhe 176 g proteinë.
const data = vi.hoisted(() => ({ store: null as unknown as LocalStore }))
vi.mock('@/data/app-data', async () => {
  const { createDatabase } = await import('@/data/db')
  const { createLocalStore } = await import('@/data/store')
  const store = createLocalStore(createDatabase(`plan-ui-${crypto.randomUUID()}`), { userId: () => '11111111-1111-4111-8111-111111111111' })
  data.store = store
  return { store, useLocalQuery: (await import('@/test/local-query')).useLocalQueryFor(store) }
})

describe('Plani im', () => {
  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-12-07T10:00:00'))
    await import('@/data/app-data')
    const { completeOnboarding } = await import('@/data/profile')
    const { EMPTY_TARGETS_PROFILE, saveTargetsProfile } = await import('@/data/targets-profile')
    await completeOnboarding(data.store, { weightKg: 88, trainingDays: [1, 2, 4, 5], trainingTime: '21:00', wakeTime: '08:20', sleepTime: '01:00' })
    await saveTargetsProfile(data.store, { ...EMPTY_TARGETS_PROFILE, sex: 'male', heightCm: 185, activity: 'sedentary', goal: 'gain' }, '2026-12-01')
    await data.store.put('foods', { source: 'custom', name: 'Gjoks pule', kcal: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6 })
  })
  afterAll(() => vi.useRealTimers())
  afterEach(async () => {
    language.set('sq')
    const { resetMyPlan } = await import('@/data/my-plan')
    await resetMyPlan(data.store, 'training')
    await resetMyPlan(data.store, 'rest')
  })

  async function renderPage() {
    const { MyPlanPage } = await import('./my-plan')
    const router = createMemoryRouter(
      [
        { path: '/ushqimi', element: <p>Ushqimi</p> },
        { path: '/ushqimi/plani', element: <MyPlanPage /> },
      ],
      { initialEntries: ['/ushqimi', '/ushqimi/plani'], initialIndex: 1 },
    )
    render(<RouterProvider router={router} />)
    return router
  }
  const meals = () => screen.getByRole('list', { name: 'Vaktet e ditës' })
  const lunchRow = () => within(meals()).getByRole('button', { name: /Dreka/ })

  it('dita e stërvitjes bie te objektivat; dreka ndryshon porcionin dhe plani bëhet yti', async () => {
    const user = userEvent.setup()
    await renderPage()
    expect(await screen.findByText('nga 2 930 kcal')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Ditë stërvitjeje' })).toBeChecked()
    expect(screen.getByText('Brenda objektivave')).toBeInTheDocument()
    expect(within(meals()).getAllByRole('listitem')).toHaveLength(9)
    expect(screen.queryByRole('button', { name: 'Kthe planin e Jimit' })).not.toBeInTheDocument()

    await user.click(lunchRow())
    const sheet = screen.getByRole('dialog', { name: 'Dreka' })
    expect(within(sheet).getByText('14:20 · Ditë stërvitjeje')).toBeInTheDocument()
    const save = within(sheet).getByRole('button', { name: 'Ruaj vaktin' })
    expect(save).toBeDisabled()
    const portion = within(sheet).getByRole('group', { name: 'Porcioni: ton albacore në ujë' })
    const before = within(portion).getByText(/kanoçe/).textContent
    await user.click(within(portion).getByRole('button', { name: 'Më shumë ton albacore në ujë' }))
    expect(within(portion).getByText(/kanoçe/).textContent).not.toBe(before)
    expect(within(sheet).getByText(/^Dita me këtë: .* nga 2 930 kcal/)).toBeInTheDocument()
    await user.click(save)

    await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await screen.findByText(/^Plani yt\./)).toBeInTheDocument()
    const rows = await data.store.all('meal_templates')
    expect(rows.filter((row) => row.day_type === 'training')).toHaveLength(9)
    expect(rows.filter((row) => row.day_type === 'rest')).toHaveLength(0)

    await user.click(screen.getByRole('button', { name: 'Kthe planin e Jimit' }))
    await user.click(screen.getByRole('button', { name: 'Po, ktheje' }))
    expect(await screen.findByText(/^Nga plani i Jimit, me porcionet/)).toBeInTheDocument()
    expect(await data.store.all('meal_templates')).toHaveLength(0)
  })

  it('ndërrimi i tonit me salmon mban proteinën; "Shto ushqim" shton një ushqim tëndin', async () => {
    const user = userEvent.setup()
    await renderPage()
    await user.click(await screen.findByRole('button', { name: /Dreka/ }))
    await user.click(screen.getByRole('button', { name: 'Ndërro' }))

    const swap = screen.getByRole('dialog', { name: 'Ndërro ton albacore në ujë' })
    expect(within(swap).getByText(/^Porcioni përshtatet që proteina të mbetet e njëjtë/)).toBeInTheDocument()
    const confirm = within(swap).getByRole('button', { name: 'Ndërro' })
    expect(confirm).toBeDisabled()
    await user.click(within(swap).getByRole('button', { name: /^Salmon · \d+\s?g/ }))
    await user.click(within(swap).getByRole('button', { name: 'Ndërro me salmon' }))

    const sheet = screen.getByRole('dialog', { name: 'Dreka' })
    expect(within(sheet).getByRole('group', { name: 'Porcioni: salmon' })).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Shto ushqim' }))
    const add = screen.getByRole('dialog', { name: 'Shto ushqim' })
    await user.type(within(add).getByRole('searchbox', { name: 'Kërko ushqim tjetër' }), 'pule')
    await user.click(await within(add).findByRole('button', { name: /^Gjoks pule · 100\s?g/ }))
    await user.click(within(add).getByRole('button', { name: 'Shto gjoks pule' }))

    const updated = screen.getByRole('dialog', { name: 'Dreka' })
    expect(within(updated).getByRole('group', { name: 'Porcioni: gjoks pule' })).toBeInTheDocument()
    await user.click(within(updated).getByRole('button', { name: 'Ruaj vaktin' }))
    expect(await within(meals()).findByText(/^Salmon \d+\s?g, bukë integrale .*, gjoks pule 100\s?g$/)).toBeInTheDocument()
  })

  it('dita e pushimit ka shtatë vakte, pa vaktet e stërvitjes', async () => {
    const user = userEvent.setup()
    await renderPage()
    await user.click(await screen.findByRole('radio', { name: 'Ditë pushimi' }))
    expect(await screen.findByText('nga 2 630 kcal')).toBeInTheDocument()
    expect(within(meals()).getAllByRole('listitem')).toHaveLength(7)
    expect(within(meals()).queryByText('Para stërvitjes')).not.toBeInTheDocument()
  })

  it('në anglisht', async () => {
    language.set('en')
    await renderPage()
    expect(await screen.findByText('of 2,930 kcal')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'My plan' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Training day' })).toBeChecked()
    expect(screen.getByText('Within your targets')).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Meals of the day' })).getByRole('button', { name: /Lunch/ })).toBeInTheDocument()
  })
})
