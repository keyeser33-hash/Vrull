import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect, useState } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { LocalStore } from '@/data/store'
import { language } from '@/i18n'

// Shto matjen (bordi "Trupi · Shto matjen"): e diel 8 nëntor 2026, pesha e djeshme 80,0 kg dhe
// perimetrat e 1 nëntorit. Ruajtja me `saveMeasurement` ekzistuese.
const data = vi.hoisted(() => ({ store: null as unknown as LocalStore }))
vi.mock('@/data/app-data', async () => {
  const { createDatabase } = await import('@/data/db')
  const { createLocalStore } = await import('@/data/store')
  const store = createLocalStore(createDatabase(`measure-ui-${crypto.randomUUID()}`), { userId: () => '11111111-1111-4111-8111-111111111111' })
  data.store = store
  return {
    store,
    useLocalQuery<T>(query: () => Promise<T>, deps: unknown[] = []) {
      const [value, setValue] = useState<T>()
      useEffect(() => {
        void query().then((result) => setValue(() => result))
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, deps)
      return value
    },
  }
})
vi.mock('@/lib/webgl', () => ({ webglAvailable: () => false }))

const nbsp = (text: string | null) => (text ?? '').replace(/ /g, ' ')

describe('Shto matjen', () => {
  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-08T08:00:00'))
    await import('@/data/app-data')
    const { saveMeasurement } = await import('@/data/progress')
    await saveMeasurement(data.store, '2026-11-01', { weight_kg: 79.6, arm_right_cm: 34.4, chest_cm: 98.6, waist_cm: 84, thigh_right_cm: 56.3 })
    await saveMeasurement(data.store, '2026-11-06', { weight_kg: 79.8 })
    await saveMeasurement(data.store, '2026-11-07', { weight_kg: 80 })
  })
  afterAll(() => vi.useRealTimers())
  afterEach(() => language.set('sq'))

  async function renderAt(path = '/progresi/matja') {
    const { MeasurePage } = await import('./body-measure')
    const router = createMemoryRouter(
      [
        { path: '/progresi', element: <h1>Progresi</h1> },
        { path: '/progresi/matja', element: <MeasurePage /> },
      ],
      { initialEntries: ['/progresi', path], initialIndex: 1 },
    )
    render(<RouterProvider router={router} />)
    return router
  }

  const row = (label: string) => screen.getByLabelText(label).closest('div.flex-col') as HTMLElement

  it('matja e re: data e sotme, pesha si dje me mesataren, perimetrat e 1 nëntorit; hapat ±0,1 dhe ruajtja', async () => {
    const user = userEvent.setup()
    const router = await renderAt()
    expect(await screen.findByLabelText('Data')).toHaveValue('2026-11-08')
    expect(screen.getByRole('heading', { level: 1, name: 'Shto matjen' })).toBeInTheDocument()
    expect(screen.getByText('Sot, e diel 8 nëntor 2026')).toBeInTheDocument()
    expect(screen.getByLabelText('Pesha e trupit')).toHaveValue('80,0')
    expect(nbsp(screen.getByText(/^Dje /).textContent)).toBe('Dje 80,0 kg')
    expect(nbsp(screen.getByText(/^Si dje/).textContent)).toBe('Si dje · mesatarja 7-ditore 79,8 kg')
    expect(screen.getByText('Të mbushura nga 1 nëntor')).toBeInTheDocument()
    expect(screen.getByLabelText('Krahu')).toHaveValue('34,4')
    expect(row('Krahu')).toHaveTextContent('1 nëntor 34,4 · pa ndryshim')

    for (let press = 0; press < 3; press++) await user.click(screen.getByRole('button', { name: 'Beli: ul me 0,1 cm' }))
    expect(screen.getByLabelText('Beli')).toHaveValue('83,7')
    expect(screen.getByLabelText('Beli')).toHaveClass('text-ember-text')
    expect(nbsp(row('Beli').textContent)).toContain('1 nëntor 84,0 · −0,3 cm')
    await user.click(screen.getByRole('button', { name: 'Rrit peshën me 0,1 kg' }))
    expect(screen.getByLabelText('Pesha e trupit')).toHaveValue('80,1')
    expect(nbsp(screen.getByText(/nga dje/).textContent)).toBe('+0,1 kg nga dje · mesatarja 7-ditore 79,8 kg')

    // "Më shumë matje" mbyllur: fushat e tjera nuk shihen dhe nuk ruhen.
    expect(screen.getByRole('button', { name: /^Më shumë matje/ })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByLabelText('Qafa')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ruaj matjen' }))
    expect(await screen.findByRole('heading', { name: 'Progresi' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/progresi')
    const [saved] = await data.store.where('body_measurements', 'date', '2026-11-08')
    expect(saved).toMatchObject({ weight_kg: 80.1, arm_right_cm: 34.4, chest_cm: 98.6, waist_cm: 83.7, thigh_right_cm: 56.3 })
    expect(saved.neck_cm).toBeUndefined()
  })

  it('"Më shumë matje": gabimi te fusha, % e yndyrës ruhet; data që ka matje mban vlerat e saj', async () => {
    const user = userEvent.setup()
    await renderAt('/progresi/matja?data=2026-11-08')
    expect(await screen.findByLabelText('Pesha e trupit')).toHaveValue('80,1')
    // Data që ka matje: nuk mbushet nga e kaluara.
    expect(screen.queryByText(/^Të mbushura/)).not.toBeInTheDocument()
    expect(screen.getByText('e diel 8 nëntor 2026', { exact: false })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Më shumë matje/ }))
    expect(screen.getByLabelText('Qafa')).toHaveValue('')
    expect(row('Qafa')).toHaveTextContent('Pa matje të mëparshme')
    await user.type(screen.getByLabelText('Qafa'), '5')
    await user.type(screen.getByLabelText('% e yndyrës'), '15,5')
    await user.click(screen.getByRole('button', { name: 'Ruaj matjen' }))
    expect(screen.getByLabelText('Qafa')).toHaveAttribute('aria-invalid', 'true')
    expect(within(row('Qafa')).getByRole('alert')).toHaveTextContent('Qafa duhet të jetë nga 10 deri në 250 cm.')
    await user.clear(screen.getByLabelText('Qafa'))
    // Një fushë e zbrazur te data që ka matje e fshin vlerën.
    await user.clear(screen.getByLabelText('Gjoksi'))
    await user.click(screen.getByRole('button', { name: 'Ruaj matjen' }))
    expect(await screen.findByRole('heading', { name: 'Progresi' })).toBeInTheDocument()
    const [saved] = await data.store.where('body_measurements', 'date', '2026-11-08')
    expect(saved).toMatchObject({ body_fat_pct: 15.5, chest_cm: null, weight_kg: 80.1, neck_cm: null })
  })

  it('data tjetër nga zgjedhësi: forma rinis me vlerat para asaj date', async () => {
    const router = await renderAt()
    fireEvent.change(await screen.findByLabelText('Data'), { target: { value: '2026-11-02' } })
    expect(await screen.findByText('e hënë 2 nëntor 2026')).toBeInTheDocument()
    expect(router.state.location.search).toBe('?data=2026-11-02')
    // 1 nëntor është dita para: "Dje".
    expect(await screen.findByDisplayValue('79,6')).toBe(screen.getByLabelText('Pesha e trupit'))
    expect(nbsp(screen.getByText(/^Dje /).textContent)).toBe('Dje 79,6 kg')
  })

  it('anglisht', async () => {
    language.set('en')
    await renderAt('/progresi/matja?data=2026-11-07')
    expect(await screen.findByText('Saturday 7 November 2026')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Add measurement' })).toBeInTheDocument()
    expect(screen.getByLabelText('Body weight')).toHaveValue('80.0')
    expect(nbsp(screen.getByText(/^Yesterday /).textContent)).toBe('Yesterday 79.8 kg')
    expect(nbsp(screen.getByText(/since yesterday/).textContent)).toBe('+0.2 kg since yesterday · 7-day average 79.7 kg')
    expect(screen.getByRole('button', { name: 'Waist: down 0.1 cm' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'How to measure' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save measurement' })).toBeInTheDocument()
  })
})
