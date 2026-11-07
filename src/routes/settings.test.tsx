import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect, useState } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import pkg from '../../package.json'
import type { LocalStore } from '@/data/store'

// Cilësimet, varianti A (07.11.2026): paneli i llogarisë sipër, rreshta me vlerat, fletë për ndryshim.
// Store i vërtetë me një përdorues; llogaria dhe sinkronizimi të imituara.
const data = vi.hoisted(() => ({
  store: null as unknown as LocalStore,
  signOut: vi.fn(async () => undefined),
  syncNow: vi.fn(async () => undefined),
}))
vi.mock('@/data/app-data', async () => {
  const { createDatabase } = await import('@/data/db')
  const { createLocalStore } = await import('@/data/store')
  const store = createLocalStore(createDatabase(`settings-${crypto.randomUUID()}`), {
    userId: () => '11111111-1111-4111-8111-111111111111',
  })
  data.store = store
  return {
    store,
    auth: { signOut: data.signOut },
    scheduler: { syncNow: data.syncNow },
    useAuth: () => ({ status: 'signed_in', userId: '11111111-1111-4111-8111-111111111111', email: 'une@example.com' }),
    useSyncStatus: () => ({ syncing: false, last: null }),
    usePendingChanges: () => 0,
    planRemindersNow: async () => {},
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

const share = vi.hoisted(() => ({ shareExport: vi.fn(async () => true) }))
vi.mock('@/data/share-export', () => share)

async function renderSettings() {
  const { SettingsPage } = await import('./settings')
  const router = createMemoryRouter(
    [
      { path: '/cilesimet', element: <SettingsPage /> },
      { path: '/', element: <h1>Sot</h1> },
    ],
    { initialEntries: ['/cilesimet'] },
  )
  render(<RouterProvider router={router} />)
  await screen.findByRole('button', { name: /^Ora e stërvitjes/ })
  return router
}

const row = (name: RegExp) => screen.getByRole('button', { name })

describe('cilësimet', () => {
  beforeAll(async () => {
    await import('@/data/app-data')
    const { completeOnboarding } = await import('@/data/profile')
    await completeOnboarding(data.store, { weightKg: 80.5, trainingDays: [1, 2, 4, 5], trainingTime: '18:00', wakeTime: '07:00', sleepTime: '23:00' })
  })
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.className = 'dark oled'
    data.signOut.mockClear()
  })

  it('llogaria sipër: email-i, gjendja e sinkronizimit dhe "Dil"', async () => {
    await renderSettings()
    const account = screen.getByRole('region', { name: 'Llogaria' })
    expect(within(account).getByText('une@example.com')).toBeInTheDocument()
    expect(within(account).getByRole('status')).toHaveTextContent('Ende pa sinkronizim')
    expect(within(account).getByRole('button', { name: 'Dil' })).toBeInTheDocument()
  })

  it('"Dil" pyet një herë dhe del vetëm pas konfirmimit', async () => {
    const user = userEvent.setup()
    await renderSettings()
    await user.click(screen.getByRole('button', { name: 'Dil' }))
    const sheet = screen.getByRole('dialog', { name: 'Dil nga llogaria' })
    expect(sheet).toHaveTextContent('Të dhënat mbeten në telefon')
    expect(data.signOut).not.toHaveBeenCalled()
    await user.click(within(sheet).getByRole('button', { name: 'Dil nga llogaria' }))
    expect(data.signOut).toHaveBeenCalledOnce()
  })

  it('çdo rresht tregon vlerën e tanishme', async () => {
    await renderSettings()
    expect(row(/^Ditët e stërvitjes/)).toHaveTextContent('Hën, Mar, Enj, Pre')
    expect(row(/^Ora e stërvitjes/)).toHaveTextContent('18:00')
    expect(row(/^Pesha e sotme/)).toHaveTextContent('80,5 kg')
    expect(row(/^Zgjimi/)).toHaveTextContent('07:00')
    expect(row(/^Gjumi/)).toHaveTextContent('23:00')
    expect(row(/^Tema/)).toHaveTextContent('OLED')
  })

  it('ora ndryshohet në fletë me − dhe + dhe ruhet me "Ruaj"', async () => {
    const { readProfile } = await import('@/data/profile')
    const user = userEvent.setup()
    await renderSettings()
    await user.click(row(/^Ora e stërvitjes/))
    const sheet = screen.getByRole('dialog', { name: 'Ora e stërvitjes' })
    await user.click(within(sheet).getByRole('button', { name: 'Ora e stërvitjes 15 minuta më vonë' }))
    await user.click(within(sheet).getByRole('button', { name: 'Ruaj' }))
    await vi.waitFor(async () => expect((await readProfile(data.store)).trainingTime).toBe('18:15'))
    expect(await screen.findByRole('button', { name: 'Ora e stërvitjes, 18:15' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('pesha ruhet si matja e sotme; një peshë e pavlefshme nuk ruhet dhe e thotë', async () => {
    const { readProfile } = await import('@/data/profile')
    const user = userEvent.setup()
    await renderSettings()
    await user.click(row(/^Pesha e sotme/))
    const sheet = screen.getByRole('dialog', { name: 'Pesha e sotme' })
    const input = within(sheet).getByLabelText('Pesha')
    await user.clear(input)
    await user.type(input, '3{enter}')
    await user.click(within(sheet).getByRole('button', { name: 'Ruaj' }))
    expect(within(sheet).getByText('Shkruaj një peshë mes 30 dhe 300 kg, p.sh. 80,5.')).toBeInTheDocument()
    await user.clear(input)
    await user.type(input, '79,8{enter}')
    await user.click(within(sheet).getByRole('button', { name: 'Ruaj' }))
    await vi.waitFor(async () => expect((await readProfile(data.store)).weightKg).toBe(79.8))
  })

  it('ditët: pa asnjë ditë nuk ruhet; me një ditë më shumë ruhet', async () => {
    const { readProfile } = await import('@/data/profile')
    const user = userEvent.setup()
    await renderSettings()
    await user.click(row(/^Ditët e stërvitjes/))
    const sheet = screen.getByRole('dialog', { name: 'Ditët e stërvitjes' })
    for (const day of ['E hënë', 'E martë', 'E enjte', 'E premte']) await user.click(within(sheet).getByRole('button', { name: day }))
    await user.click(within(sheet).getByRole('button', { name: 'Ruaj' }))
    expect(within(sheet).getByText('Zgjidh të paktën një ditë stërvitjeje.')).toBeInTheDocument()
    for (const day of ['E hënë', 'E martë', 'E enjte', 'E premte', 'E shtunë']) await user.click(within(sheet).getByRole('button', { name: day }))
    await user.click(within(sheet).getByRole('button', { name: 'Ruaj' }))
    await vi.waitFor(async () => expect((await readProfile(data.store)).trainingDays).toEqual([1, 2, 4, 5, 6]))
  })

  it('tema ndërrohet menjëherë dhe ruhet', async () => {
    const user = userEvent.setup()
    await renderSettings()
    await user.click(row(/^Tema/))
    const sheet = screen.getByRole('dialog', { name: 'Tema' })
    expect(within(sheet).getByRole('radio', { name: 'OLED' })).toBeChecked()
    // Prova në emulator e gjen temën sipas vlerës së radios.
    expect(within(sheet).getByRole('radio', { name: 'E çelët' })).toHaveAttribute('value', 'light')
    await user.click(within(sheet).getByRole('radio', { name: 'E çelët' }))
    expect(document.documentElement.className).toBe('')
    expect(window.localStorage.getItem('th-theme')).toBe('light')
  })

  it('sinkronizimi dhe eksporti me një prekje; eksporti i dështuar thuhet me fjalë', async () => {
    const user = userEvent.setup()
    await renderSettings()
    await user.click(screen.getByRole('button', { name: 'Sinkronizo tani' }))
    expect(data.syncNow).toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Eksporto të dhënat' }))
    expect(share.shareExport).toHaveBeenCalledOnce()
    share.shareExport.mockRejectedValueOnce(new Error('disk'))
    await user.click(await screen.findByRole('button', { name: 'Eksporto të dhënat' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Eksporti nuk u krye. Provo përsëri.')
  })

  it('burimet dhe licencat: modeli 3D, ushtrimet dhe ushqimet me atribuimin e tyre', async () => {
    const user = userEvent.setup()
    await renderSettings()
    await user.click(row(/^Burimet dhe licencat/))
    const sheet = screen.getByRole('dialog', { name: 'Burimet dhe licencat' })
    expect(sheet).toHaveTextContent('BodyParts3D, © The Database Center for Life Science')
    expect(sheet).toHaveTextContent('CC BY-SA 2.1 Japan')
    expect(sheet).toHaveTextContent('free-exercise-db')
    expect(sheet).toHaveTextContent('Open Food Facts')
    expect(sheet).toHaveTextContent('Open Database License')
    expect(sheet).toHaveTextContent('USDA FoodData Central')
  })

  it('tregon versionin nga package.json', async () => {
    await renderSettings()
    expect(screen.getByText(`Training Hub ${pkg.version}`)).toBeInTheDocument()
  })

  it('rikujtuesit: çelësat ruhen dhe dita e matjes zgjidhet në fletë', async () => {
    const user = userEvent.setup()
    await renderSettings()
    const group = await screen.findByRole('region', { name: 'Rikujtuesit' })
    const meals = within(group).getByRole('switch', { name: /^Vaktet/ })
    expect(meals).toBeChecked()
    await user.click(meals)
    await waitFor(() => expect(within(group).getByRole('switch', { name: /^Vaktet/ })).not.toBeChecked())
    expect((await data.store.all('user_settings'))[0].reminders).toMatchObject({ meals: false, supplements: true })
    await user.click(within(group).getByRole('button', { name: 'Dita e matjes, E diel' }))
    await user.click(within(screen.getByRole('dialog', { name: 'Dita e matjes' })).getByRole('radio', { name: 'E hënë' }))
    expect(await within(group).findByRole('button', { name: 'Dita e matjes, E hënë' })).toBeInTheDocument()
    expect((await data.store.all('user_settings'))[0].measurement_day).toBe(1)
  })
})
