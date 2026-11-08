import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { LocalStore } from '@/data/store'
import { language } from '@/i18n/language'

// Rikujtuesit (SPEC §13), nga Cilësimet › Njoftimet.
const data = vi.hoisted(() => ({ store: null as unknown as LocalStore }))
vi.mock('@/data/app-data', async () => {
  const { createDatabase } = await import('@/data/db')
  const { createLocalStore } = await import('@/data/store')
  const store = createLocalStore(createDatabase(`reminders-${crypto.randomUUID()}`), { userId: () => '11111111-1111-4111-8111-111111111111' })
  data.store = store
  return {
    store,
    planRemindersNow: async () => {},
    useLocalQuery: (await import('@/test/local-query')).useLocalQueryFor(store),
  }
})

async function renderReminders() {
  const { RemindersPage } = await import('./settings-reminders')
  const router = createMemoryRouter([{ path: '/cilesimet/rikujtuesit', element: <RemindersPage /> }], { initialEntries: ['/cilesimet/rikujtuesit'] })
  render(<RouterProvider router={router} />)
  await screen.findByRole('switch', { name: /^Vaktet/ })
  return router
}

describe('Rikujtuesit', () => {
  beforeAll(async () => {
    await import('@/data/app-data')
    const { completeOnboarding } = await import('@/data/profile')
    await completeOnboarding(data.store, { weightKg: 80, trainingDays: [1, 2, 4, 5], trainingTime: '18:00', wakeTime: '07:00', sleepTime: '23:00' })
  })
  afterEach(() => act(() => language.set('sq')))

  it('çelësat ruhen dhe dita e matjes zgjidhet në fletë', async () => {
    const user = userEvent.setup()
    await renderReminders()
    expect(screen.getAllByRole('switch').map((toggle) => toggle.closest('label')?.querySelector('.type-body-strong')?.textContent)).toEqual([
      'Stërvitja',
      'Vaktet',
      'Suplementet',
      'Matja javore',
    ])
    const meals = screen.getByRole('switch', { name: /^Vaktet/ })
    expect(meals).toBeChecked()
    await user.click(meals)
    await waitFor(() => expect(screen.getByRole('switch', { name: /^Vaktet/ })).not.toBeChecked())
    expect((await data.store.all('user_settings'))[0].reminders).toMatchObject({ meals: false, supplements: true })
    await user.click(screen.getByRole('button', { name: 'Dita e matjes, E diel' }))
    const sheet = screen.getByRole('dialog', { name: 'Dita e matjes' })
    expect(sheet).toHaveAccessibleDescription('Rikujtuesi vjen në orën e zgjimit, që pesha të matet para mëngjesit.')
    await user.click(within(sheet).getByRole('radio', { name: 'E hënë' }))
    expect(await screen.findByRole('button', { name: 'Dita e matjes, E hënë' })).toBeInTheDocument()
    expect((await data.store.all('user_settings'))[0].measurement_day).toBe(1)
  })

  it('në anglisht', async () => {
    await renderReminders()
    act(() => language.set('en'))
    expect(screen.getByRole('heading', { level: 1, name: 'Reminders' })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: /^Weekly measurement/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Measurement day, Monday' })).toBeInTheDocument()
  })
})
