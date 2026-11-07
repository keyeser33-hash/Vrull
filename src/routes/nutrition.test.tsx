import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect, useState } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { LocalStore } from '@/data/store'

// Ushqimi me store të vërtetë, të mërkurën në 12:40 (ditë pushimi, 80 kg).
const data = vi.hoisted(() => ({ store: null as unknown as LocalStore }))
vi.mock('@/data/app-data', async () => {
  const { createDatabase } = await import('@/data/db')
  const { createLocalStore } = await import('@/data/store')
  const store = createLocalStore(createDatabase(`nutrition-ui-${crypto.randomUUID()}`), { userId: () => '11111111-1111-4111-8111-111111111111' })
  data.store = store
  return {
    store,
    useLocalQuery<T>(query: () => Promise<T>) {
      const [value, setValue] = useState<T>()
      useEffect(() => {
        let started = 0
        let shown = 0
        const run = () => {
          const ticket = ++started
          void query().then((result) => {
            if (ticket < shown) return
            shown = ticket
            setValue(() => result)
          })
        }
        run()
        return store.subscribe(run)
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [])
      return value
    },
  }
})

describe('Ushqimi', () => {
  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-12-09T12:40:00'))
    await import('@/data/app-data')
    const { completeOnboarding } = await import('@/data/profile')
    await completeOnboarding(data.store, { weightKg: 80, trainingDays: [1, 2, 4, 5], trainingTime: '18:00', wakeTime: '07:00', sleepTime: '23:00' })
  })
  afterAll(() => vi.useRealTimers())

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
    expect(screen.getByRole('progressbar', { name: 'Kalori të ditës' }).parentElement).toHaveTextContent('0 / 3.037 kcal')
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
    expect(screen.getByRole('progressbar', { name: 'Kalori të ditës' }).parentElement).toHaveTextContent('495 / 3.037 kcal')
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
    expect(screen.getByRole('progressbar', { name: 'Kalori të ditës' }).parentElement).toHaveTextContent('379 / 3.625 kcal')
    expect(screen.getByRole('button', { name: /^Para stërvitjes, 17:45/ })).toBeInTheDocument()
  })
})
