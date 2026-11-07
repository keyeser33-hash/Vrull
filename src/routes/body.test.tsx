import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect, useState } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { Tone } from '@/body/model-math'
import type { LocalStore } from '@/data/store'

interface ModelProps {
  paint: (key: string) => Tone | null
  onPick: (key: string | null) => void
  back: boolean
  onBackChange: (back: boolean) => void
  focus?: string[] | null
  focusRequest?: number
  overlay?: React.ReactNode
  label: string
}

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

// WebGL mungon te jsdom: flamuri e zgjedh. Modeli 3D zëvendësohet me një stub që tregon ngjyrën
// e çdo çelësi dhe e "prek" atë si muskul.
const gl = vi.hoisted(() => ({ available: false }))
vi.mock('@/lib/webgl', () => ({ webglAvailable: () => gl.available }))
vi.mock('@/components/body/body-model', () => ({
  default: ({ paint, onPick, back, onBackChange, focus, focusRequest, overlay, label }: ModelProps) => (
    <div>
      <div role="img" aria-label={label}>
        <p>{back ? 'modeli mbrapa' : 'modeli përpara'}</p>
        <p>{focus ? `fokusi ${focus.join(' ')} · kërkesa ${focusRequest}` : 'pa fokus'}</p>
        {['pectoralis_major_sternocostal', 'gastrocnemius'].map((key) => (
          <button key={key} type="button" onClick={() => onPick(key)}>
            {`${key} ${paint(key)?.token ?? 'pa'} ${paint(key)?.alpha ?? 0}`}
          </button>
        ))}
        <button type="button" onClick={() => onPick(null)}>
          prek jashtë trupit
        </button>
        <button type="button" onClick={() => onBackChange(!back)}>
          zvarrit gjysmë rrotullimi
        </button>
      </div>
      {overlay}
    </div>
  ),
}))

describe('Trupi', () => {
  beforeEach(() => {
    gl.available = false
    localStorage.clear()
  })

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
    expect(screen.getByRole('list', { name: 'Legjenda' })).toHaveTextContent('Nën 10')
    expect(within(list).getAllByRole('button')[0]).toHaveTextContent('Nën objektiv')

    // Fleta: setet kundrejt objektivit dhe ndarja sipas pjesëve të grupit.
    await user.click(within(list).getAllByRole('button')[0])
    const sheet = screen.getByRole('dialog', { name: 'Gjoksi' })
    expect(sheet).toHaveTextContent('Nën objektiv · 10–20')
    const parts = within(sheet).getByRole('heading', { name: 'Pjesët këtë javë' }).nextElementSibling as HTMLElement
    expect(within(parts).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Gjoksi i sipërm1,5 sete',
      'Gjoksi i mesëm dhe i poshtëm3 sete',
      'Pectoralis minorPa sete',
    ])
    expect(sheet).not.toHaveTextContent('Pa ndarje sipas pjesëve')
  })

  it('volumi: grupi me një pjesë nuk e ndan fletën; pa sete thuhet një herë', async () => {
    const user = userEvent.setup()
    await renderPage()
    const list = await screen.findByRole('region', { name: 'Muskujt' })
    await user.click(screen.getByRole('button', { name: 'Volumi javor' }))
    const calves = await within(list).findByRole('button', { name: 'Pulpat, Pa sete' })
    expect(calves).toHaveTextContent('Nën objektiv')
    expect(calves.textContent!.match(/Pa sete/g)).toHaveLength(1)
    await user.click(within(list).getByRole('button', { name: /^Tricepsi, / }))
    const sheet = screen.getByRole('dialog', { name: 'Tricepsi' })
    expect(sheet).toHaveTextContent('1,5 sete')
    expect(within(sheet).queryByRole('heading', { name: 'Pjesët këtë javë' })).not.toBeInTheDocument()
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

  it('pa WebGL mbetet figura 2D, edhe me 3D të ruajtur, dhe modeli nuk ofrohet', async () => {
    localStorage.setItem('th-body-view', '3d')
    await renderPage()
    await screen.findByRole('group', { name: 'Rikuperimi sipas muskujve' })
    expect(screen.queryByRole('button', { name: '3D' })).not.toBeInTheDocument()
  })

  it('modeli 3D: të njëjtat ngjyra, prekja hap muskulin, zgjedhja mbahet', async () => {
    gl.available = true
    const user = userEvent.setup()
    await renderPage()
    expect(await screen.findByRole('button', { name: '2D' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: '3D' }))
    const model = await screen.findByRole('img', { name: 'Rikuperimi sipas muskujve' })
    expect(within(model).getByText('pectoralis_major_sternocostal --brand 1')).toBeInTheDocument()
    expect(within(model).getByText('gastrocnemius --panel-muted-foreground 0.35')).toBeInTheDocument()
    expect(localStorage.getItem('th-body-view')).toBe('3d')

    await user.click(screen.getByRole('button', { name: 'Volumi javor' }))
    expect(await within(model).findByText('pectoralis_major_sternocostal --brand 0.3')).toBeInTheDocument()
    expect(within(model).getByText('gastrocnemius pa 0')).toBeInTheDocument()

    // Prekja e muskulit: fokusi te grupi, emri i pjesës dhe "Më shumë" që hap fletën.
    await user.click(within(model).getByText(/^gastrocnemius/))
    expect(model).toHaveTextContent('fokusi gastrocnemius soleus · kërkesa 1')
    // E njëjta prekje përsëri (p.sh. pas një rrotullimi) e afron sërish kamerën.
    await user.click(within(model).getByText(/^gastrocnemius/))
    expect(model).toHaveTextContent('fokusi gastrocnemius soleus · kërkesa 2')
    const chip = screen.getByRole('group', { name: 'Muskuli i zgjedhur' })
    expect(chip).toHaveTextContent('Pulpat')
    expect(chip).toHaveTextContent('Gastroknemiusi · Pa sete')
    await user.click(within(chip).getByRole('button', { name: 'Më shumë për Pulpat' }))
    expect(screen.getByRole('dialog', { name: 'Pulpat' })).toHaveTextContent('Gastrocnemius, soleus')
  })

  it('modeli 3D: prekja jashtë trupit e heq fokusin', async () => {
    localStorage.setItem('th-body-view', '3d')
    gl.available = true
    const user = userEvent.setup()
    await renderPage()
    const model = await screen.findByRole('img', { name: 'Rikuperimi sipas muskujve' })
    await user.click(within(model).getByText(/^pectoralis_major_sternocostal/))
    expect(screen.getByRole('group', { name: 'Muskuli i zgjedhur' })).toHaveTextContent('Gjoksi i mesëm dhe i poshtëm · I lodhur')
    await user.click(within(model).getByRole('button', { name: 'prek jashtë trupit' }))
    expect(model).toHaveTextContent('pa fokus')
    expect(screen.queryByRole('group', { name: 'Muskuli i zgjedhur' })).not.toBeInTheDocument()
    // Edhe "×" te emri e heq fokusin (kur modeli është zmadhuar, jashtë trupit s'ka vend bosh).
    await user.click(within(model).getByText(/^pectoralis_major_sternocostal/))
    await user.click(within(screen.getByRole('group', { name: 'Muskuli i zgjedhur' })).getByRole('button', { name: 'Hiq fokusin' }))
    expect(model).toHaveTextContent('pa fokus')
  })

  it('zgjedhja 3D e ruajtur hapet vetë', async () => {
    localStorage.setItem('th-body-view', '3d')
    gl.available = true
    await renderPage()
    expect(await screen.findByRole('img', { name: 'Rikuperimi sipas muskujve' })).toBeInTheDocument()
  })

  it('"Shiko mbrapa" e kthen modelin; pas zvarritjes butoni ndjek anën që duket', async () => {
    localStorage.setItem('th-body-view', '3d')
    gl.available = true
    const user = userEvent.setup()
    await renderPage()
    const model = await screen.findByRole('img', { name: 'Rikuperimi sipas muskujve' })
    expect(model).toHaveTextContent('modeli përpara')
    await user.click(screen.getByRole('button', { name: 'Shiko mbrapa' }))
    expect(model).toHaveTextContent('modeli mbrapa')
    await user.click(within(model).getByRole('button', { name: 'zvarrit gjysmë rrotullimi' }))
    expect(model).toHaveTextContent('modeli përpara')
    expect(screen.getByRole('button', { name: 'Shiko mbrapa' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '2D' }))
    expect(screen.queryByRole('button', { name: 'Shiko mbrapa' })).not.toBeInTheDocument()
    expect(localStorage.getItem('th-body-view')).toBe('2d')
  })
})
