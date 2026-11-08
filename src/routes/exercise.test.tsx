import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { LocalStore } from '@/data/store'
import { language } from '@/i18n/language'
import { sampleWeek, type TestClock } from './programme-test-setup'

// Faqja e ushtrimit (bordi "Ushtrimi", V2-E1-09): foto bardh e zi, muskujt, rekordet me grafikun e
// e1RM-së, historia e seteve dhe videoja; edhe për ushtrimet e bibliotekës që s'janë në telefon.
const data = vi.hoisted(() => ({ store: null as unknown as LocalStore, clock: { date: new Date() } as TestClock }))
vi.mock('@/data/app-data', async () => {
  const { createDatabase } = await import('@/data/db')
  const { createLocalStore } = await import('@/data/store')
  const store = createLocalStore(createDatabase(`exercise-${crypto.randomUUID()}`), {
    userId: () => '11111111-1111-4111-8111-111111111111',
    now: () => data.clock.date,
  })
  data.store = store
  return {
    store,
    useLocalQuery: (await import('@/test/local-query')).useLocalQueryFor(store),
  }
})

async function benchId() {
  const { exerciseCatalog } = await import('@/data/exercises')
  return (await exerciseCatalog(data.store)).items.find((item) => item.name === 'Bench Press')!.exerciseId!
}

async function renderAt(path: string) {
  const { ExercisePage } = await import('./exercise')
  const router = createMemoryRouter([{ path: '/ushtrimi/:exerciseId', element: <ExercisePage /> }], { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

describe('Ushtrimi', () => {
  // Foto e një ushtrimi jashtë Shortcut to Size merret nga interneti: në prova nuk ka rrjet.
  const fetchPhoto = vi.fn(async () => {
    throw new Error('pa rrjet në prova')
  })
  beforeAll(async () => {
    await import('@/data/app-data')
    await sampleWeek(data.store, data.clock)
  })
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchPhoto)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    act(() => language.set('sq'))
  })

  it('Bench Press: foto e paketuar, muskujt, rekordet dhe historia si te bordi', async () => {
    const user = userEvent.setup()
    await renderAt(`/ushtrimi/${await benchId()}`)
    expect(await screen.findByRole('heading', { level: 1, name: 'Bench Press' })).toBeInTheDocument()
    expect(screen.getByText('Gjoksi · shufër · 4 sete te Shortcut to Size')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Bench Press, foto bardh e zi nga free-exercise-db' })).toHaveAttribute(
      'src',
      '/exercise-photos/Barbell_Bench_Press_-_Medium_Grip.jpg',
    )
    expect(fetchPhoto).not.toHaveBeenCalled()

    const muscles = screen.getByRole('region', { name: 'Muskujt' })
    expect(muscles).toHaveTextContent('KryesorGjoksi')
    expect(muscles).toHaveTextContent('NdihmësShpatullat, tricepsi')

    const records = screen.getByRole('region', { name: 'Rekordet e tua' })
    expect(records).toHaveTextContent('86kge1RM')
    expect(records).toHaveTextContent('+9,3 kg nga Java 0')
    expect(within(records).getByRole('img')).toHaveAccessibleName('e1RM sipas javës: Java 0 76,7\u00A0kg, Java 1 86\u00A0kg')
    expect(records).toHaveTextContent('Pesha më e madhe60 kg × 13')

    const history = screen.getByRole('region', { name: 'Historia e seteve' })
    const sessions = within(history).getAllByRole('listitem')
    expect(sessions[0]).toHaveTextContent('60 kg × 13E diel, 1 nëntor · Java 1')
    expect(sessions[1]).toHaveTextContent('50 kg × 14E diel, 25 tetor · Java 0')

    await user.click(within(muscles).getByRole('button', { name: 'Rrotullo në 3D' }))
    const sheet = screen.getByRole('dialog', { name: 'Muskujt e Bench Press' })
    await user.click(within(sheet).getByRole('button', { name: 'Mbyll' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('videoja: shtohet me lidhje YouTube, shfaqet brenda dhe hapet jashtë app-it', async () => {
    const user = userEvent.setup()
    await renderAt(`/ushtrimi/${await benchId()}`)
    await user.click(await screen.findByRole('button', { name: /Shto video nga YouTube/ }))
    const sheet = screen.getByRole('dialog', { name: 'Videoja e ushtrimit' })
    await user.type(within(sheet).getByLabelText('Lidhja e YouTube'), 'https://vimeo.com/1')
    await user.click(within(sheet).getByRole('button', { name: 'Ruaj' }))
    expect(within(sheet).getByRole('alert')).toHaveTextContent('Kjo nuk është lidhje videoje YouTube')
    await user.clear(within(sheet).getByLabelText('Lidhja e YouTube'))
    await user.type(within(sheet).getByLabelText('Lidhja e YouTube'), 'https://youtu.be/dQw4w9WgXcQ')
    await user.click(within(sheet).getByRole('button', { name: 'Ruaj' }))
    expect(await screen.findByTitle('Videoja e Bench Press')).toHaveAttribute('src', expect.stringContaining('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'))
    expect(screen.getByRole('link', { name: /Shiko videon në YouTube/ })).toHaveAttribute('href', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    expect(screen.getByRole('button', { name: 'Ndrysho videon' })).toBeInTheDocument()
  })

  it('ushtrim i bibliotekës që s’është në telefon: "Pa foto" pa rrjet, muskujt nga grupet, pa rekorde', async () => {
    await renderAt('/ushtrimi/Arnold_Dumbbell_Press')
    expect(await screen.findByRole('heading', { level: 1, name: 'Arnold Dumbbell Press' })).toBeInTheDocument()
    expect(screen.getByText('Shpatullat · dumbbell')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('Pa foto')).toBeInTheDocument())
    expect(screen.queryByRole('img', { name: /foto bardh e zi/ })).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Rekordet e tua' })).toHaveTextContent('Rekordet dalin pas setit të parë me peshë.')
    expect(screen.queryByRole('region', { name: 'Historia e seteve' })).not.toBeInTheDocument()
  })

  it('ushtrim që nuk gjendet', async () => {
    await renderAt('/ushtrimi/nuk-ekziston')
    expect(await screen.findByText('Ky ushtrim nuk gjendet.')).toBeInTheDocument()
  })

  it('anglisht', async () => {
    act(() => language.set('en'))
    await renderAt(`/ushtrimi/${await benchId()}`)
    expect(await screen.findByText('Chest · barbell · 4 sets in Shortcut to Size')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Muscles' })).toHaveTextContent('PrimaryChest')
    const records = screen.getByRole('region', { name: 'Your records' })
    expect(records).toHaveTextContent('+9.3 kg since Week 0')
    expect(records).toHaveTextContent('Heaviest set60 kg × 13')
    expect(screen.getByRole('region', { name: 'Set history' })).toHaveTextContent('Sunday, 1 November · Week 1')
    expect(screen.getByRole('button', { name: 'Rotate in 3D' })).toBeInTheDocument()
  })
})
