import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect, useState } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { LocalStore } from '@/data/store'

// Editori i programit me store të vërtetë: krijo programin, shto ushtrime, ndrysho sipas nivelit.
const data = vi.hoisted(() => ({ store: null as unknown as LocalStore }))
vi.mock('@/data/app-data', async () => {
  const { createDatabase } = await import('@/data/db')
  const { createLocalStore } = await import('@/data/store')
  const store = createLocalStore(createDatabase(`editor-ui-${crypto.randomUUID()}`), { userId: () => '11111111-1111-4111-8111-111111111111' })
  data.store = store
  return {
    store,
    useLocalQuery<T>(query: () => Promise<T>) {
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
      }, [])
      return value
    },
  }
})

async function renderAt(path: string) {
  const { DayEditorPage, ProgramEditorPage, ProgramsPage } = await import('./program-editor')
  const { SlotEditorPage } = await import('./slot-editor')
  const { ProgramPage } = await import('./program')
  const router = createMemoryRouter(
    [
      { path: '/programi', element: <ProgramPage /> },
      { path: '/programet', element: <ProgramsPage /> },
      { path: '/programi/editori/:programId', element: <ProgramEditorPage /> },
      { path: '/programi/editori/:programId/dita/:dayId', element: <DayEditorPage /> },
      { path: '/programi/editori/:programId/sloti/:slotId', element: <SlotEditorPage /> },
    ],
    { initialEntries: path.split('|') },
  )
  render(<RouterProvider router={router} />)
  return router
}

describe('editori i programit', () => {
  beforeAll(async () => {
    await import('@/data/app-data')
    const { completeOnboarding } = await import('@/data/profile')
    await completeOnboarding(data.store, { weightKg: 80, trainingDays: [1, 2, 4, 5], trainingTime: '18:00', wakeTime: '07:00', sleepTime: '23:00' })
  })

  it('nga Programi te editori i programit aktiv dhe te lista e programeve', async () => {
    await renderAt('/programi')
    const panel = await screen.findByRole('heading', { level: 1, name: 'Shortcut to Size' })
    const section = panel.closest('section')!
    expect(within(section).getByRole('link', { name: 'Ndrysho programin' })).toHaveAttribute('href', expect.stringMatching(/^\/programi\/editori\//))
    expect(within(section).getByRole('link', { name: 'Programet' })).toHaveAttribute('href', '/programet')
  })

  it('programi aktiv nuk fshihet; blloqet dhe ditët e Shortcut to Size duken me javët', async () => {
    const { programList } = await import('@/data/program-editor')
    const [active] = await programList(data.store)
    await renderAt(`/programi/editori/${active.id}`)
    expect(await screen.findByRole('heading', { level: 1, name: 'Shortcut to Size' })).toBeInTheDocument()
    expect(screen.getByText('4 blloqe · 13 javë · 4 ditë')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Faza 1, 4 javë' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Fshi programin/ })).toBeDisabled()
    expect(screen.queryByRole('button', { name: /Bëje programin aktiv/ })).not.toBeInTheDocument()
  })

  it('program i ri: emri, ushtrimi nga biblioteka, setet vetëm për një javë dhe receta me kohë', async () => {
    const user = userEvent.setup()
    const router = await renderAt('/programi|/programet')
    await user.click(await screen.findByRole('button', { name: 'Program i ri' }))
    const dialog = screen.getByRole('dialog', { name: 'Program i ri' })
    await user.click(within(dialog).getByRole('button', { name: 'Krijo' }))
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Shkruaj një emër.')
    await user.type(within(dialog).getByLabelText('Emri i programit'), 'Upper lower')
    await user.click(within(dialog).getByRole('button', { name: 'Krijo' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Upper lower' })).toBeInTheDocument()
    expect(screen.getByText('1 bllok · 4 javë · 1 ditë')).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: /Dita 1/ }))

    expect(await screen.findByText('Ende pa ushtrime. Shto të parin nga biblioteka.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Shto ushtrim' }))
    const picker = screen.getByRole('dialog', { name: 'Shto ushtrim' })
    await user.type(within(picker).getByLabelText('Kërko ushtrimin'), 'goblet squat')
    await user.click(await within(picker).findByRole('button', { name: /^Goblet Squat/ }))
    const row = await screen.findByRole('link', { name: /1\. Goblet Squat/ })
    expect(row).toHaveTextContent('3 sete · pushim 90 s')

    await user.click(row)
    expect(await screen.findByRole('heading', { level: 1, name: 'Goblet Squat' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Blloku 1' }))
    await user.click(screen.getByRole('button', { name: '2' }))
    expect(screen.getByText(/^Për Blloku 1 · Java 2\./)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Setet, 3' }))
    const sets = screen.getByRole('dialog', { name: 'Setet' })
    expect(within(sets).getByText('Ndryshimi vlen për Blloku 1 · Java 2.')).toBeInTheDocument()
    await user.click(within(sets).getByRole('button', { name: 'Një set më shumë' }))
    await user.click(within(sets).getByRole('button', { name: 'Ruaj' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await screen.findByRole('button', { name: 'Setet, 4' })).toHaveTextContent('Vendosur këtu')
    const preview = screen.getByRole('region', { name: 'Si del në program' })
    expect(within(preview).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Blloku 1 · Java 13 sete',
      'Blloku 1 · Java 24 sete',
      'Blloku 1 · Java 33 sete',
      'Blloku 1 · Java 43 sete',
    ])

    await user.click(screen.getAllByRole('button', { name: 'Të gjitha' })[0])
    await user.click(screen.getByRole('button', { name: /^Receta/ }))
    const recipe = screen.getByRole('dialog', { name: 'Receta' })
    await user.selectOptions(within(recipe).getByLabelText('Lloji'), 'timed')
    expect(within(recipe).getByText('Sekonda për set, si plank-u.')).toBeInTheDocument()
    const seconds = within(recipe).getByLabelText('Sekonda për set')
    await user.clear(seconds)
    await user.type(seconds, '2')
    await user.click(within(recipe).getByRole('button', { name: 'Ruaj' }))
    expect(within(recipe).getByRole('alert')).toHaveTextContent('Kohëzgjatja duhet të jetë nga 5 deri në 600 sekonda.')
    await user.type(seconds, '5')
    await user.click(within(recipe).getByRole('button', { name: 'Ruaj' }))
    expect(await screen.findByRole('button', { name: 'Receta, 25 sekonda' })).toBeInTheDocument()
    expect(router.state.location.search).toBe('?java=2')
  })
})
