import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect, useState } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { LocalStore } from '@/data/store'

// Progresi me store të vërtetë: matja e parë, pamja e peshës dhe historia e një matjeje.
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
    useLocalQuery<T>(query: () => Promise<T>, deps: unknown[] = []) {
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
      }, deps)
      return value
    },
  }
})

vi.mock('@/lib/image', () => ({ compressPhoto: async () => ({ data: new Uint8Array([1, 2, 3]).buffer, width: 1200, height: 1600 }) }))

async function renderAt(path: string) {
  const { MeasurementPage, MetricPage, ProgressPage } = await import('./progress')
  const router = createMemoryRouter(
    [
      { path: '/progresi', element: <ProgressPage /> },
      { path: '/progresi/matja', element: <MeasurementPage /> },
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

  it('pa matje: paneli e thotë dhe "Shto matjen" hap formularin; gabimi tregohet te fusha', async () => {
    const user = userEvent.setup()
    await renderAt('/progresi')
    const panel = (await screen.findByText('Pesha · mesatarja 7-ditore')).closest('section')!
    expect(panel).toHaveTextContent('Pa peshë ende')
    expect(await screen.findByText('Forca (e1RM) del këtu pas seteve të para me peshë.')).toBeInTheDocument()
    await user.click(within(panel).getByRole('link', { name: 'Shto matjen' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Matja' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ruaj matjen' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Shkruaj të paktën një matje.')
    await user.type(screen.getByLabelText('Pesha, kg'), '15')
    await user.click(screen.getByRole('button', { name: 'Ruaj matjen' }))
    expect(screen.getByLabelText('Pesha, kg')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('Pesha duhet të jetë nga 20 deri në 400 kg.')
    await user.clear(screen.getByLabelText('Pesha, kg'))
    await user.type(screen.getByLabelText('Pesha, kg'), '80,4')
    await user.type(screen.getByLabelText('Beli, cm'), '84')
    await user.click(screen.getByRole('button', { name: 'Ruaj matjen' }))
    const updated = (await screen.findByText('Pesha · mesatarja 7-ditore')).closest('section')!
    expect(await within(updated).findByText('80,4 kg')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^Beli/ })).toHaveTextContent('84 cm')
  })

  it('historia e peshës: grafiku me mesataren dhe lista sipas datës', async () => {
    const { saveMeasurement } = await import('@/data/progress')
    for (const [date, weight] of [['2026-11-20', 81.6], ['2026-11-27', 81], ['2026-12-04', 80.5]] as const) await saveMeasurement(data.store, date, { weight_kg: weight })
    await renderAt('/progresi/weight_kg')
    expect(await screen.findByRole('heading', { level: 1, name: 'Pesha' })).toBeInTheDocument()
    expect(await screen.findByRole('img', { name: /^Pesha në kohë/ })).toBeInTheDocument()
    const history = screen.getByRole('region', { name: 'Historia' })
    // Më e reja e para; matja e testit të parë është e sotme (para këtyre datave).
    const [newest] = within(history).getAllByRole('link')
    expect(newest).toHaveTextContent('80,5 kg')
    expect(newest).toHaveAttribute('href', '/progresi/matja?data=2026-12-04')
  })

  it('fotot: poza bosh ruan foton e sotme; foto hapet në fletë dhe fshihet', async () => {
    const user = userEvent.setup()
    await renderAt('/progresi')
    const section = await screen.findByRole('region', { name: 'Fotot e progresit' })
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
})
