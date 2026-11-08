import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useSyncExternalStore } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { AppPhase } from '@/data/phase'
import { language } from '@/i18n/language'
import { AppGate } from './gate'

const mock = vi.hoisted(() => {
  const listeners = new Set<() => void>()
  return {
    phase: 'loading' as AppPhase,
    listeners,
    setPhase(next: AppPhase) {
      mock.phase = next
      listeners.forEach((listener) => listener())
    },
    syncNow: vi.fn(async () => undefined),
    signOut: vi.fn(async () => undefined),
  }
})

vi.mock('@/data/app-data', () => ({
  useAppPhase: () =>
    useSyncExternalStore(
      (listener) => {
        mock.listeners.add(listener)
        return () => mock.listeners.delete(listener)
      },
      () => mock.phase,
    ),
  scheduler: { syncNow: mock.syncNow },
  auth: { signOut: mock.signOut },
  useDataUpgrades: () => undefined,
  useReminderPlanner: () => undefined,
  usePhotoUploader: () => undefined,
  useUpdateChecker: () => undefined,
  useLanguageSync: () => undefined,
  useBackgroundSync: () => undefined,
}))

function renderAt(path: string, phase: AppPhase) {
  mock.phase = phase
  const router = createMemoryRouter(
    [
      {
        element: <AppGate />,
        children: [
          { path: '/hyrja', element: <h1>Hyrja</h1> },
          { path: '/fillimi', element: <h1>Hapat</h1> },
          { path: '/', element: <h1>Sot</h1> },
        ],
      },
    ],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />)
  return router
}

describe('porta e app-it', () => {
  it('pa sesion çon te hyrja', () => {
    const router = renderAt('/', 'signed_out')
    expect(screen.getByRole('heading', { name: 'Hyrja' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/hyrja')
  })

  it('me profil të plotësuar hap Sot, edhe nga hyrja ose hapat', () => {
    expect(renderAt('/hyrja', 'ready').state.location.pathname).toBe('/')
    expect(screen.getByRole('heading', { name: 'Sot' })).toBeInTheDocument()
  })

  it('pa profil çon te hapat; kur profili plotësohet, hap Sot', () => {
    const router = renderAt('/', 'onboarding')
    expect(router.state.location.pathname).toBe('/fillimi')
    act(() => mock.setPhase('ready'))
    expect(router.state.location.pathname).toBe('/')
    expect(screen.getByRole('heading', { name: 'Sot' })).toBeInTheDocument()
  })

  it('gjatë marrjes së të dhënave e thotë me fjalë', () => {
    renderAt('/', 'fetching')
    expect(screen.getByRole('heading', { name: 'Po merren të dhënat e tua' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Provo përsëri' })).not.toBeInTheDocument()
  })

  it('kur marrja dështon: provo përsëri ose dil', async () => {
    renderAt('/', 'fetch_failed')
    expect(screen.getByRole('heading', { name: 'Të dhënat nuk u morën' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Provo përsëri' }))
    expect(mock.syncNow).toHaveBeenCalledOnce()
    await userEvent.click(screen.getByRole('button', { name: 'Dil nga llogaria' }))
    expect(mock.signOut).toHaveBeenCalledOnce()
  })

  it('në anglisht, dhe ndërrimi i gjuhës ndryshon tekstet pa rinisje', () => {
    renderAt('/', 'fetch_failed')
    act(() => language.set('en'))
    expect(screen.getByRole('heading', { name: 'Your data did not arrive' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
    act(() => language.set('sq'))
    expect(screen.getByRole('heading', { name: 'Të dhënat nuk u morën' })).toBeInTheDocument()
  })

  it('para leximit të sesionit nuk shfaq asnjë ekran', () => {
    renderAt('/', 'loading')
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })
})
