import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { ShapeScales } from '@/body/body-shape'
import type { Tone } from '@/body/model-math'
import type { PhotoDay, PhotoRef, Pose } from '@/data/photos'
import type { LocalStore } from '@/data/store'
import { language } from '@/i18n'

// Makina e kohës (V52, V2-E3-09) me store të vërtetë: një ndalesë për çdo matje nga Java 0, forma
// dhe ngjyra e modelit në çdo ndalesë, luajtja, theksimi, fotot e ditës, parashikimi dhe anglishtja.
// Provat ndajnë të njëjtën bazë dhe shtojnë matje me radhë, si te prova e "Trupit sipas matjeve".
const data = vi.hoisted(() => ({ store: null as unknown as LocalStore, now: new Date('2026-10-25T17:00:00'), days: [] as PhotoDay[] }))
vi.mock('@/data/app-data', async () => {
  const { createDatabase } = await import('@/data/db')
  const { createLocalStore } = await import('@/data/store')
  const store = createLocalStore(createDatabase(`time-ui-${crypto.randomUUID()}`), { userId: () => '11111111-1111-4111-8111-111111111111', now: () => data.now })
  data.store = store
  return {
    store,
    useLocalQuery: (await import('@/test/local-query')).useLocalQueryFor(store),
    // Fotot: ditët e provës; skedari "pret ngarkimin", që të mos duhet një imazh i vërtetë.
    photos: { timeline: async () => data.days, data: async () => null },
  }
})

// WebGL mungon te jsdom: flamuri e zgjedh. Modeli 3D zëvendësohet me një stub që mban formën dhe
// ngjyrën që mori.
const gl = vi.hoisted(() => ({ available: true }))
vi.mock('@/lib/webgl', () => ({ webglAvailable: () => gl.available }))
const model = vi.hoisted(() => ({ shape: {} as ShapeScales, paint: (() => null) as (key: string) => Tone | null }))
vi.mock('@/components/body/body-model', () => ({
  default: ({ shape, paint, label, back }: { shape?: ShapeScales; paint: (key: string) => Tone | null; label: string; back: boolean }) => {
    model.shape = shape ?? {}
    model.paint = paint
    return (
      <div role="img" aria-label={label}>
        {back ? 'modeli mbrapa' : 'modeli përpara'}
      </div>
    )
  },
}))

const photo = (date: string, pose: Pose): PhotoRef => ({ id: `${date}-${pose}`, date, pose, storagePath: `u/${date}-${pose}.jpg`, local: true, uploaded: true })
const rows = (list: HTMLElement) => within(list).getAllByRole('link').map((row) => row.textContent!.replace(/ /g, ' '))

describe('Makina e kohës', () => {
  afterEach(() => {
    language.set('sq')
    gl.available = true
    vi.useRealTimers()
  })

  async function renderPage() {
    const { BodyTimePage } = await import('./body-time')
    render(<RouterProvider router={createMemoryRouter([{ path: '/progresi/trupi/koha', element: <BodyTimePage /> }], { initialEntries: ['/progresi/trupi/koha'] })} />)
  }
  const slider = () => screen.getByRole('slider', { name: 'Koha' })
  const goTo = (stop: number) => fireEvent.change(slider(), { target: { value: String(stop) } })

  it('pa dy matje: fjalia e gjendjes bosh dhe "Shto matjen e sotme"', async () => {
    await import('@/data/app-data')
    await renderPage()
    expect(await screen.findByText(/Makina e kohës nis me matjen e dytë/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Shto matjen e sotme' })).toHaveAttribute('href', '/progresi/matja')
    expect(screen.queryByRole('slider')).not.toBeInTheDocument()
  })

  it('hapet te matja e fundit; rrëshqitësi kalon ndalesat dhe modeli merr formën dhe ngjyrën e secilës', async () => {
    const { completeOnboarding } = await import('@/data/profile')
    const { startWorkout } = await import('@/data/training')
    const { saveMeasurement } = await import('@/data/progress')
    await completeOnboarding(data.store, { weightKg: 80, trainingDays: [0, 1, 2, 4], trainingTime: '17:00', wakeTime: '07:00', sleepTime: '23:00' })
    await saveMeasurement(data.store, '2026-10-25', { weight_kg: 80, arm_right_cm: 34, chest_cm: 98, waist_cm: 84.5, thigh_right_cm: 56 })
    await startWorkout(data.store)
    data.now = new Date('2026-11-01T08:00:00')
    await saveMeasurement(data.store, '2026-11-01', { arm_right_cm: 34.4, chest_cm: 98.6, waist_cm: 84, thigh_right_cm: 56.3 })
    data.now = new Date('2026-11-08T08:00:00')
    await saveMeasurement(data.store, '2026-11-08', { chest_cm: 99.4 })

    await renderPage()
    const list = await screen.findByRole('region', { name: 'Perimetrat · 8 nëntor' })
    // Krahu nuk u mat më 8 nëntor: mban matjen e 1 nëntorit dhe e thotë.
    expect(rows(list)).toEqual(['Krahu34,0 → 34,4 cm · matur më 1 nëntor+0,4 cm', 'Gjoksi98,0 → 99,4 cm+1,4 cm', 'Beli84,5 → 84,0 cm · matur më 1 nëntor−0,5 cm', 'Kofsha56,0 → 56,3 cm · matur më 1 nëntor+0,3 cm'])
    expect(within(list).getAllByRole('link')[0]).toHaveAttribute('href', '/progresi/arm_right_cm')
    expect(screen.getByRole('region', { name: 'Trupi më 8 nëntor' })).toHaveTextContent('2 javë nga Java 0')
    expect(await screen.findByRole('img', { name: 'Trupi më 8 nëntor' })).toBeInTheDocument()
    expect(slider()).toHaveAttribute('aria-valuetext', '8 nëntor, ndalesa 3 nga 3')
    expect(slider()).toHaveAttribute('max', '2')
    expect(model.shape.chest).toBeCloseTo(99.4 / 98, 6)
    expect(model.shape.waist).toBeCloseTo(84 / 84.5, 6)
    // Gjoksi +1,4% në shkallën e mesme, krahu +1,2% po ashtu, beli −0,6% në të ulëtën; shpina pa ngjyrë.
    expect(model.paint('pectoralis_major_sternocostal')).toEqual({ token: '--data', alpha: 0.65 })
    expect(model.paint('rectus_abdominis')).toEqual({ token: '--data', alpha: 0.35 })
    expect(model.paint('latissimus_dorsi')).toBeNull()
    expect(screen.getByRole('list', { name: 'Legjenda' })).toHaveTextContent('nën 1%1–3%mbi 3%')
    expect(screen.getByText('Ngjyra: ndryshimi nga Java 0')).toBeInTheDocument()
    expect(screen.getByText('Parashikimi hapet kur një zonë ka 4 matje në të paktën 3 javë.')).toBeInTheDocument()

    goTo(1)
    expect(rows(await screen.findByRole('region', { name: 'Perimetrat · 1 nëntor' }))).toEqual(['Krahu34,0 → 34,4 cm+0,4 cm', 'Gjoksi98,0 → 98,6 cm+0,6 cm', 'Beli84,5 → 84,0 cm−0,5 cm', 'Kofsha56,0 → 56,3 cm+0,3 cm'])
    expect(screen.getByRole('region', { name: 'Trupi më 1 nëntor' })).toHaveTextContent('1 javë nga Java 0')
    expect(slider()).toHaveAttribute('aria-valuetext', '1 nëntor, ndalesa 2 nga 3')
    expect(model.shape.chest).toBeCloseTo(98.6 / 98, 6)
    expect(model.paint('pectoralis_major_sternocostal')).toEqual({ token: '--data', alpha: 0.35 })

    goTo(0)
    expect(rows(await screen.findByRole('region', { name: 'Perimetrat · 25 tetor' }))[1]).toBe('Gjoksi98,0 → 98,0 cm0,0 cm')
    expect(screen.getByRole('region', { name: 'Trupi më 25 tetor' })).toHaveTextContent('Java 0')
    expect(model.shape).toEqual({ arm: 1, chest: 1, waist: 1, thigh: 1 })
    expect(model.paint('pectoralis_major_sternocostal')).toBeNull()
    expect(screen.getByRole('link', { name: 'Shto matjen e sotme' })).toHaveAttribute('href', '/progresi/matja')
  })

  it('"Thekso ndryshimin" trefishon formën, jo numrat', async () => {
    const user = userEvent.setup()
    await renderPage()
    const list = await screen.findByRole('region', { name: 'Perimetrat · 8 nëntor' })
    await user.click(screen.getByRole('switch', { name: /Thekso ndryshimin/ }))
    expect(screen.getByText('Forma tregohet me ndryshimin 3 herë më të madh. Numrat mbeten të vërtetët.')).toBeInTheDocument()
    expect(model.shape.chest).toBeCloseTo(1 + (99.4 / 98 - 1) * 3, 6)
    expect(model.shape.waist).toBeCloseTo(1 + (84 / 84.5 - 1) * 3, 6)
    expect(rows(list)[1]).toBe('Gjoksi98,0 → 99,4 cm+1,4 cm')
    await user.click(screen.getByRole('switch', { name: /Thekso ndryshimin/ }))
    expect(model.shape.chest).toBeCloseTo(99.4 / 98, 6)
  })

  it('"Luaj nga fillimi" kalon ndalesat me radhë, me formën që rrjedh mes tyre, dhe ndalet te e fundit', async () => {
    await renderPage()
    await screen.findByRole('region', { name: 'Perimetrat · 8 nëntor' })
    // Koha e luajtjes vjen nga ora: bashkë me intervalin imitohet edhe `Date` (jo kohëmatësit e bazës lokale).
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })
    fireEvent.click(screen.getByRole('button', { name: 'Luaj nga fillimi' }))
    expect(screen.getByRole('region', { name: 'Perimetrat · 25 tetor' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ndalo' })).toBeInTheDocument()
    // Pas 420 ms: 7/16 e rrugës drejt ndalesës së dytë; forma në mes, numrat ende të bazës.
    act(() => vi.advanceTimersByTime(420))
    expect(model.shape.chest).toBeCloseTo(1 + ((98.6 / 98 - 1) * 7) / 16, 6)
    expect(screen.getByRole('region', { name: 'Perimetrat · 25 tetor' })).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(540))
    expect(screen.getByRole('region', { name: 'Perimetrat · 1 nëntor' })).toBeInTheDocument()
    expect(model.shape.chest).toBeCloseTo(98.6 / 98, 6)
    act(() => vi.advanceTimersByTime(960))
    expect(screen.getByRole('region', { name: 'Perimetrat · 8 nëntor' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Luaj nga fillimi' })).toBeInTheDocument()

    // Një telefon i ngadaltë humb hapa, jo kohë: pas 1 s pa asnjë hap të ndërmjetëm, luajtja është te ndalesa e dytë.
    fireEvent.click(screen.getByRole('button', { name: 'Luaj nga fillimi' }))
    act(() => {
      vi.setSystemTime(Date.now() + 1000)
      vi.advanceTimersByTime(60)
    })
    expect(screen.getByRole('region', { name: 'Perimetrat · 1 nëntor' })).toBeInTheDocument()
    goTo(2)

    // Prekja e rrëshqitësit gjatë luajtjes e ndal.
    fireEvent.click(screen.getByRole('button', { name: 'Luaj nga fillimi' }))
    act(() => vi.advanceTimersByTime(120))
    goTo(2)
    expect(screen.getByRole('button', { name: 'Luaj nga fillimi' })).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(2000))
    expect(screen.getByRole('region', { name: 'Perimetrat · 8 nëntor' })).toBeInTheDocument()
  })

  it('fotot: pa foto, rruga te fotot; me foto, e para pranë asaj të ndalesës', async () => {
    data.days = []
    await renderPage()
    await screen.findByRole('region', { name: 'Perimetrat · 8 nëntor' })
    const empty = await screen.findByRole('region', { name: 'Fotot' })
    expect(empty).toHaveTextContent('Me fotot e progresit, këtu del fotoja e çdo ndalese pranë asaj të fillimit.')
    expect(within(empty).getByRole('link', { name: 'Fotot e progresit' })).toHaveAttribute('href', '/progresi/fotot')
  })

  it('fotot në kohë: fotoja e fundit deri në ndalesë, sipas pozës', async () => {
    const user = userEvent.setup()
    data.days = [
      { date: '2026-11-01', photos: { front: photo('2026-11-01', 'front') } },
      { date: '2026-10-25', photos: { front: photo('2026-10-25', 'front'), back: photo('2026-10-25', 'back') } },
    ]
    await renderPage()
    await screen.findByRole('region', { name: 'Perimetrat · 8 nëntor' })
    const section = await screen.findByRole('region', { name: 'Fotot' })
    // Më 8 nëntor nuk ka foto: vlen ajo e 1 nëntorit.
    expect(within(section).getByRole('link', { name: 'Fillimi · 25 tetor' })).toHaveAttribute('href', '/progresi/fotot?foto=2026-10-25-front')
    expect(within(section).getByRole('link', { name: '1 nëntor' })).toHaveAttribute('href', '/progresi/fotot?foto=2026-11-01-front')
    goTo(0)
    expect(within(section).getByRole('link', { name: '25 tetor' })).toHaveAttribute('href', '/progresi/fotot?foto=2026-10-25-front')
    await user.click(within(section).getByRole('radio', { name: 'Anash' }))
    expect(within(section).getAllByText('Pa foto deri më 25 tetor')).toHaveLength(2)
    await user.click(within(section).getByRole('radio', { name: 'Mbrapa' }))
    expect(within(section).getByRole('link', { name: 'Fillimi · 25 tetor' })).toHaveAttribute('href', '/progresi/fotot?foto=2026-10-25-back')
    data.days = []
  })

  it('anglisht', async () => {
    language.set('en')
    await renderPage()
    expect(await screen.findByRole('heading', { level: 1, name: 'Time machine' })).toBeInTheDocument()
    const list = await screen.findByRole('region', { name: 'Measurements · 8 November' })
    expect(rows(list)[0]).toBe('Arm34.0 → 34.4 cm · measured 1 November+0.4 cm')
    expect(screen.getByRole('region', { name: 'Body on 8 November' })).toHaveTextContent('2 weeks since Week 0')
    expect(screen.getByRole('slider', { name: 'Time' })).toHaveAttribute('aria-valuetext', '8 November, stop 3 of 3')
    expect(screen.getByRole('button', { name: 'Play from the start' })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: /Exaggerate the change/ })).toBeInTheDocument()
    expect(screen.getByText('The forecast opens once an area has 4 measurements across at least 3 weeks.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Add today’s measurement' })).toBeInTheDocument()
  })

  it('me katër matje në tri javë, ndalesa e fundit është parashikimi me interval', async () => {
    const { saveMeasurement } = await import('@/data/progress')
    data.now = new Date('2026-11-15T08:00:00')
    await saveMeasurement(data.store, '2026-11-08', { chest_cm: 99.4, arm_right_cm: 34.4 })
    await saveMeasurement(data.store, '2026-11-15', { arm_right_cm: 34.6 })

    await renderPage()
    // Hapet te matja e fundit, jo te parashikimi.
    await screen.findByRole('region', { name: 'Perimetrat · 15 nëntor' })
    expect(slider()).toHaveAttribute('max', '4')
    expect(screen.getByText('Parashikim · 6 dhjetor')).toBeInTheDocument()
    expect(screen.queryByText(/Parashikimi hapet kur/)).not.toBeInTheDocument()

    goTo(4)
    const list = await screen.findByRole('region', { name: 'Parashikimi · 6 dhjetor' })
    // Krahu: 34,0 · 34,4 · 34,4 · 34,6 në 21 ditë, vazhduar 21 ditë; gjoksi me 3 matje mban vlerën e fundit.
    expect(rows(list)[0]).toMatch(/^Krahu\d\d,\d–\d\d,\d cmrreth \+\d,\d cm$/)
    expect(rows(list)[1]).toBe('Gjoksi99,4 cm · pa parashikim ende+1,4 cm')
    expect(screen.getByRole('region', { name: 'Trupi i parashikuar për 6 dhjetor' })).toHaveTextContent('Parashikim · pas 3 javësh')
    expect(slider()).toHaveAttribute('aria-valuetext', 'Parashikim, 6 dhjetor, ndalesa 5 nga 5')
    expect(screen.getByText(/Intervali mbulon 8 nga 10 raste/)).toBeInTheDocument()
    expect(model.shape.arm).toBeGreaterThan(34.6 / 34)
    expect(model.shape.chest).toBeCloseTo(99.4 / 98, 6)
  })

  it('pa WebGL: figura 2D me të njëjtat ngjyra, pa "Shiko mbrapa"', async () => {
    gl.available = false
    await renderPage()
    await screen.findByRole('region', { name: 'Perimetrat · 15 nëntor' })
    expect(screen.getByRole('img', { name: 'Trupi më 15 nëntor' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Shiko mbrapa' })).not.toBeInTheDocument()
  })
})
