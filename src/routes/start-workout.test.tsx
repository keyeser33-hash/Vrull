import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router'
import { Button } from '@/components/ui/button'
import type { LocalStore } from '@/data/store'
import { language } from '@/i18n/language'

// Fillimi i stërvitjes (V2-E3-30; bordi "Sot · Fillimi i stërvitjes"): butoni që punon, "Po përgatis
// seancën" pas 3 s, dhe fleta "Njoftimi i pushimit" para kërkesës së parë për lejen.
const data = vi.hoisted(() => ({
  store: null as unknown as LocalStore,
  prompt: false,
  prepare: vi.fn<() => Promise<void>>(async () => {}),
}))

vi.mock('@/data/app-data', async () => {
  const store = new Proxy({} as LocalStore, {
    get: (_, key: keyof LocalStore) => {
      const value = data.store[key]
      return typeof value === 'function' ? value.bind(data.store) : value
    },
  })
  return { store, useLocalQuery: (await import('@/test/local-query')).useLocalQueryFor(store) }
})
vi.mock('@/lib/rest-alarm', () => ({ prepareRestNotifications: () => data.prepare(), restNotificationsPrompt: async () => data.prompt }))

const NOW = new Date(2026, 10, 16, 10, 0)

async function renderStart() {
  const { useStartWorkout } = await import('./start-workout')
  function Start() {
    const starter = useStartWorkout()
    const location = useLocation()
    return (
      <>
        <span data-testid="at">{location.pathname + location.search}</span>
        <Button variant="primary" size="lg" {...starter.buttonProps}>
          {starter.label('Fillo stërvitjen')}
        </Button>
        {starter.sheet}
      </>
    )
  }
  const router = createMemoryRouter(
    [
      { path: '/', element: <Start /> },
      { path: '/seanca', element: <h1>Seanca</h1> },
    ],
    { initialEntries: ['/'] },
  )
  render(<RouterProvider router={router} />)
  return router
}

describe('Fillimi i stërvitjes', () => {
  beforeEach(async () => {
    data.prompt = false
    data.prepare = vi.fn(async () => {})
    const { createDatabase } = await import('@/data/db')
    const { createLocalStore } = await import('@/data/store')
    const { completeOnboarding } = await import('@/data/profile')
    data.store = createLocalStore(createDatabase(`start-${crypto.randomUUID()}`), { userId: () => '11111111-1111-4111-8111-111111111111', now: () => NOW })
    await completeOnboarding(data.store, { weightKg: 80, trainingDays: [1, 2, 4, 5], trainingTime: '18:00', wakeTime: '07:00', sleepTime: '23:00' }, () => NOW)
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    language.set('sq')
  })

  it('gjatë fillimit butoni nuk zbehet: rrethi që rrotullohet, "Po fillon" me aria-busy, pas 3 s "Po përgatis seancën"', async () => {
    let release = () => {}
    data.prepare = vi.fn(() => new Promise<void>((resolve) => (release = resolve)))
    const router = await renderStart()
    const idle = await screen.findByRole('button', { name: 'Fillo stërvitjen' })
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    fireEvent.click(idle)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50)
    })
    const button = screen.getByRole('button', { name: 'Po fillon' })
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(button).toBeEnabled()
    expect(button.querySelector('svg')).toHaveClass('motion-safe:animate-spin')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2900)
    })
    expect(screen.getByRole('button', { name: 'Po fillon' })).toBeInTheDocument()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200)
    })
    expect(screen.getByRole('button', { name: 'Po përgatis seancën' })).toHaveAttribute('aria-busy', 'true')
    vi.useRealTimers()
    await act(async () => release())
    await waitFor(() => expect(router.state.location.pathname).toBe('/seanca'))
  })

  it('anglisht: "Starting" dhe "Preparing the session"', async () => {
    language.set('en')
    data.prepare = vi.fn(() => new Promise<void>(() => {}))
    await renderStart()
    const idle = await screen.findByRole('button', { name: 'Fillo stërvitjen' })
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    fireEvent.click(idle)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50)
    })
    expect(screen.getByRole('button', { name: 'Starting' })).toHaveAttribute('aria-busy', 'true')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100)
    })
    expect(screen.getByRole('button', { name: 'Preparing the session' })).toBeInTheDocument()
  })

  it('pa pyetje nga telefoni: nis drejt, pa fletë', async () => {
    const user = userEvent.setup()
    const router = await renderStart()
    await user.click(await screen.findByRole('button', { name: 'Fillo stërvitjen' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/seanca'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(data.prepare).toHaveBeenCalledTimes(1)
  })

  it('para kërkesës së parë: fleta "Njoftimi i pushimit"; "Lejo njoftimet" ruan zgjedhjen, kërkon lejen dhe nis', async () => {
    data.prompt = true
    const user = userEvent.setup()
    const router = await renderStart()
    await user.click(await screen.findByRole('button', { name: 'Fillo stërvitjen' }))
    const sheet = await screen.findByRole('dialog', { name: 'Njoftimi i pushimit' })
    expect(sheet).toHaveTextContent('Vrull të tregon kur mbaron pushimi mes seteve, edhe me ekran të kyçur.')
    expect(router.state.location.search).toBe('?njoftimi=1')
    expect(data.prepare).not.toHaveBeenCalled()
    await user.click(within(sheet).getByRole('button', { name: 'Lejo njoftimet' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/seanca'))
    expect(data.prepare).toHaveBeenCalledTimes(1)
    expect(await data.store.readDevice('rest-notify-choice')).toBe('allowed')
    // Mbrapa nga seanca nuk e kthen fletën: hyrja e fletës u zëvendësua.
    await act(async () => router.navigate(-1))
    expect(router.state.location.search).toBe('')
  })

  it('"Jo tani, fillo pa to": nis pa kërkuar lejen, dhe fleta nuk del më', async () => {
    data.prompt = true
    const user = userEvent.setup()
    const router = await renderStart()
    await user.click(await screen.findByRole('button', { name: 'Fillo stërvitjen' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Jo tani, fillo pa to' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/seanca'))
    expect(data.prepare).not.toHaveBeenCalled()
    expect(await data.store.readDevice('rest-notify-choice')).toBe('declined')
    await act(async () => router.navigate('/'))
    await user.click(await screen.findByRole('button', { name: 'Fillo stërvitjen' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/seanca'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(data.prepare).not.toHaveBeenCalled()
  })

  it('mbyllja e fletës nuk nis stërvitjen dhe nuk ruan zgjedhje; anglisht', async () => {
    language.set('en')
    data.prompt = true
    const user = userEvent.setup()
    const router = await renderStart()
    await user.click(await screen.findByRole('button', { name: 'Fillo stërvitjen' }))
    const sheet = await screen.findByRole('dialog', { name: 'Rest notification' })
    expect(within(sheet).getByRole('button', { name: 'Allow notifications' })).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(router.state.location.pathname).toBe('/')
    expect(await data.store.readDevice('rest-notify-choice')).toBeUndefined()
  })
})
