import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { CheckInAnswers } from '@/data/daily-state'
import type { LocalStore } from '@/data/store'
import { language } from '@/i18n/language'
import { appRoutes as routes } from '@/router'

// Pamja e ditës (V50, V2-E3-07): korniza vendos `data-day` sipas gatishmërisë dhe çelësit "Pamja ndjek gjendjen",
// Sot thotë fjalinë e ditës, historiku mban prushin. Ora e telefonit: e diela 8 nëntor 2026, ditë stërvitjeje.
const data = vi.hoisted(() => ({ store: null as unknown as LocalStore }))

vi.mock('@/lib/webgl', () => ({ webglAvailable: () => false }))
vi.mock('@/data/app-data', async () => {
  const store = new Proxy({} as LocalStore, {
    get: (_, key: keyof LocalStore) => {
      const value = data.store[key]
      return typeof value === 'function' ? value.bind(data.store) : value
    },
  })
  return { store, updater: {}, useAppUpdate: () => ({ status: 'idle' }), useLocalQuery: (await import('@/test/local-query')).useLocalQueryFor(store) }
})

const DAY = '2026-11-08'
const TIRED: CheckInAnswers = { mood: 1, energy: 1, sleepMinutes: 240, sleepQuality: 1, soreness: 0, soreGroups: [] }
const ENERGETIC: CheckInAnswers = { mood: 5, energy: 5, sleepMinutes: 480, sleepQuality: 5, soreness: 0, soreGroups: [] }
const day = () => document.documentElement.getAttribute('data-day')

async function freshStore() {
  const { createDatabase } = await import('@/data/db')
  const { createLocalStore } = await import('@/data/store')
  const { completeOnboarding } = await import('@/data/profile')
  let clock = new Date(2026, 9, 25, 9, 0)
  data.store = createLocalStore(createDatabase(`day-mode-${crypto.randomUUID()}`), { userId: () => '11111111-1111-4111-8111-111111111111', now: () => clock })
  await completeOnboarding(data.store, { weightKg: 80, trainingDays: [7, 1, 2, 4], trainingTime: '17:15', wakeTime: '07:00', sleepTime: '23:00' }, () => clock)
  clock = new Date(2026, 10, 8, 10, 0)
  return data.store
}

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  return render(<RouterProvider router={router} />)
}

describe('pamja e ditës', () => {
  afterEach(() => {
    cleanup()
    act(() => language.set('sq'))
    document.documentElement.removeAttribute('data-day')
  })

  it('pa check-in: asgjë te <html> dhe asnjë fjali', async () => {
    await freshStore()
    renderAt('/')
    await screen.findByRole('heading', { name: 'Sot' })
    expect(day()).toBeNull()
    expect(screen.queryByText('Ritëm i butë sot.')).toBeNull()
    expect(screen.queryByText('Je në formë sot. Shko fort.')).toBeNull()
  })

  it('gatishmëri e ulët: data-day="tired" dhe "Ritëm i butë sot." (edhe në anglisht)', async () => {
    const store = await freshStore()
    const { saveDailyState } = await import('@/data/daily-state')
    await saveDailyState(store, DAY, TIRED)
    renderAt('/')
    expect(await screen.findByText('Ritëm i butë sot.')).toBeInTheDocument()
    expect(day()).toBe('tired')
    act(() => language.set('en'))
    expect(await screen.findByText('Gentle pace today.')).toBeInTheDocument()
  })

  it('gatishmëri e lartë: data-day="energetic" dhe "Je në formë sot. Shko fort." (edhe në anglisht)', async () => {
    const store = await freshStore()
    const { saveDailyState } = await import('@/data/daily-state')
    await saveDailyState(store, DAY, ENERGETIC)
    renderAt('/')
    expect(await screen.findByText('Je në formë sot. Shko fort.')).toBeInTheDocument()
    expect(day()).toBe('energetic')
    act(() => language.set('en'))
    expect(await screen.findByText('You are in form today. Go hard.')).toBeInTheDocument()
  })

  it('rifreskohet kur ndryshon check-in-i, dhe çelësi i fikur e kthen menjëherë te normalja', async () => {
    const store = await freshStore()
    const { saveDailyState, setFollowDayState } = await import('@/data/daily-state')
    renderAt('/')
    await screen.findByRole('heading', { name: 'Sot' })
    expect(day()).toBeNull()
    await act(() => saveDailyState(store, DAY, TIRED))
    await waitFor(() => expect(day()).toBe('tired'))
    await act(() => setFollowDayState(store, false))
    await waitFor(() => expect(day()).toBeNull())
    await waitFor(() => expect(screen.queryByText('Ritëm i butë sot.')).toBeNull())
    await act(() => setFollowDayState(store, true))
    await waitFor(() => expect(day()).toBe('tired'))
  })

  it('historiku mban prushin (data-day-keep), pjesa tjetër jo; dalja e pastron data-day', async () => {
    const store = await freshStore()
    const { saveDailyState } = await import('@/data/daily-state')
    await saveDailyState(store, DAY, TIRED)
    const history = renderAt('/progresi/historiku')
    await waitFor(() => expect(day()).toBe('tired'))
    expect(document.querySelector('main')).toHaveAttribute('data-day-keep')
    history.unmount()
    expect(day()).toBeNull()
    renderAt('/progresi')
    await waitFor(() => expect(day()).toBe('tired'))
    expect(document.querySelector('main')).not.toHaveAttribute('data-day-keep')
  })
})
