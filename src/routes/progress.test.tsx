import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { LocalStore } from '@/data/store'
import { language } from '@/i18n'

// Progresi me store të vërtetë: matja e parë, pamja e peshës (0.23: tab-et, pesha, matjet dhe rreshti i
// fotove, bordi "Progresi"), fotot te faqja e tyre dhe historia e një matjeje.
const data = vi.hoisted(() => ({ store: null as unknown as LocalStore }))
vi.mock('@/data/app-data', async () => {
  const { createDatabase } = await import('@/data/db')
  const { createLocalStore } = await import('@/data/store')
  const photoApi = await import('@/data/photos')
  const db = createDatabase(`progress-ui-${crypto.randomUUID()}`)
  const store = createLocalStore(db, { userId: () => '11111111-1111-4111-8111-111111111111' })
  data.store = store
  const remote = { upload: async () => {}, download: async () => new ArrayBuffer(0) }
  return {
    store,
    photos: {
      timeline: () => photoApi.photoTimeline(store, db),
      add: (input: Parameters<typeof photoApi.addPhoto>[2]) => photoApi.addPhoto(store, db, input),
      remove: (id: string) => photoApi.removePhoto(store, db, id),
      data: (photo: { id: string; storagePath: string }) => photoApi.photoData(db, remote, photo),
    },
    useLocalQuery: (await import('@/test/local-query')).useLocalQueryFor(store),
  }
})

vi.mock('@/lib/image', () => ({ compressPhoto: async () => ({ data: new Uint8Array([1, 2, 3]).buffer, width: 1200, height: 1600 }) }))

async function renderAt(path: string) {
  const { MetricPage, ProgressPage } = await import('./progress')
  const { MeasurePage } = await import('./body-measure')
  const { PhotosPage } = await import('./photos')
  const router = createMemoryRouter(
    [
      { path: '/progresi', element: <ProgressPage /> },
      { path: '/progresi/fotot', element: <PhotosPage /> },
      { path: '/progresi/matja', element: <MeasurePage /> },
      { path: '/progresi/trupi', element: <h1>Trupi</h1> },
      { path: '/progresi/:metric', element: <MetricPage /> },
    ],
    { initialEntries: path.split('|') },
  )
  render(<RouterProvider router={router} />)
  return router
}

describe('Progresi', () => {
  beforeAll(async () => {
    await import('@/data/app-data')
    URL.createObjectURL = () => 'blob:foto'
    URL.revokeObjectURL = () => {}
  })
  afterEach(() => language.set('sq'))

  it('pa asgjë: gjendja bosh; matja hapet nga lista, gabimi tregohet te fusha; pas perimetrit del pamja e plotë', async () => {
    const user = userEvent.setup()
    await renderAt('/progresi')
    expect(await screen.findByRole('heading', { level: 2, name: 'Grafikët nisin me setin e parë' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Progresi' })).toBeInTheDocument()
    // Pa program aktiv nuk ka "Fillo stërvitjen e parë".
    expect(screen.queryByRole('button', { name: 'Fillo stërvitjen e parë' })).toBeNull()
    expect(screen.getByRole('link', { name: /^Trupi 3D/ })).toHaveAttribute('href', '/progresi/trupi')
    await user.click(screen.getByRole('link', { name: /^Pesha dhe matjet/ }))
    // "Shto matjen" (V2-E1-14, bordi "Trupi · Shto matjen"); provat e plota janë te body-measure.test.tsx.
    expect(await screen.findByRole('heading', { level: 1, name: 'Shto matjen' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ruaj matjen' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Shkruaj të paktën një matje.')
    await user.type(screen.getByLabelText('Pesha e trupit'), '15')
    await user.click(screen.getByRole('button', { name: 'Ruaj matjen' }))
    expect(screen.getByLabelText('Pesha e trupit')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('Pesha e trupit duhet të jetë nga 20 deri në 400 kg.')
    await user.clear(screen.getByLabelText('Pesha e trupit'))
    await user.type(screen.getByLabelText('Pesha e trupit'), '80,4')
    await user.type(screen.getByLabelText('Beli'), '84')
    await user.click(screen.getByRole('button', { name: 'Ruaj matjen' }))
    const updated = await screen.findByRole('region', { name: 'Pesha' })
    await waitFor(() => expect(updated).toHaveTextContent('80,4kg · mesatarja 7-ditore'))
    expect(within(updated).getByRole('link', { name: 'Shto matjen' })).toHaveAttribute('href', '/progresi/matja')
    expect(within(updated).getByRole('link', { name: /^Beli/ })).toHaveTextContent('84 cm')
    expect(await within(updated).findByRole('link', { name: /^Fotot e progresit/ })).toHaveTextContent('Asnjë foto ende')
    // Tab-et (0.23): Progresi hapet te Përmbledhja; Trupi, Historiku dhe Arritjet janë rrugët e tyre.
    const tabs = screen.getByRole('tablist', { name: 'Pamjet e Progresit' })
    expect(within(tabs).getAllByRole('tab').map((tab) => [tab.textContent, tab.getAttribute('href'), tab.getAttribute('aria-selected')])).toEqual([
      ['Trupi', '/progresi/trupi', 'false'],
      ['Përmbledhja', '/progresi', 'true'],
      ['Historiku', '/progresi/historiku', 'false'],
      ['Arritjet', '/progresi/arritjet', 'false'],
    ])
    // Ndërrimi i tab-it: 250 ms ease-out (DESIGN.md › Lëvizja).
    expect(within(tabs).getAllByRole('tab')[1]).toHaveClass('duration-250', 'ease-out')
    expect(await screen.findByText('Forca (e1RM) del këtu pas seteve të para me peshë.')).toBeInTheDocument()
  })

  it('historia e peshës: grafiku me mesataren dhe lista sipas datës', async () => {
    const { saveMeasurement } = await import('@/data/progress')
    for (const [date, weight] of [['2026-11-20', 81.6], ['2026-11-27', 81], ['2026-12-04', 80.5]] as const) await saveMeasurement(data.store, date, { weight_kg: weight })
    await renderAt('/progresi/weight_kg')
    // Gjatë leximit titulli i fshehur ka të njëjtin emër: pritet grafiku, pastaj titulli i faqes.
    expect(await screen.findByRole('img', { name: /^Pesha në kohë/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Pesha' })).toBeInTheDocument()
    const history = screen.getByRole('region', { name: 'Historia' })
    // Më e reja e para; matja e testit të parë është e sotme (para këtyre datave).
    const [newest] = within(history).getAllByRole('link')
    expect(newest).toHaveTextContent('80,5 kg')
    expect(newest).toHaveAttribute('href', '/progresi/matja?data=2026-12-04')
  })

  it('fotot (te faqja e fotove): poza bosh ruan foton e sotme; foto hapet në fletë dhe fshihet', async () => {
    const user = userEvent.setup()
    await renderAt('/progresi/fotot')
    const section = await screen.findByRole('region', { name: 'Fotot e progresit' })
    // F8: titulli del një herë, te kreu; seksioni nuk e përsërit si titull.
    expect(screen.getAllByText('Fotot e progresit')).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1, name: 'Fotot e progresit' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 2, name: 'Fotot e progresit' })).not.toBeInTheDocument()
    const input = within(section).getByText('Para').closest('label')!.querySelector('input')!
    await user.upload(input, new File(['x'], 'foto.jpg', { type: 'image/jpeg' }))
    const photo = await within(section).findByRole('button', { name: /^Para, / })
    // Imazhi është dekorativ (alt bosh): emri vjen nga butoni.
    await waitFor(() => expect(photo.querySelector('img')).toHaveAttribute('src', 'blob:foto'))
    expect(await data.store.all('progress_photos')).toEqual([expect.objectContaining({ pose: 'front', width: 1200, height: 1600, bytes: 3 })])
    await user.click(photo)
    const viewer = screen.getByRole('dialog', { name: /^Para · / })
    await user.click(within(viewer).getByRole('button', { name: 'Fshi foton' }))
    await user.click(within(viewer).getByRole('button', { name: 'Po, fshije' }))
    // "Para" del edhe si etiketë mbi foto: pritet që butoni i fotos të ikë, pastaj del poza bosh.
    await waitFor(() => expect(within(section).queryByRole('button', { name: /^Para, / })).not.toBeInTheDocument())
    expect(within(section).getByText('Para').closest('label')).not.toBeNull()
    expect(await data.store.all('progress_photos')).toEqual([])
  })

  it('në anglisht: paneli i peshës, matjet, fotot dhe historia e një matjeje, pa asnjë tekst shqip', async () => {
    const user = userEvent.setup()
    language.set('en')
    const router = await renderAt('/progresi')
    const weight = await screen.findByRole('region', { name: 'Weight' })
    // Numri dhe njësia lidhen me hapësirë që nuk thyhet (\s e kap).
    expect(await within(weight).findByRole('img', { name: /^Weight over the last 8 weeks, latest average 80\.5\skg$/ })).toBeInTheDocument()
    expect(within(weight).getByText('kg · 7-day average')).toBeInTheDocument()
    expect(within(weight).getByRole('link', { name: 'Add measurement' })).toHaveAttribute('href', '/progresi/matja')
    expect(within(weight).getByRole('link', { name: 'History' })).toHaveAttribute('href', '/progresi/weight_kg')
    expect(within(weight).getByRole('link', { name: /^Waist/ })).toHaveTextContent('84 cm')
    expect(within(screen.getByRole('tablist', { name: 'Progress views' })).getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Body', 'Summary', 'History', 'Achievements'])
    expect(await screen.findByText('Strength (e1RM) shows up here after your first weighted sets.')).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/[ëç]/)

    await act(() => router.navigate('/progresi/fotot'))

    const section = await screen.findByRole('region', { name: 'Progress photos' })
    expect(section).toHaveTextContent('Same place and light every time, so the change shows.')
    await user.upload(within(section).getByText('Front').closest('label')!.querySelector('input')!, new File(['x'], 'foto.jpg', { type: 'image/jpeg' }))
    const photo = await within(section).findByRole('button', { name: /^Front, \d+ [A-Z][a-z]+$/ })
    expect(section).toHaveTextContent(/Latest: \d+ [A-Z][a-z]+\./)
    await user.click(photo)
    const viewer = screen.getByRole('dialog', { name: /^Front · / })
    expect(within(viewer).getByText('Take a new photo today')).toBeInTheDocument()
    await user.click(within(viewer).getByRole('button', { name: 'Delete photo' }))
    expect(within(viewer).getByRole('alert')).toHaveTextContent('The photo is deleted from this phone and from your account.')
    expect(within(viewer).getByRole('button', { name: 'Yes, delete it' })).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/[ëç]/)
  })

  it('në anglisht: faqja me të gjitha fotot (foto para nga testi i mëparshëm) dhe faqja e një matjeje', async () => {
    language.set('en')
    const router = await renderAt('/progresi/fotot')
    // Gjatë leximit ka vetëm titullin e fshehur; faqja vjen me butonin mbrapa.
    expect(await screen.findByRole('button', { name: 'Back to Progress' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Progress photos' })).toBeInTheDocument()
    expect(await screen.findByText('No side photo')).toBeInTheDocument()
    expect(screen.getByText('No back photo')).toBeInTheDocument()
    await router.navigate('/progresi/weight_kg')
    expect(await screen.findByRole('img', { name: 'Weight over time, 4 measurements' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Weight' })).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'History' })).getAllByRole('link')[0]).toHaveTextContent(/^4 December80\.5\skg$/)
    expect(screen.getByRole('link', { name: 'Add measurement' })).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/[ëç]/)
  })
})
