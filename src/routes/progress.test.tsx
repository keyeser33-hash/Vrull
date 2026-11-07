import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect, useState } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { LocalStore } from '@/data/store'

// Progresi me store të vërtetë: matja e parë, pamja e peshës dhe historia e një matjeje.
const data = vi.hoisted(() => ({ store: null as unknown as LocalStore }))
vi.mock('@/data/app-data', async () => {
  const { createDatabase } = await import('@/data/db')
  const { createLocalStore } = await import('@/data/store')
  const store = createLocalStore(createDatabase(`progress-ui-${crypto.randomUUID()}`), { userId: () => '11111111-1111-4111-8111-111111111111' })
  data.store = store
  return {
    store,
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
  })

  it('pa matje: paneli e thotë dhe "Shto matjen" hap formularin; gabimi tregohet te fusha', async () => {
    const user = userEvent.setup()
    await renderAt('/progresi')
    const panel = (await screen.findByText('Pesha · mesatarja 7-ditore')).closest('section')!
    expect(panel).toHaveTextContent('Pa peshë ende')
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
})
