import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { LocalStore } from '@/data/store'
import { language } from '@/i18n'

// Fleta e vaktit (V2-E2-16, V59; bordet V22-Makrot, V42-Ushqimi-Vakti): "Si në plan", "Si dje" me "Zhbëj", makrot e
// shpejta, Foto. Të fundit dhe të preferuarat kalojnë te faqja e kërkimit (V2-E3-28b). E mërkura 9 dhjetor, 12:40; dje (e marta) dreka kishte pulë me oriz.
const data = vi.hoisted(() => ({ store: null as unknown as LocalStore }))
vi.mock('@/data/app-data', async () => {
  const { createDatabase } = await import('@/data/db')
  const { createLocalStore } = await import('@/data/store')
  const store = createLocalStore(createDatabase(`meal-quick-${crypto.randomUUID()}`), { userId: () => '11111111-1111-4111-8111-111111111111' })
  data.store = store
  return { store, useLocalQuery: (await import('@/test/local-query')).useLocalQueryFor(store) }
})

const TODAY = '2026-12-09'
const lunchEntries = async () => (await data.store.where('diary_entries', 'date', TODAY)).filter((row) => row.meal === 'lunch')

describe('Vakti i shpejtë', () => {
  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-12-09T12:40:00'))
    await import('@/data/app-data')
    const { completeOnboarding } = await import('@/data/profile')
    await completeOnboarding(data.store, { weightKg: 80, trainingDays: [1, 2, 4, 5], trainingTime: '18:00', wakeTime: '07:00', sleepTime: '23:00' })
    const { createCustomFood } = await import('@/data/foods')
    const { logFood } = await import('@/data/nutrition')
    const chicken = await createCustomFood(data.store, { name: 'Gjoks pule', kcal: 120, proteinG: 22.5, carbsG: 0, fatG: 2.6 })
    const rice = await createCustomFood(data.store, { name: 'Oriz kaf', kcal: 123, proteinG: 2.7, carbsG: 25.6, fatG: 1 })
    await logFood(data.store, { date: '2026-12-08', meal: 'lunch', foodId: chicken, grams: 200 })
    await logFood(data.store, { date: '2026-12-08', meal: 'lunch', foodId: rice, grams: 250 })
  })
  afterAll(() => vi.useRealTimers())
  beforeEach(async () => {
    for (const row of await data.store.where('diary_entries', 'date', TODAY)) await data.store.remove('diary_entries', row.id)
  })
  afterEach(() => language.set('sq'))

  async function openLunch() {
    const { NutritionPage } = await import('./nutrition')
    const router = createMemoryRouter(
      [
        { path: '/ushqimi', element: <NutritionPage /> },
        { path: '/ushqimi/shto/:meal', element: <h1>Shto ushqim</h1> },
      ],
      { initialEntries: ['/ushqimi', '/ushqimi?vakti=lunch'], initialIndex: 1 },
    )
    render(<RouterProvider router={router} />)
    return screen.findByRole('dialog', { name: /^(Dreka|Lunch) · / })
  }

  it('"Si në plan" është veprimi kryesor; "Si dje" e kopjon vaktin e djeshëm me një prekje dhe "Zhbëj" e heq', async () => {
    const user = userEvent.setup()
    const sheet = await openLunch()
    const plan = within(sheet).getByRole('button', { name: /^Si në plan/ })
    expect(plan.className).toContain('bg-ember')
    expect(within(sheet).getAllByRole('button').filter((button) => button.className.includes('bg-ember'))).toHaveLength(1)
    const yesterday = within(sheet).getByRole('button', { name: 'Si dje' })
    await waitFor(() => expect(yesterday).toBeEnabled())
    await user.click(yesterday)
    await waitFor(async () => expect((await lunchEntries()).map((row) => Number(row.grams)).sort()).toEqual([200, 250]))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    const toast = await screen.findByRole('status')
    expect(toast).toHaveTextContent('U shtua te Dreka · 548 kcalZhbëj')
    await user.click(within(toast).getByRole('button', { name: 'Zhbëj' }))
    await waitFor(async () => expect(await lunchEntries()).toHaveLength(0))
  })

  it('makrot e shpejta: kaloritë e shkruara ruhen dhe rreshti e thotë diferencën', async () => {
    const user = userEvent.setup()
    const sheet = await openLunch()
    await user.click(within(sheet).getByRole('button', { name: 'Makrot' }))
    const macros = await screen.findByRole('dialog', { name: 'Makrot e shpejta' })
    const save = within(macros).getByRole('button', { name: 'Ruaj te Dreka' })
    expect(save).toBeDisabled()
    await user.type(within(macros).getByLabelText(/^Emri/), 'Drekë jashtë')
    await user.type(within(macros).getByLabelText('Kalori'), '650')
    await user.type(within(macros).getByLabelText('Proteina'), '40')
    await user.type(within(macros).getByLabelText('Karbohidrate'), '60')
    await user.type(within(macros).getByLabelText('Yndyrë'), '25')
    expect(within(macros).getByRole('status')).toHaveTextContent('Nga makrot dalin 625 kcal (4 × 40 + 4 × 60 + 9 × 25); ti shkrove 650. Ruhet 650.')
    await user.click(save)
    await waitFor(async () => expect((await lunchEntries()).map((row) => [Number(row.kcal), row.grams ?? null, Number(row.servings)])).toEqual([[650, null, 1]]))
    expect(await within(await screen.findByRole('dialog', { name: /^Dreka · / })).findByText('Drekë jashtë')).toBeInTheDocument()
  })

  it('kufiri i AI-së i arritur: Foto e çaktivizuar te vakti, kutia te Sot e thotë; makrot mbeten', async () => {
    const usage = await data.store.put('ai_usage', { month: '2026-12-01', feature: 'food_text', model: 'claude-haiku-5-5', input_tokens: 400, output_tokens: 600, cost_usd: 11.165, cost_eur: 10 })
    try {
      const sheet = await openLunch()
      await waitFor(() => expect(within(sheet).getByRole('button', { name: 'Foto' })).toBeDisabled())
      expect(within(sheet).getByRole('button', { name: 'Makrot' })).toBeEnabled()
      cleanup()
      const { AiBoxDock } = await import('./ai-box-dock')
      render(<RouterProvider router={createMemoryRouter([{ path: '/', element: <AiBoxDock /> }])} />)
      expect(await screen.findByText('Kufiri i AI-së u arrit; rinis më 1 janar')).toBeInTheDocument()
    } finally {
      await data.store.remove('ai_usage', usage.id)
    }
  })

  it('anglisht', async () => {
    language.set('en')
    const sheet = await openLunch()
    expect(within(sheet).getByRole('button', { name: /^As planned/ })).toBeInTheDocument()
    expect(within(sheet).getByRole('button', { name: 'Like yesterday' })).toBeInTheDocument()
    expect(within(sheet).getByRole('link', { name: 'Add food' })).toHaveAttribute('href', '/ushqimi/shto/lunch')
  })
})
