import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect, useState } from 'react'
import { createMemoryRouter, RouterProvider, useParams } from 'react-router'
import type { LocalStore } from '@/data/store'
import { language } from '@/i18n/language'

// "Krijo ushtrim" (bordi "KrijoUshtrim", V2-E1-09): emri i ri, pajisja, muskujt me volumin javor,
// mënyra e regjistrimit, videoja dhe si del te biblioteka.
const data = vi.hoisted(() => ({ store: null as unknown as LocalStore }))
vi.mock('@/data/app-data', async () => {
  const { createDatabase } = await import('@/data/db')
  const { createLocalStore } = await import('@/data/store')
  const store = createLocalStore(createDatabase(`create-${crypto.randomUUID()}`), { userId: () => '11111111-1111-4111-8111-111111111111' })
  data.store = store
  return {
    store,
    useLocalQuery<T>(query: () => Promise<T>) {
      const [value, setValue] = useState<T>()
      useEffect(() => {
        let alive = true
        void query().then((result) => alive && setValue(() => result))
        return () => {
          alive = false
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [])
      return value
    },
  }
})

function Created() {
  const { exerciseId } = useParams()
  return <h1>{`Ushtrimi ${exerciseId}`}</h1>
}

async function renderCreate() {
  const { CreateExercisePage } = await import('./exercise-create')
  const router = createMemoryRouter(
    [
      { path: '/programi/biblioteka/krijo', element: <CreateExercisePage /> },
      { path: '/ushtrimi/:exerciseId', element: <Created /> },
    ],
    { initialEntries: ['/programi/biblioteka/krijo'] },
  )
  render(<RouterProvider router={router} />)
  // Pritet biblioteka, që kontrolli i emrit ta ketë.
  await screen.findByRole('button', { name: 'Ruaj ushtrimin' })
  await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Ruaj ushtrimin' })).toBeEnabled())
  return router
}

describe('Krijo ushtrim', () => {
  beforeAll(async () => {
    await import('@/data/app-data')
    const { completeOnboarding } = await import('@/data/profile')
    await completeOnboarding(data.store, { weightKg: 80, trainingDays: [7, 1, 2, 4], trainingTime: '17:15', wakeTime: '07:00', sleepTime: '23:00' })
  })
  afterEach(() => act(() => language.set('sq')))

  it('emri: i zënë nga biblioteka ose i ri', async () => {
    const user = userEvent.setup()
    await renderCreate()
    const name = screen.getByLabelText('Emri')
    expect(name).toHaveAccessibleDescription('Shkruaj emrin në anglisht, si emrat e bibliotekës.')
    await user.type(name, 'bench press')
    expect(name).toHaveAccessibleDescription('Ky emër është në bibliotekë')
    expect(name).toHaveAttribute('aria-invalid', 'true')
    await user.clear(name)
    await user.type(name, 'Landmine Press')
    expect(name).toHaveAccessibleDescription('Emër i ri · në anglisht, si emrat e bibliotekës.')
  })

  it('muskujt: prekja kalon kryesor → ndihmës → hiq, dhe volumi javor e thotë', async () => {
    const user = userEvent.setup()
    await renderCreate()
    await user.type(screen.getByLabelText('Emri'), 'Landmine Press')
    const groups = screen.getByRole('group', { name: 'Grupet e muskujve, nga koka te këmbët' })
    await user.click(within(groups).getByRole('button', { name: 'Shpatullat: pa zgjedhur' }))
    await user.click(within(groups).getByRole('button', { name: 'Gjoksi: pa zgjedhur' }))
    await user.click(within(groups).getByRole('button', { name: 'Gjoksi: kryesor, një set' }))
    await user.click(within(groups).getByRole('button', { name: 'Tricepsi: pa zgjedhur' }))
    await user.click(within(groups).getByRole('button', { name: 'Tricepsi: kryesor, një set' }))
    expect(within(groups).getByRole('button', { name: 'Gjoksi: ndihmës, gjysmë seti' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Çdo set Landmine Press te volumi javorShpatullat +1Gjoksi +0,5Tricepsi +0,5')
    // Prekja e tretë e heq.
    await user.click(within(groups).getByRole('button', { name: 'Tricepsi: ndihmës, gjysmë seti' }))
    expect(within(groups).getByRole('button', { name: 'Tricepsi: pa zgjedhur' })).toBeInTheDocument()
    const preview = screen.getByRole('region', { name: 'Kështu del në bibliotekë' })
    expect(preview).toHaveTextContent('Landmine PressShpatullat · gjoksiI yti')
  })

  it('ruhet dhe hap faqen e ushtrimit; pa muskul kryesor nuk ruhet', async () => {
    const user = userEvent.setup()
    await renderCreate()
    await user.type(screen.getByLabelText('Emri'), 'Landmine Row')
    await user.click(screen.getByRole('button', { name: 'Ruaj ushtrimin' }))
    expect(screen.getByRole('status')).toHaveTextContent('Zgjidh të paktën një muskul kryesor.')
    expect(await data.store.all('exercises')).toHaveLength(66)

    await user.click(screen.getByRole('radio', { name: 'Dumbbell' }))
    expect(screen.getByText('Hapi i peshës për këtë pajisje: 2 kg.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Shpina: pa zgjedhur' }))
    await user.click(screen.getByRole('radio', { name: /Pa peshë/ }))
    expect(screen.getByText('Pa peshë regjistrohen përsëritjet, me peshën shtesë kur ka.')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Video në YouTube · opsionale'), 'https://youtu.be/dQw4w9WgXcQ')
    await user.click(screen.getByRole('button', { name: 'Ruaj ushtrimin' }))
    const heading = await screen.findByRole('heading', { name: /^Ushtrimi / })
    const id = heading.textContent!.replace('Ushtrimi ', '')
    expect(await data.store.get('exercises', id)).toMatchObject({
      name: 'Landmine Row',
      equipment: 'dumbbell',
      tracking: 'bodyweight_reps',
      primary_muscles: ['latissimus_dorsi', 'rhomboid_major', 'rhomboid_minor', 'teres_major', 'infraspinatus'],
      secondary_muscles: [],
      video_url: 'https://youtu.be/dQw4w9WgXcQ',
    })
  })

  it('anglisht', async () => {
    act(() => language.set('en'))
    const user = userEvent.setup()
    const { CreateExercisePage } = await import('./exercise-create')
    render(
      <RouterProvider router={createMemoryRouter([{ path: '/', element: <CreateExercisePage /> }])} />,
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Create exercise' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Shoulders: not selected' }))
    expect(screen.getByRole('status')).toHaveTextContent('Each set in weekly volumeShoulders +1')
    expect(screen.getByRole('radio', { name: /Weighted/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText('Weighted sets give the e1RM and the suggested weight.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save exercise' })).toBeInTheDocument()
  })
})
