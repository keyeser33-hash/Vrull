import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect, useState } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { LocalStore } from '@/data/store'

// Trupi me store të vërtetë: rikuperimi dhe volumi pas një seance, prekja e një muskuli.
const data = vi.hoisted(() => ({ store: null as unknown as LocalStore }))
vi.mock('@/data/app-data', async () => {
  const { createDatabase } = await import('@/data/db')
  const { createLocalStore } = await import('@/data/store')
  const store = createLocalStore(createDatabase(`body-ui-${crypto.randomUUID()}`), { userId: () => '11111111-1111-4111-8111-111111111111' })
  data.store = store
  return {
    store,
    useLocalQuery<T>(query: () => Promise<T>) {
      const [value, setValue] = useState<T>()
      useEffect(() => {
        void query().then((result) => setValue(() => result))
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [])
      return value
    },
  }
})

describe('Trupi', () => {
  beforeAll(async () => {
    await import('@/data/app-data')
    const { completeOnboarding } = await import('@/data/profile')
    const { finishWorkout, saveSet, startWorkout, trainingSnapshot } = await import('@/data/training')
    await completeOnboarding(data.store, { weightKg: 80, trainingDays: [1, 2, 4, 5], trainingTime: '18:00', wakeTime: '07:00', sleepTime: '23:00' })
    const sessionId = await startWorkout(data.store)
    const [bench] = (await trainingSnapshot(data.store))!.plan.slots
    for (let number = 1; number <= 3; number++) await saveSet(data.store, { sessionId, slot: bench, setNumber: number, weightKg: 60, reps: 12 })
    await finishWorkout(data.store, sessionId)
  })

  async function renderPage() {
    const { BodyPage } = await import('./body')
    const router = createMemoryRouter([{ path: '/trupi', element: <BodyPage /> }], { initialEntries: ['/trupi'] })
    render(<RouterProvider router={router} />)
  }

  it('rikuperimi: gjoksi i lodhur i pari, me fjalë; volumi: setet e javës', async () => {
    const user = userEvent.setup()
    await renderPage()
    const list = await screen.findByRole('region', { name: 'Muskujt' })
    const [first] = within(list).getAllByRole('button')
    expect(first).toHaveAccessibleName('Gjoksi, I lodhur')
    expect(within(screen.getByRole('list', { name: 'Legjenda' })).getByText(/I lodhur · nën 48 orë/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Volumi javor' }))
    await waitFor(() => expect(within(list).getAllByRole('button')[0]).toHaveAccessibleName('Gjoksi, 3 sete'))
    expect(screen.getByRole('list', { name: 'Legjenda' })).toHaveTextContent('1–5 sete')
  })

  it('prekja e muskulit në figurë: emri latinisht, funksioni dhe ushtrimet e bibliotekës', async () => {
    const user = userEvent.setup()
    await renderPage()
    const figure = await screen.findByRole('group', { name: 'Rikuperimi sipas muskujve' })
    await user.click(within(figure).getAllByRole('button', { name: 'Pulpat, Gati' })[0])
    const sheet = screen.getByRole('dialog', { name: 'Pulpat' })
    expect(sheet).toHaveTextContent('Gastrocnemius, soleus')
    expect(sheet).toHaveTextContent('Pa stërvitje të regjistruar')
    expect((await within(sheet).findAllByText(/Calf Raise/)).length).toBeGreaterThan(0)
  })
})
