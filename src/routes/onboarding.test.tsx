import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { OnboardingPage } from './onboarding'

// Një store i vërtetë (IndexedDB në memorie) me një përdorues të hyrë.
const data = vi.hoisted(() => ({ store: null as unknown }))
vi.mock('@/data/app-data', async () => {
  const { createDatabase } = await import('@/data/db')
  const { createLocalStore } = await import('@/data/store')
  data.store = createLocalStore(createDatabase(`onboarding-${crypto.randomUUID()}`), {
    userId: () => '11111111-1111-4111-8111-111111111111',
  })
  return { store: data.store }
})

function renderOnboarding() {
  const router = createMemoryRouter(
    [
      { path: '/fillimi', element: <OnboardingPage /> },
      { path: '/', element: <h1>Sot</h1> },
    ],
    { initialEntries: ['/fillimi'] },
  )
  render(<RouterProvider router={router} />)
  return router
}

describe('hapat e hyrjes së parë', () => {
  it('kalon katër hapat, ruan profilin dhe hap Sot', async () => {
    const router = renderOnboarding()
    const user = userEvent.setup()

    expect(screen.getByText('Hapi 1 nga 4')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Sa peshon sot?' })).toBeInTheDocument()
    await user.type(screen.getByLabelText('Pesha (kg)'), '80,5')
    await user.click(screen.getByRole('button', { name: 'Vazhdo' }))

    expect(screen.getByRole('heading', { level: 1, name: 'Kur stërvitesh?' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'E hënë' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'E mërkurë' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByLabelText('Ora e zakonshme e stërvitjes')).toHaveValue('18:00')
    await user.click(screen.getByRole('button', { name: 'Vazhdo' }))

    expect(screen.getByRole('heading', { level: 1, name: 'Kur zgjohesh dhe kur fle?' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Vazhdo' }))

    expect(screen.getByText('Hapi 4 nga 4')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Shortcut to Size' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Fillo programin' }))
    // Ekrani pret derisa porta ta çojë te Sot (shih gate.test.tsx).
    expect(await screen.findByRole('button', { name: 'Po ruhet' })).toBeDisabled()
    expect(router.state.location.pathname).toBe('/fillimi')

    const { readProfile } = await import('@/data/profile')
    const { trainingSnapshot } = await import('@/data/training')
    const store = data.store as Parameters<typeof readProfile>[0]
    await vi.waitFor(async () => expect((await store.all('user_settings'))[0]?.onboarded_at).toBeTruthy())
    expect(await readProfile(store)).toEqual({
      weightKg: 80.5,
      trainingDays: [1, 2, 4, 5],
      trainingTime: '18:00',
      wakeTime: '07:00',
      sleepTime: '23:00',
    })
    expect(await trainingSnapshot(store)).toMatchObject({ label: 'Java 0', plan: { dayNumber: 1 } })
  })

  it('pesha e pavlefshme ndal hapin dhe e thotë nën fushë', async () => {
    renderOnboarding()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Pesha (kg)'), '8')
    await user.click(screen.getByRole('button', { name: 'Vazhdo' }))
    expect(screen.getByLabelText('Pesha (kg)')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Pesha (kg)')).toHaveAccessibleDescription(/mes 30 dhe 300 kg/)
    expect(screen.getByText('Hapi 1 nga 4')).toBeInTheDocument()
  })

  it('pa asnjë ditë stërvitjeje nuk vazhdon; butoni mbrapa kthen te hapi i mëparshëm', async () => {
    renderOnboarding()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Pesha (kg)'), '80')
    await user.click(screen.getByRole('button', { name: 'Vazhdo' }))
    for (const day of ['E hënë', 'E martë', 'E enjte', 'E premte']) {
      await user.click(screen.getByRole('button', { name: day }))
    }
    await user.click(screen.getByRole('button', { name: 'Vazhdo' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Zgjidh të paktën një ditë stërvitjeje.')

    await user.click(screen.getByRole('button', { name: 'Kthehu te hapi i mëparshëm' }))
    expect(screen.getByLabelText('Pesha (kg)')).toHaveValue('80')
  })
})
