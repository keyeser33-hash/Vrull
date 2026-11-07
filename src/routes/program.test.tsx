import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect, useState } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { LocalStore } from '@/data/store'

// Programi, stërvitja e një jave dhe ekrani i ushtrimit, me store të vërtetë.
const data = vi.hoisted(() => ({ store: null as unknown as LocalStore }))
vi.mock('@/data/app-data', async () => {
  const { createDatabase } = await import('@/data/db')
  const { createLocalStore } = await import('@/data/store')
  const store = createLocalStore(createDatabase(`program-${crypto.randomUUID()}`), { userId: () => '11111111-1111-4111-8111-111111111111' })
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

async function renderAt(path: string) {
  const { ExercisePage, ProgramPage, WorkoutPage } = await import('./program')
  const router = createMemoryRouter(
    [
      { path: '/programi', element: <ProgramPage /> },
      { path: '/programi/:blockId/:week/:dayId', element: <WorkoutPage /> },
      { path: '/ushtrimi/:exerciseId', element: <ExercisePage /> },
    ],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />)
  return router
}

describe('Programi', () => {
  beforeAll(async () => {
    await import('@/data/app-data')
    const { completeOnboarding } = await import('@/data/profile')
    await completeOnboarding(data.store, { weightKg: 80, trainingDays: [1, 2, 4, 5], trainingTime: '18:00', wakeTime: '07:00', sleepTime: '23:00' })
  })

  it('paneli i ecurisë, javët dhe stërvitjet e javës me gjendjen', async () => {
    const user = userEvent.setup()
    await renderAt('/programi')
    expect(await screen.findByRole('heading', { level: 1, name: 'Shortcut to Size' })).toBeInTheDocument()
    expect(screen.getByText('0 nga 52 stërvitje')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Java 0' })).toHaveAttribute('aria-pressed', 'true')
    const week = screen.getByRole('region', { name: 'Java 0' })
    const cards = within(week).getAllByRole('link')
    expect(cards).toHaveLength(4)
    expect(cards[0]).toHaveTextContent('Stërvitja 1')
    expect(cards[0]).toHaveTextContent('E radhës')
    expect(cards[0]).toHaveTextContent('9 ushtrime · 21 sete')
    await user.click(screen.getByRole('button', { name: 'Faza 1 · Java 1' }))
    expect(screen.getByRole('region', { name: 'Faza 1 · Java 1' })).toHaveTextContent('9 ushtrime · 30 sete')
  })

  it('stërvitja e një jave: ushtrimet me setet dhe teknikën e setit të fundit', async () => {
    const { programView } = await import('@/data/training')
    const view = (await programView(data.store))!
    const week = view.overview.weeks[1]
    await renderAt(`/programi/${week.blockId}/1/${week.days[0].dayId}`)
    expect(await screen.findByRole('heading', { level: 1, name: 'Stërvitja 1' })).toBeInTheDocument()
    const rows = screen.getAllByRole('listitem')
    expect(rows).toHaveLength(9)
    expect(rows[0]).toHaveTextContent('Bench Press')
    expect(rows[0]).toHaveTextContent('4 × 12–15 · seti i fundit rest-pause')
  })

  it('ushtrimi: muskujt me fjalë, videoja nga link-u, historia', async () => {
    const { programView } = await import('@/data/training')
    const view = (await programView(data.store))!
    const bench = Object.values(view.exercises).find((exercise) => exercise.name === 'Bench Press')!
    const user = userEvent.setup()
    await renderAt(`/ushtrimi/${bench.id}`)
    expect(await screen.findByRole('heading', { level: 1, name: 'Bench Press' })).toBeInTheDocument()
    expect(screen.getByText('Kryesorë: gjoksi. Ndihmës: shpatullat, tricepsi.')).toBeInTheDocument()
    expect(screen.getAllByText('Ende pa sete')).toHaveLength(3)
    await user.click(screen.getByRole('button', { name: 'Shiko muskujt' }))
    const muscles = screen.getByRole('dialog', { name: 'Muskujt e Bench Press' })
    expect(within(muscles).getByRole('region', { name: 'Ndihmës' })).toHaveTextContent('Tricepsi')
    await user.click(within(muscles).getByRole('button', { name: 'Mbyll' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Shto video' }))
    const sheet = screen.getByRole('dialog', { name: 'Videoja e ushtrimit' })
    await user.type(within(sheet).getByLabelText('Link-u i YouTube'), 'https://vimeo.com/1')
    await user.click(within(sheet).getByRole('button', { name: 'Ruaj' }))
    expect(within(sheet).getByRole('alert')).toHaveTextContent('Ky nuk është link videoje YouTube')
    await user.clear(within(sheet).getByLabelText('Link-u i YouTube'))
    await user.type(within(sheet).getByLabelText('Link-u i YouTube'), 'https://youtu.be/dQw4w9WgXcQ')
    await user.click(within(sheet).getByRole('button', { name: 'Ruaj' }))
    const video = await screen.findByTitle('Videoja e Bench Press')
    expect(video).toHaveAttribute('src', expect.stringContaining('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'))
    expect(screen.getByRole('link', { name: 'Hap në YouTube' })).toHaveAttribute('href', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')
  })
})
