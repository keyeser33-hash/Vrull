import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect, useState } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { Tone } from '@/body/model-math'
import type { LocalStore } from '@/data/store'
import { language } from '@/i18n'

interface ModelProps {
  paint: (key: string) => Tone | null
  focus?: string[] | null
  ghost?: string[]
  shadeFocus?: boolean
  overlay?: React.ReactNode
  label: string
}

// Shtresat (bordi "Trupi · Shtresat") me Shortcut to Size aktiv: mbulesat e tejdukshme, muskuli i
// thellë në prush, karta me burimin dhe ku punon te programi.
const data = vi.hoisted(() => ({ store: null as unknown as LocalStore }))
vi.mock('@/data/app-data', async () => {
  const { createDatabase } = await import('@/data/db')
  const { createLocalStore } = await import('@/data/store')
  const store = createLocalStore(createDatabase(`layers-ui-${crypto.randomUUID()}`), { userId: () => '11111111-1111-4111-8111-111111111111' })
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

const gl = vi.hoisted(() => ({ available: true }))
vi.mock('@/lib/webgl', () => ({ webglAvailable: () => gl.available }))
vi.mock('@/components/body/body-model', () => ({
  default: ({ paint, focus, ghost, shadeFocus, overlay, label }: ModelProps) => (
    <div>
      <div role="img" aria-label={label}>
        <p>{focus ? `fokusi ${focus.join(' ')}` : 'pa fokus'}</p>
        <p>{`mbulesat ${ghost?.length ? ghost.join(' ') : 'asnjë'}`}</p>
        <p>{shadeFocus === false ? 'pa zbehje' : 'me zbehje'}</p>
        <p>{['pectoralis_minor', 'rhomboid_major', 'trapezius'].map((key) => `${key} ${paint(key)?.token ?? 'pa'}`).join(' · ')}</p>
      </div>
      {overlay}
    </div>
  ),
}))

describe('Shtresat', () => {
  beforeEach(() => {
    gl.available = true
  })
  afterEach(() => language.set('sq'))

  beforeAll(async () => {
    await import('@/data/app-data')
    const { completeOnboarding } = await import('@/data/profile')
    await completeOnboarding(data.store, { weightKg: 80, trainingDays: [0, 1, 2, 4], trainingTime: '17:00', wakeTime: '07:00', sleepTime: '23:00' })
  })

  async function renderPage(path = '/progresi/trupi/shtresat') {
    const { BodyLayersPage } = await import('./body-layers')
    render(<RouterProvider router={createMemoryRouter([{ path: '/progresi/trupi/shtresat', element: <BodyLayersPage /> }], { initialEntries: [path] })} />)
  }

  it('hapet te pectoralis minor: mbulesat e tejdukshme, muskuli i thellë në prush, karta me burimin dhe programin', async () => {
    await renderPage()
    expect(screen.getByRole('heading', { level: 1, name: 'Shtresat' })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: /Muskujt e thellë/ })).toBeChecked()
    const model = await screen.findByRole('img', { name: 'Modeli 3D me muskulin e thellë dhe mbulesat e tij' })
    expect(model).toHaveTextContent('fokusi pectoralis_minor')
    expect(model).toHaveTextContent(/mbulesat .*pectoralis_major_sternocostal.*trapezius/)
    expect(model).toHaveTextContent('pa zbehje')
    expect(model).toHaveTextContent('pectoralis_minor --ember · rhomboid_major pa · trapezius pa')
    expect(screen.getByRole('group', { name: 'Muskuli i zgjedhur' })).toHaveTextContent('Pectoralis minor · nën gjoksin e madh')
    expect(screen.getByRole('list', { name: 'Legjenda' })).toHaveTextContent('Mbulesa: gjoksi i madhMuskuli i thellë')
    expect(screen.getByRole('radio', { name: 'Pectoralis minor' })).toHaveAttribute('aria-checked', 'true')
    const card = screen.getByRole('region', { name: 'Gjoksi i vogël' })
    expect(card).toHaveTextContent('Nis nga brinjët 3–5, kapet te procesi korakoid')
    expect(card).toHaveTextContent('Burimi: Kenhub, „Pectoralis minor muscle“')
    expect(await within(card).findByText('Te programi yt: ndihmës te Cable Crossover, pa sete këtë javë.')).toBeInTheDocument()
  })

  it('"Muskujt e thellë" fikur: mbulesat mbeten; "×" e heq fokusin', async () => {
    const user = userEvent.setup()
    await renderPage()
    await user.click(screen.getByRole('switch', { name: /Muskujt e thellë/ }))
    const model = await screen.findByRole('img', { name: /^Modeli 3D/ })
    expect(model).toHaveTextContent('mbulesat asnjë')
    expect(screen.getByRole('list', { name: 'Legjenda' })).not.toHaveTextContent('Mbulesa')
    await user.click(within(screen.getByRole('group', { name: 'Muskuli i zgjedhur' })).getByRole('button', { name: 'Hiq fokusin' }))
    expect(model).toHaveTextContent('pa fokus')
    expect(screen.queryByRole('group', { name: 'Muskuli i zgjedhur' })).not.toBeInTheDocument()
  })

  it('romboidët: zgjedhja e fokuson, karta ndryshon dhe zgjedhja mbahet në adresë', async () => {
    const user = userEvent.setup()
    await renderPage()
    await user.click(screen.getByRole('radio', { name: 'Romboidët' }))
    expect(screen.getByRole('radio', { name: 'Romboidët' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('img', { name: /^Modeli 3D/ })).toHaveTextContent('fokusi rhomboid_major rhomboid_minor')
    expect(screen.getByRole('group', { name: 'Muskuli i zgjedhur' })).toHaveTextContent('Romboidët · nën trapezin')
    const card = screen.getByRole('region', { name: 'Romboidët' })
    expect(card).toHaveTextContent('Nisin nga rruazat C7–T5')
    expect(await within(card).findByText(/^Te programi yt: kryesor te Dumbbell Bent-Over Row/)).toBeInTheDocument()
    expect(card).toHaveTextContent('Burimi: Kenhub, „Rhomboid muscles“')
  })

  it('anglisht', async () => {
    language.set('en')
    await renderPage('/progresi/trupi/shtresat?muskuli=soleus')
    expect(screen.getByRole('heading', { level: 1, name: 'Layers' })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: /Deep muscles/ })).toBeChecked()
    expect(screen.getByRole('group', { name: 'Selected muscle' })).toHaveTextContent('Soleus · under the gastrocnemius')
    const card = screen.getByRole('region', { name: 'Soleus' })
    expect(card).toHaveTextContent('Achilles tendon')
    expect(await within(card).findByText(/^In your programme: primary in Seated Calf Raise; secondary in Standing Calf Raise/)).toBeInTheDocument()
    expect(card).toHaveTextContent('Source: Kenhub, “Soleus muscle”')
  })

  it('pa WebGL: figura 2D me muskulin e thellë', async () => {
    gl.available = false
    await renderPage()
    expect(screen.getByRole('img', { name: /^Modeli 3D/ }).tagName.toLowerCase()).toBe('svg')
    expect(screen.queryByRole('group', { name: 'Muskuli i zgjedhur' })).not.toBeInTheDocument()
  })
})
