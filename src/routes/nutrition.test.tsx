import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { LocalStore } from '@/data/store'
import { language } from '@/i18n'

// Ushqimi me store të vërtetë, të mërkurën në 12:40 (ditë pushimi, 80 kg). Testing Library e kthen
// hapësirën që nuk thyhet (3 037 kcal) në hapësirë të zakonshme para krahasimit.
const data = vi.hoisted(() => ({ store: null as unknown as LocalStore }))
vi.mock('@/data/app-data', async () => {
  const { createDatabase } = await import('@/data/db')
  const { createLocalStore } = await import('@/data/store')
  const store = createLocalStore(createDatabase(`nutrition-ui-${crypto.randomUUID()}`), { userId: () => '11111111-1111-4111-8111-111111111111' })
  data.store = store
  return {
    store,
    useLocalQuery: (await import('@/test/local-query')).useLocalQueryFor(store),
  }
})

describe('Ushqimi', () => {
  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-12-09T12:40:00'))
    await import('@/data/app-data')
    const { completeOnboarding } = await import('@/data/profile')
    await completeOnboarding(data.store, { weightKg: 80, trainingDays: [1, 2, 4, 5], trainingTime: '18:00', wakeTime: '07:00', sleepTime: '23:00' })
    const { ensureSupplements } = await import('@/data/supplements')
    await ensureSupplements(data.store)
  })
  afterAll(() => vi.useRealTimers())
  afterEach(() => language.set('sq'))

  async function renderPage() {
    const { NutritionPage } = await import('./nutrition')
    const router = createMemoryRouter([{ path: '/ushqimi', element: <NutritionPage /> }], { initialEntries: ['/ushqimi'] })
    render(<RouterProvider router={router} />)
    return router
  }

  it('vakti i radhës me planin e Jimit; regjistrimi me një prekje; dita si orar', async () => {
    const user = userEvent.setup()
    await renderPage()
    const panel = (await screen.findByRole('heading', { level: 2, name: 'Dreka' })).closest('section')!
    expect(screen.getByText('ditë pushimi')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Kalori të ditës' }).parentElement).toHaveTextContent('0 / 3 037 kcal')
    expect(within(panel).getByText('13:00 · pas 20 min')).toBeInTheDocument()
    expect(within(panel).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Ton albacore në ujë1 kanoçe',
      'Bukë integrale2 feta',
      'Majonezë light1 lugë gjelle',
      'Mollë1 e madhe',
    ])
    expect(within(panel).getByText('rreth 495 kcal')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Snack paradite, 10:30, Pa regjistruar' })).toBeInTheDocument()

    await user.click(within(panel).getByRole('button', { name: 'Regjistro drekën' }))
    expect(await screen.findByRole('heading', { level: 2, name: 'Snack pasdite' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dreka, 13:00, Regjistruar · 495 kcal' })).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Kalori të ditës' }).parentElement).toHaveTextContent('495 / 3 037 kcal')
    expect(screen.getByText('Proteina').parentElement).toHaveTextContent('42 / 260 g')
  })

  it('vakti hapet në fletë; një artikull hiqet; lloji i ditës ndërrohet me një prekje', async () => {
    const user = userEvent.setup()
    await renderPage()
    await user.click(await screen.findByRole('button', { name: /^Dreka, 13:00, Regjistruar/ }))
    const sheet = screen.getByRole('dialog', { name: 'Dreka · 13:00' })
    await user.click(within(sheet).getByRole('button', { name: 'Hiq Mollë' }))
    expect(await within(sheet).findByText(/^379 kcal/)).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Mbyll' }))

    await user.click(screen.getByRole('button', { name: /^Lloji i ditës: pushim/ }))
    expect(await screen.findByText('ditë stërvitjeje')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Kalori të ditës' }).parentElement).toHaveTextContent('379 / 3 625 kcal')
    expect(screen.getByRole('button', { name: /^Para stërvitjes, 17:45/ })).toBeInTheDocument()
  })

  it('suplementet: te vakti në orar, checklist me evidencën, çaktivizimi te lista', async () => {
    const user = userEvent.setup()
    await renderPage()
    expect(await screen.findByRole('button', { name: /^Para gjumit, 22:30/ })).toHaveTextContent('me pluhur proteine, ZMA')
    const section = screen.getByRole('region', { name: /^Suplementet/ })
    // Testi i mëparshëm e bëri ditën ditë stërvitjeje: shake-u shton suplementet e tij.
    expect(section).toHaveTextContent('Suplementet · 0 nga 17')
    const multivitamin = within(section).getByRole('checkbox', { name: /Multivitaminë/ })
    expect(multivitamin.closest('label')).toHaveTextContent('Vetëm për mungesa')
    await user.click(multivitamin)
    expect(await within(section).findByText('· 1 nga 17', { exact: false })).toBeInTheDocument()
    expect(within(section).getByRole('checkbox', { name: /Multivitaminë/ })).toBeChecked()

    await user.click(within(section).getByRole('button', { name: 'Ndrysho listën' }))
    const sheet = screen.getByRole('dialog', { name: 'Suplementet' })
    const zma = await within(sheet).findByRole('switch', { name: /ZMA/ })
    expect(zma.closest('label')).toHaveTextContent('E dobët pa mungesë')
    await user.click(zma)
    await user.click(within(sheet).getByRole('button', { name: 'Mbyll' }))
    // Rreshti ekziston edhe para rifreskimit: pritet derisa ZMA të mos jetë më aty.
    await waitFor(() => expect(screen.getByRole('button', { name: /^Para gjumit, 22:30/ })).not.toHaveTextContent('ZMA'))
    expect(screen.getByRole('region', { name: /^Suplementet/ })).toHaveTextContent('Suplementet · 1 nga 16')
  })

  it('në anglisht: vaktet, shablloni i Jimit, sasitë, suplementet dhe numrat sipas gjuhës', async () => {
    const user = userEvent.setup()
    language.set('en')
    await renderPage()
    // Testet e mëparshme: dreka e regjistruar pa mollën, dita e stërvitjes, ZMA e fikur.
    const panel = (await screen.findByRole('heading', { level: 2, name: 'Afternoon snack' })).closest('section')!
    expect(screen.getByText('Next meal')).toBeInTheDocument()
    expect(screen.getByText('training day')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Calories today' }).parentElement).toHaveTextContent('379 / 3,625 kcal')
    expect(within(panel).getByText('15:30 · in 2 hr 50 min')).toBeInTheDocument()
    expect(within(panel).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Protein powder1 scoop',
      'Peanut butter1 tbsp',
      'Jam1 tbsp',
      'Wholemeal bread2 slices',
    ])
    expect(within(panel).getByRole('button', { name: 'Log snack' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Lunch, 13:00, Logged · 379 kcal' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Pre-workout, 17:45/ })).toHaveTextContent('with protein powder, creatine, beta-alanine, betaine, BCAA')
    expect(screen.getByText('Protein').parentElement).toHaveTextContent('/ 328 g')
    expect(screen.getByText(/^Jim’s protein is about 3\.3–4\.1 g\/kg/)).toBeInTheDocument()
    const section = screen.getByRole('region', { name: /^Supplements/ })
    expect(section).toHaveTextContent('Supplements · 1 of 16')
    expect(within(section).getByRole('checkbox', { name: /Multivitamin/ }).closest('label')).toHaveTextContent('Only for deficiencies')
    expect(within(section).getAllByRole('checkbox', { name: /Creatine/ })[0].closest('label')).toHaveTextContent('1.5–5 g')
    expect(document.body.textContent).not.toMatch(/[ëç]/)

    await user.click(screen.getByRole('button', { name: /^Lunch, 13:00/ }))
    const sheet = screen.getByRole('dialog', { name: 'Lunch · 13:00' })
    expect(within(sheet).getByText('Albacore tuna in water')).toBeInTheDocument()
    expect(within(sheet).getByRole('button', { name: 'Remove Wholemeal bread' })).toBeInTheDocument()
    expect(within(sheet).getByText('64 g · 161 kcal')).toBeInTheDocument()
    expect(within(sheet).getByRole('link', { name: 'Add food' })).toHaveAttribute('href', '/ushqimi/shto/lunch')
    await user.click(within(sheet).getByRole('button', { name: 'Close' }))

    await user.click(screen.getByRole('button', { name: 'Edit list' }))
    const list = screen.getByRole('dialog', { name: 'Supplements' })
    expect(await within(list).findByRole('switch', { name: /ZMA/ })).not.toBeChecked()
    expect(within(list).getByRole('switch', { name: /ZMA/ }).closest('label')).toHaveTextContent('1 dose · Weak without a deficiency')
  })
  // V2-E2-03: pa profil, objektivat vijnë nga Jimi dhe ekrani fton te kalkulatori.
  it('objektivat e Jimit me ftesën te Objektivat', async () => {
    await renderPage()
    expect(await screen.findByText('Llogarit objektivat e tua')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Llogarit' })).toHaveAttribute('href', '/ushqimi/objektivat')
    expect(screen.getByRole('link', { name: 'Objektivat' })).toHaveAttribute('href', '/ushqimi/objektivat')
  })
})
