import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect, useState } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { Tone } from '@/body/model-math'
import type { LocalStore } from '@/data/store'
import { language } from '@/i18n'

interface ModelProps {
  paint: (key: string) => Tone | null
  onPick: (key: string | null) => void
  controls?: boolean
  focus?: string[] | null
  focusRequest?: number
  overlay?: React.ReactNode
  overlayAt?: 'top' | 'bottom' | 'card'
  leader?: boolean
  label: string
}

// Trupi (bordet "Trupi", Natë, Ditë) me store të vërtetë: rikuperimi dhe volumi pas një seance,
// prekja e një muskuli, fleta e grupit, figura 2D pa WebGL dhe anglishtja.
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
const gl = vi.hoisted(() => ({ available: true }))
vi.mock('@/lib/webgl', () => ({ webglAvailable: () => gl.available }))
vi.mock('@/components/body/body-model', () => ({
  default: ({ paint, onPick, controls, focus, focusRequest, overlay, overlayAt, leader, label }: ModelProps) => (
    <div>
      <div role="img" aria-label={label}>
        <p>{controls ? 'kamera e lirë me shinë' : 'pa shinë'}</p>
        <p>{focus ? `fokusi ${focus.join(' ')} · kërkesa ${focusRequest}` : 'pa fokus'}</p>
        <p>{`mbishtresa ${overlayAt ?? 'poshtë'}${leader ? ' me vijë' : ''}`}</p>
        {['pectoralis_major_sternocostal', 'gastrocnemius'].map((key) => (
          <button key={key} type="button" onClick={() => onPick(key)}>
            {`${key} ${paint(key)?.token ?? 'pa'} ${paint(key)?.alpha ?? 0}${paint(key)?.glow ? ` ndriçon ${paint(key)?.glow}` : ''}`}
          </button>
        ))}
        <button type="button" onClick={() => onPick(null)}>
          prek jashtë trupit
        </button>
      </div>
      {overlay}
    </div>
  ),
}))

describe('Trupi', () => {
  beforeEach(() => {
    gl.available = true
  })
  afterEach(() => language.set('sq'))

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

  async function renderPage(path = '/progresi/trupi') {
    const { BodyPage } = await import('./body')
    const router = createMemoryRouter([{ path: '/progresi/trupi', element: <BodyPage /> }], { initialEntries: [path] })
    render(<RouterProvider router={router} />)
    return router
  }

  it('kreu: Shtresat dhe Trupi sipas matjeve; rikuperimi: gjoksi i lodhur i pari, me fjalë', async () => {
    await renderPage()
    expect(await screen.findByRole('heading', { level: 1, name: 'Trupi' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Shtresat' })).toHaveAttribute('href', '/progresi/trupi/shtresat')
    expect(screen.getByRole('link', { name: 'Trupi sipas matjeve' })).toHaveAttribute('href', '/progresi/trupi/matjet')
    expect(await screen.findByRole('radio', { name: 'Rikuperimi' })).toHaveAttribute('aria-checked', 'true')
    const list = screen.getByRole('region', { name: 'Muskujt' })
    const [first] = within(list).getAllByRole('button')
    expect(first).toHaveAccessibleName('Gjoksi, I lodhur')
    expect(first).toHaveTextContent('Para 1 ore')
    expect(within(screen.getByRole('list', { name: 'Legjenda' })).getByText('I lodhur · nën 48 orë')).toBeInTheDocument()
    expect(list).toHaveTextContent('Sipas orëve nga stërvitja e fundit ku muskuli ishte kryesor.')
  })

  it('volumi: setet e javës, legjenda e objektivit, shënimi me burimin; fleta ndan grupin sipas pjesëve', async () => {
    const user = userEvent.setup()
    await renderPage()
    const list = await screen.findByRole('region', { name: 'Muskujt' })
    await user.click(screen.getByRole('radio', { name: 'Volumi javor' }))
    await waitFor(() => expect(within(list).getAllByRole('button')[0]).toHaveAccessibleName('Gjoksi, 3 sete'))
    expect(screen.getByRole('radio', { name: 'Volumi javor' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('list', { name: 'Legjenda' })).toHaveTextContent('Pa seteNën 1010–20 · objektiviMbi 20')
    expect(within(list).getAllByRole('button')[0]).toHaveTextContent('Nën objektiv')
    expect(list).toHaveTextContent(/setet e punës\. 15 grupe: 0 mbi objektiv, 0 në të, 15 nën të, si gjoksi dhe shpatullat\./)
    expect(list).toHaveTextContent('Objektivi 10–20: Schoenfeld et al. 2017; Baz-Valle et al. 2022.')

    await user.click(within(list).getAllByRole('button')[0])
    const sheet = screen.getByRole('dialog', { name: 'Gjoksi' })
    expect(sheet).toHaveTextContent('Nën objektiv · 10–20')
    expect(sheet).toHaveTextContent('Pectoralis major et minor')
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
    await renderPage('/progresi/trupi?pamja=volumi')
    const list = await screen.findByRole('region', { name: 'Muskujt' })
    const calves = within(list).getByRole('button', { name: 'Pulpat, Pa sete' })
    expect(calves).toHaveTextContent('Nën objektiv')
    expect(calves.textContent!.match(/Pa sete/g)).toHaveLength(1)
    await user.click(within(list).getByRole('button', { name: /^Tricepsi, / }))
    const sheet = screen.getByRole('dialog', { name: 'Tricepsi' })
    expect(sheet).toHaveTextContent('1,5 sete')
    expect(within(sheet).queryByRole('heading', { name: 'Pjesët këtë javë' })).not.toBeInTheDocument()
  })

  it('pa WebGL: figura 2D me të njëjtat ngjyra; prekja hap fletën me latinishten, funksionin dhe bibliotekën', async () => {
    gl.available = false
    const user = userEvent.setup()
    await renderPage()
    const figure = await screen.findByRole('group', { name: 'Rikuperimi sipas muskujve' })
    expect(screen.queryByRole('button', { name: 'Shiko mbrapa' })).not.toBeInTheDocument()
    await user.click(within(figure).getAllByRole('button', { name: 'Pulpat, Gati' })[0])
    const sheet = screen.getByRole('dialog', { name: 'Pulpat' })
    expect(sheet).toHaveTextContent('Gastrocnemius, soleus')
    expect(sheet).toHaveTextContent('Ngrenë thembrën dhe shtyjnë trupin përpara mbi gishtat.')
    expect(sheet).toHaveTextContent('Pa stërvitje të regjistruar')
    expect((await within(sheet).findAllByText(/Calf Raise/)).length).toBeGreaterThan(0)
  })

  it('modeli 3D: ngjyrat dhe shkëlqimi i Vrullit, karta poshtë me vijën, rreshti i ushtrimeve hap grupin', async () => {
    const user = userEvent.setup()
    await renderPage()
    const model = await screen.findByRole('img', { name: 'Rikuperimi sipas muskujve' })
    // I lodhur ndriçon plotësisht; gati mbetet i qetë (V53).
    expect(within(model).getByText('pectoralis_major_sternocostal --ember 1 ndriçon 1')).toBeInTheDocument()
    expect(within(model).getByText('gastrocnemius --muted-foreground 0.35')).toBeInTheDocument()
    expect(model).toHaveTextContent('mbishtresa card me vijë')

    await user.click(screen.getByRole('radio', { name: 'Volumi javor' }))
    // 3 sete: nën 10, `volume-1` me pak dritë; pa sete: `subtle`, pa dritë.
    expect(await within(model).findByText('pectoralis_major_sternocostal --volume-1 1 ndriçon 0.12')).toBeInTheDocument()
    expect(within(model).getByText('gastrocnemius --subtle 1')).toBeInTheDocument()

    // Prekja e muskulit: fokusi te grupi dhe karta me rikuperimin dhe javën e tij.
    await user.click(within(model).getByText(/^gastrocnemius/))
    expect(model).toHaveTextContent('fokusi gastrocnemius soleus · kërkesa 1')
    // E njëjta prekje përsëri (p.sh. pas një rrotullimi) e afron sërish kamerën.
    await user.click(within(model).getByText(/^gastrocnemius/))
    expect(model).toHaveTextContent('fokusi gastrocnemius soleus · kërkesa 2')
    const card = screen.getByRole('group', { name: 'Muskuli i zgjedhur' })
    expect(card).toHaveTextContent('Pulpat')
    expect(card).toHaveTextContent('Gati · pa stërvitje')
    expect(card).toHaveTextContent('Këtë javë pa sete · nën objektiv')
    // Rreshti i fundit: ushtrimet e programit për pulpat këtë javë; hap fletën e grupit.
    const more = within(card).getByRole('button', { name: /Më shumë për Pulpat$/ })
    expect(more).toHaveTextContent(/Calf Raise/)
    await user.click(more)
    const sheet = screen.getByRole('dialog', { name: 'Pulpat' })
    expect(sheet).toHaveTextContent('Gastrocnemius, soleus')
    const program = within(sheet).getByRole('heading', { name: 'Te programi yt këtë javë' }).nextElementSibling as HTMLElement
    expect(within(program).getAllByRole('listitem').some((item) => /Calf Raise/.test(item.textContent ?? ''))).toBe(true)
  })

  it('modeli 3D: karta e gjoksit thotë rikuperimin dhe javën bashkë; prekja jashtë trupit dhe "×" e heqin fokusin', async () => {
    const user = userEvent.setup()
    await renderPage('/progresi/trupi?pamja=volumi')
    const model = await screen.findByRole('img', { name: 'Volumi i javës sipas muskujve' })
    await user.click(within(model).getByText(/^pectoralis_major_sternocostal/))
    const card = screen.getByRole('group', { name: 'Muskuli i zgjedhur' })
    expect(card).toHaveTextContent('Gjoksi')
    expect(card).toHaveTextContent('I lodhur · para 1 ore')
    expect(card).toHaveTextContent('Këtë javë 3 sete · nën objektiv')
    expect(within(card).getByRole('button', { name: /^Bench Press dhe \d+ (tjetër|të tjera)\. Më shumë për Gjoksi$/ })).toBeInTheDocument()
    await user.click(within(model).getByRole('button', { name: 'prek jashtë trupit' }))
    expect(model).toHaveTextContent('pa fokus')
    expect(screen.queryByRole('group', { name: 'Muskuli i zgjedhur' })).not.toBeInTheDocument()
    await user.click(within(model).getByText(/^pectoralis_major_sternocostal/))
    await user.click(within(screen.getByRole('group', { name: 'Muskuli i zgjedhur' })).getByRole('button', { name: 'Hiq fokusin' }))
    expect(model).toHaveTextContent('pa fokus')
  })

  it('kamera e lirë: shina e këndeve e modelit zë vendin e "Shiko mbrapa"', async () => {
    await renderPage()
    const model = await screen.findByRole('img', { name: 'Rikuperimi sipas muskujve' })
    expect(model).toHaveTextContent('kamera e lirë me shinë')
    expect(screen.queryByRole('button', { name: 'Shiko mbrapa' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Shiko përpara' })).not.toBeInTheDocument()
  })

  it('anglisht: titulli, pamjet, lista, karta dhe shënimi', async () => {
    language.set('en')
    const user = userEvent.setup()
    await renderPage('/progresi/trupi?pamja=volumi')
    expect(await screen.findByRole('heading', { level: 1, name: 'Body' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Layers' })).toBeInTheDocument()
    expect(await screen.findByRole('radio', { name: 'Weekly volume' })).toHaveAttribute('aria-checked', 'true')
    const list = screen.getByRole('region', { name: 'Muscles' })
    expect(within(list).getAllByRole('button')[0]).toHaveAccessibleName('Chest, 3 sets')
    expect(list).toHaveTextContent(/working sets\. 15 groups: 0 above target, 0 on it, 15 below it, such as chest and shoulders\./)
    expect(screen.getByRole('list', { name: 'Legend' })).toHaveTextContent('10–20 · target')
    const model = screen.getByRole('img', { name: 'This week’s volume by muscle' })
    await user.click(within(model).getByText(/^pectoralis_major_sternocostal/))
    const card = screen.getByRole('group', { name: 'Selected muscle' })
    expect(card).toHaveTextContent('Chest')
    expect(card).toHaveTextContent('Fatigued · 1 hour ago')
    expect(card).toHaveTextContent('This week 3 sets · below target')
    const more = within(card).getByRole('button', { name: /^Bench Press and \d+ more\. More about Chest$/ })
    await user.click(more)
    const sheet = screen.getByRole('dialog', { name: 'Chest' })
    expect(sheet).toHaveTextContent('Below target · 10–20')
    expect(sheet).toHaveTextContent('Parts this week')
    expect(within(sheet).getByRole('heading', { name: 'In your programme this week' })).toBeInTheDocument()
  })
})
