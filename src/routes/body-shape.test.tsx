import { act, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { ShapeScales } from '@/body/body-shape'
import type { LocalStore } from '@/data/store'
import { language } from '@/i18n'

// Trupi sipas matjeve (bordi "Matjet"): Java 0 nga nisja e programit, perimetrat te matja e fundit
// dhe forma e modelit "Sot". Pranimi i E1-14: matja e re ndryshon trupin sipas matjeve.
const data = vi.hoisted(() => ({ store: null as unknown as LocalStore, now: new Date('2026-10-25T17:00:00') }))
vi.mock('@/data/app-data', async () => {
  const { createDatabase } = await import('@/data/db')
  const { createLocalStore } = await import('@/data/store')
  const store = createLocalStore(createDatabase(`shape-ui-${crypto.randomUUID()}`), { userId: () => '11111111-1111-4111-8111-111111111111', now: () => data.now })
  data.store = store
  return {
    store,
    useLocalQuery: (await import('@/test/local-query')).useLocalQueryFor(store),
  }
})

vi.mock('@/lib/webgl', () => ({ webglAvailable: () => true }))
// Renderimi i modelit kërkon WebGL: këtu ruhet forma që mori çdo pamje dhe kthehen pika fikse.
const renders = vi.hoisted(() => ({ shapes: [] as ShapeScales[][] }))
vi.mock('@/components/body/body-still', () => ({
  renderBodyStills: async (_element: Element, frames: { shape?: ShapeScales }[]) => {
    renders.shapes.push(frames.map((frame) => frame.shape ?? {}))
    const points = { mid: [59, 120] as [number, number], sides: [[30, 110] as [number, number], [90, 110] as [number, number]] }
    return frames.map((_, index) => ({ url: `blob:trupi-${index}`, points: { arm: points, chest: points, waist: points, thigh: points } }))
  },
}))

describe('Trupi sipas matjeve', () => {
  afterEach(() => language.set('sq'))

  async function renderPage() {
    const { BodyShapePage } = await import('./body-shape')
    render(<RouterProvider router={createMemoryRouter([{ path: '/progresi/trupi/matjet', element: <BodyShapePage /> }], { initialEntries: ['/progresi/trupi/matjet'] })} />)
  }

  it('pa dy matje: fjalia e gjendjes bosh dhe "Shto matjen e sotme"', async () => {
    await import('@/data/app-data')
    await renderPage()
    expect(await screen.findByText(/Matja e dytë me centimetër/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Shto matjen e sotme' })).toHaveAttribute('href', '/progresi/matja')
  })

  it('Java 0 dhe matja e fundit: perimetrat, pamjet dhe forma; matja e re ndryshon trupin', async () => {
    const { completeOnboarding } = await import('@/data/profile')
    const { startWorkout } = await import('@/data/training')
    const { saveMeasurement } = await import('@/data/progress')
    await completeOnboarding(data.store, { weightKg: 80, trainingDays: [0, 1, 2, 4], trainingTime: '17:00', wakeTime: '07:00', sleepTime: '23:00' })
    await saveMeasurement(data.store, '2026-10-25', { weight_kg: 80, arm_right_cm: 34, chest_cm: 98, waist_cm: 84.5, thigh_right_cm: 56 })
    await startWorkout(data.store)
    data.now = new Date('2026-11-01T08:00:00')
    await saveMeasurement(data.store, '2026-11-01', { arm_right_cm: 34.4, chest_cm: 98.6, waist_cm: 84, thigh_right_cm: 56.3 })

    renders.shapes = []
    await renderPage()
    const list = await screen.findByRole('region', { name: 'Perimetrat · 25 tetor → 1 nëntor' })
    expect(within(list).getAllByRole('link').map((row) => row.textContent!.replace(/\u00A0/g, ' '))).toEqual([
      'Krahu34,0 → 34,4 cm+0,4 cm',
      'Gjoksi98,0 → 98,6 cm+0,6 cm',
      'Beli84,5 → 84,0 cm−0,5 cm',
      'Kofsha56,0 → 56,3 cm+0,3 cm',
    ])
    expect(within(list).getAllByRole('link')[0]).toHaveAttribute('href', '/progresi/arm_right_cm')
    const card = screen.getByRole('region', { name: 'Krahasimi: Java 0 dhe sot' })
    expect(card).toHaveTextContent('Java 0: 25 tetor. Sot: nga matja e fundit, 1 nëntor.')
    expect(await within(card).findByRole('img', { name: 'Trupi në Java 0, 25 tetor' })).toHaveAttribute('src', 'blob:trupi-0')
    expect(within(card).getByRole('img', { name: 'Trupi sot, sipas matjes së fundit' })).toHaveAttribute('src', 'blob:trupi-1')
    // Java 0 me modelin origjinal, sot me raportin e çdo perimetri.
    const [java0, today] = renders.shapes.at(-1)!
    expect(java0).toEqual({})
    expect(today.chest).toBeCloseTo(98.6 / 98, 6)
    expect(today.waist).toBeCloseTo(84 / 84.5, 6)
    expect(screen.getByRole('link', { name: 'Shto matjen e sotme' })).toHaveAttribute('href', '/progresi/matja')

    // Matja e re: lista dhe forma e modelit ndjekin vlerat e reja.
    data.now = new Date('2026-11-08T08:00:00')
    await act(() => saveMeasurement(data.store, '2026-11-08', { chest_cm: 99.4 }))
    expect(await screen.findByRole('region', { name: 'Perimetrat · 25 tetor → 8 nëntor' })).toHaveTextContent('Gjoksi98,0 → 99,4 cm+1,4 cm')
    await vi.waitFor(() => expect(renders.shapes.at(-1)![1].chest).toBeCloseTo(99.4 / 98, 6))
  })

  it('anglisht', async () => {
    language.set('en')
    await renderPage()
    expect(await screen.findByRole('heading', { level: 1, name: 'By measurements' })).toBeInTheDocument()
    const list = await screen.findByRole('region', { name: 'Measurements · 25 October → 8 November' })
    expect(within(list).getAllByRole('link')[1]).toHaveTextContent('Chest98.0 → 99.4 cm+1.4 cm')
    expect(screen.getByRole('region', { name: 'Comparison: Week 0 and today' })).toHaveTextContent('Today: from the latest measurement, 8 November.')
    expect(screen.getByRole('link', { name: 'Add today’s measurement' })).toBeInTheDocument()
  })
})
