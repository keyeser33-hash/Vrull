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
      'Uji',
      'Matja javore',
      'Përmbledhja e javës',
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

  it('vala 3 (V79, V81): "Sa më parë" dhe "Uji vjen" tregojnë parazgjedhjet dhe ruajnë zgjedhjen', async () => {
    const user = userEvent.setup()
    await renderReminders()
    await user.click(await screen.findByRole('button', { name: /^Sa më parë, 30 min/ }))
    await user.click(within(screen.getByRole('dialog', { name: 'Sa më parë' })).getByRole('radio', { name: '1 orë' }))
    expect(await screen.findByRole('button', { name: /^Sa më parë, 1 orë/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Uji vjen, Me çdo vakt/ }))
    await user.click(within(screen.getByRole('dialog', { name: 'Uji vjen' })).getByRole('radio', { name: 'Çdo 2 orë' }))
    expect(await screen.findByRole('button', { name: /^Uji vjen, Çdo 2 orë/ })).toBeInTheDocument()
    expect((await data.store.all('user_settings'))[0].reminders).toMatchObject({ lead: 60, waterMode: 'hours' })
    // Ora e "Mbyll ditën" del te hollësia e vakteve: 90 minuta para gjumit (23:00).
    expect(screen.getByRole('switch', { name: /Mbyll ditën: 21:30, vetëm kur ka vakte pa shënuar/ })).toBeInTheDocument()
  })

  it('orët e qeta (V37): intervali ruhet dhe hiqet; teksti i rikujtuesve të zgjuar', async () => {
    const user = userEvent.setup()
    await renderReminders()
    expect(await screen.findByText(/^Vjen vetëm kur vakti, uji ose suplementi nuk është regjistruar\. Rreth 5 në ditë, jo nga gjumi deri te zgjimi \(23:00–07:00\)/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Orët e qeta, Pa interval' }))
    const sheet = screen.getByRole('dialog', { name: 'Orët e qeta' })
    // Ora vizatohet e plotë me 24 orë mbi input-in e padukshëm (F1).
    expect(within(sheet).getByLabelText(/^Nga/).parentElement).toHaveTextContent('12:00')
    expect(within(sheet).getByLabelText(/^Deri/).parentElement).toHaveTextContent('14:00')
    await user.click(within(sheet).getByRole('button', { name: 'Ruaj intervalin' }))
    expect(await screen.findByRole('button', { name: 'Orët e qeta, 12:00–14:00' })).toBeInTheDocument()
    expect((await data.store.all('user_settings'))[0].reminders).toMatchObject({ quiet: { from: '12:00', to: '14:00' } })
    await user.click(screen.getByRole('button', { name: 'Orët e qeta, 12:00–14:00' }))
    await user.click(within(screen.getByRole('dialog', { name: 'Orët e qeta' })).getByRole('button', { name: 'Hiq intervalin' }))
    expect(await screen.findByRole('button', { name: 'Orët e qeta, Pa interval' })).toBeInTheDocument()
  })

  it('një lloj i heshtur vetë: "Ndize përsëri"', async () => {
    const user = userEvent.setup()
    const { muteReminders } = await import('@/data/reminders')
    await muteReminders(data.store, ['water'], '2026-12-14')
    await renderReminders()
    const muted = screen.getByRole('region', { name: 'Të heshtur' })
    expect(within(muted).getByText('Heshtur, sepse nuk i hap')).toBeInTheDocument()
    await user.click(within(muted).getByRole('button', { name: 'Ndize përsëri' }))
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Të heshtur' })).not.toBeInTheDocument())
  })

  it('në anglisht', async () => {
    await renderReminders()
    act(() => language.set('en'))
    expect(screen.getByRole('heading', { level: 1, name: 'Reminders' })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: /^Weekly measurement/ })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: /^Weekly summary/ })).toBeChecked()
    expect(screen.getByRole('button', { name: 'Measurement day, Monday' })).toBeInTheDocument()
  })
})
