import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { LocalStore } from '@/data/store'
import { language } from '@/i18n'

// Ushqimi › Objektivat (V2-E2-03) me store të vërtetë: 88 kg, katër seanca në javë, e mërkurë.
// Testing Library e kthen hapësirën që nuk thyhet (2 930) në hapësirë të zakonshme.
const data = vi.hoisted(() => ({ store: null as unknown as LocalStore }))
vi.mock('@/data/app-data', async () => {
  const { createDatabase } = await import('@/data/db')
  const { createLocalStore } = await import('@/data/store')
  const store = createLocalStore(createDatabase(`targets-ui-${crypto.randomUUID()}`), { userId: () => '11111111-1111-4111-8111-111111111111' })
  data.store = store
  return {
    store,
    useLocalQuery: (await import('@/test/local-query')).useLocalQueryFor(store),
  }
})

describe('Objektivat', () => {
  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-12-09T12:40:00'))
    await import('@/data/app-data')
    const { completeOnboarding } = await import('@/data/profile')
    await completeOnboarding(data.store, { weightKg: 88, trainingDays: [1, 2, 4, 5], trainingTime: '21:00', wakeTime: '08:20', sleepTime: '01:00' })
  })
  afterAll(() => vi.useRealTimers())
  afterEach(() => language.set('sq'))

  async function renderPage() {
    const { TargetsPage } = await import('./nutrition-targets')
    const router = createMemoryRouter(
      [
        { path: '/ushqimi', element: <p>Ushqimi</p> },
        { path: '/ushqimi/objektivat', element: <TargetsPage /> },
      ],
      { initialEntries: ['/ushqimi', '/ushqimi/objektivat'], initialIndex: 1 },
    )
    render(<RouterProvider router={router} />)
    return router
  }

  // Profili i provës së parë, që provat e tjera të mos varen prej saj.
  async function savedOwner() {
    const { EMPTY_TARGETS_PROFILE, saveTargetsProfile } = await import('@/data/targets-profile')
    await saveTargetsProfile(data.store, { ...EMPTY_TARGETS_PROFILE, sex: 'male', heightCm: 185, activity: 'sedentary', goal: 'gain' }, '2026-12-09')
  }

  async function fillOwner(user: ReturnType<typeof userEvent.setup>, names: { male: string; height: string; up: string; activity: string }) {
    await user.click(await screen.findByRole('radio', { name: names.male }))
    await user.click(screen.getByRole('button', { name: names.height }))
    for (let step = 0; step < 10; step++) await user.click(screen.getByRole('button', { name: names.up }))
    await user.click(screen.getByRole('radio', { name: new RegExp(`^${names.activity}`) }))
  }

  it('nga zgjedhjet te numrat e Shtojcës C, pastaj ruhen nga sot', async () => {
    const user = userEvent.setup()
    const router = await renderPage()
    expect(await screen.findByText('Zgjidh gjininë, gjatësinë dhe aktivitetin që të dalin objektivat e tua.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ruaj objektivat' })).toBeDisabled()

    await fillOwner(user, { male: 'Burrë', height: 'Shto gjatësinë', up: 'Rrit gjatësinë me 1 cm', activity: 'Ulur' })
    expect(screen.getByText('185 cm')).toBeInTheDocument()
    const card = screen.getByRole('region', { name: 'Objektivat' })
    expect(within(card).getByText('2 930')).toBeInTheDocument()
    expect(within(card).getByText('2 630')).toBeInTheDocument()
    expect(within(card).getByRole('row', { name: /^Karbohidratet 379\s+g 304\s+g$/ })).toBeInTheDocument()
    expect(screen.getByText('Masë muskulore · +0,25% në javë')).toBeInTheDocument()
    const how = screen.getByRole('region', { name: 'Si u llogarit' })
    expect(within(how).getByText('Mirëmbajtja, me "Ulur" ×1,3')).toBeInTheDocument()
    expect(within(how).getByText('2 460')).toBeInTheDocument()
    expect(within(how).getByText('+170')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Ruaj objektivat' }))
    expect(await screen.findByText('Ushqimi')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/ushqimi')
    const { readTargetsProfile } = await import('@/data/targets-profile')
    expect(await readTargetsProfile(data.store)).toMatchObject({ sex: 'male', heightCm: 185, activity: 'sedentary', goal: 'gain', from: '2026-12-09' })
    const { nutritionDay } = await import('@/data/nutrition')
    expect((await nutritionDay(data.store, '2026-12-09', new Date())).targets).toEqual({ kcal: 2630, proteinG: 176, carbsG: 304, fatG: 79 })
  })

  it('yndyra me metër: 20% dhe objektivat me masën pa yndyrë', async () => {
    const user = userEvent.setup()
    await savedOwner()
    await renderPage()
    await user.click(await screen.findByRole('button', { name: /^Di yndyrën time/ }))
    const sheet = await screen.findByRole('dialog', { name: 'Yndyra e trupit' })
    await user.type(within(sheet).getByLabelText('Qafa, cm'), '40')
    await user.type(within(sheet).getByLabelText('Beli, te kërthiza, cm'), '85')
    expect(within(sheet).getByText('20% yndyrë')).toBeInTheDocument()
    expect(within(sheet).getByText('Me këtë: stërvitje 3 140, pushim 2 840 kcal')).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Përdor 20%' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Objektivat' })).getByText('3 140')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Di yndyrën time/ })).toHaveTextContent('20%')
  })

  it('në anglisht', async () => {
    language.set('en')
    await savedOwner()
    await renderPage()
    const card = await screen.findByRole('region', { name: 'Targets' })
    expect(screen.getByRole('heading', { level: 1, name: 'Targets' })).toBeInTheDocument()
    expect(within(card).getByText('2,930')).toBeInTheDocument()
    expect(screen.getByText('Muscle gain · +0.25% a week')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /^Sitting/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('button', { name: 'Save targets' })).toBeEnabled()
  })
})
