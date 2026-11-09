import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { LabelResult } from '@/data/supplement-label'
import type { LocalStore } from '@/data/store'
import { language } from '@/i18n'

// Ushqimi › Suplementet › Shto suplement (V39, V2-E2-10): me dorë, nga etiketa dhe pa internet.
const data = vi.hoisted(() => ({ store: null as unknown as LocalStore, label: null as LabelResult | null }))
vi.mock('@/data/app-data', async () => {
  const { createDatabase } = await import('@/data/db')
  const { createLocalStore } = await import('@/data/store')
  const store = createLocalStore(createDatabase(`supplement-ui-${crypto.randomUUID()}`), { userId: () => '11111111-1111-4111-8111-111111111111' })
  data.store = store
  return {
    store,
    supplementLabelRemote: { read: async () => data.label! },
    useLocalQuery: (await import('@/test/local-query')).useLocalQueryFor(store),
  }
})

const MONTH = { month: '2026-11-01', spentEur: 0.26, limitEur: 10 }
const WHEY = { name: 'Gold Standard 100% Whey', kind: 'protein' as const, doseAmount: 1, doseUnit: 'scoop' as const, scoopG: null, kcal: 120, proteinG: 24, carbsG: 3, fatG: 1.5 }

describe('Shto suplement', () => {
  beforeAll(async () => {
    await import('@/data/app-data')
    const { completeOnboarding } = await import('@/data/profile')
    await completeOnboarding(data.store, { weightKg: 88, trainingDays: [1, 2, 4, 5], trainingTime: '21:00', wakeTime: '08:20', sleepTime: '01:00' })
  })
  afterEach(() => language.set('sq'))

  async function renderPage() {
    const { SupplementEditorPage } = await import('./supplement-editor')
    const router = createMemoryRouter(
      [
        { path: '/ushqimi', element: <p>Ushqimi</p> },
        { path: '/ushqimi/suplementi', element: <SupplementEditorPage /> },
      ],
      { initialEntries: ['/ushqimi', '/ushqimi/suplementi'], initialIndex: 1 },
    )
    render(<RouterProvider router={router} />)
    // Kreu del edhe gjatë leximit: pritet fleta.
    await screen.findByRole('button', { name: 'Ruaj suplementin' })
    return router
  }

  it('me dorë: pluhur proteine me makrot për lugë, që numërohen te ushqimi', async () => {
    const user = userEvent.setup()
    await renderPage()
    const save = screen.getByRole('button', { name: 'Ruaj suplementin' })
    expect(save).toBeDisabled()
    expect(screen.getByRole('radio', { name: 'Pluhur proteine' })).toBeChecked()
    await user.type(screen.getByLabelText('Emri'), 'Whey izolat')
    await user.type(screen.getByLabelText('Gramët e një luge'), '30')
    await user.click(screen.getByRole('button', { name: 'Para gjumit' }))
    await user.type(screen.getByLabelText('kcal'), '110')
    await user.type(screen.getByLabelText('Proteina, g'), '25,5')
    expect(screen.getByRole('switch', { name: 'Numëroje te ushqimi' })).toBeChecked()
    await user.click(save)
    expect(await screen.findByText('Ushqimi')).toBeInTheDocument()
    const { supplementList } = await import('@/data/supplements')
    expect((await supplementList(data.store)).find((item) => item.name === 'Whey izolat')).toMatchObject({
      kind: 'protein',
      doseAmount: 1,
      doseUnit: 'scoop',
      scoopG: 30,
      timing: ['bedtime'],
      macros: { kcal: 110, proteinG: 25.5, carbsG: 0, fatG: 0 },
      countsAsFood: true,
    })
  })

  it('nga etiketa: 7 nga 8 fusha, luga mungon; "Vazhdo" i vendos te fleta', async () => {
    const user = userEvent.setup()
    data.label = { ok: true, fields: WHEY, read: 7, total: 8, costEur: 0.01, month: MONTH }
    await renderPage()
    await user.upload(screen.getByLabelText('Fotografo etiketën'), new File([new Uint8Array([0xff, 0xd8, 0xff])], 'etiketa.jpg', { type: 'image/jpeg' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Nga etiketa' })).toBeInTheDocument()
    expect(screen.getByText('U lexuan 7 nga 8 fusha')).toBeInTheDocument()
    expect(screen.getByText(/^Fotoja fshihet pas leximit\. AI: 0,01\s€, mbeten 9,74\s€ këtë muaj\.$/)).toBeInTheDocument()
    expect(screen.getByText('Nuk u lexua')).toBeInTheDocument()
    expect(screen.getByText('Shkruaje nga etiketa, te "Serving size".')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Vazhdo' }))
    expect(screen.getByLabelText('Emri')).toHaveValue('Gold Standard 100% Whey')
    expect(screen.getByLabelText('kcal')).toHaveValue('120')
    expect(screen.getByLabelText('Yndyrat, g')).toHaveValue('1,5')
    expect(screen.getByText('Shkruaj gramët e një luge që makrot të shkojnë te ushqimi.')).toBeInTheDocument()
  })

  it('pa internet: fleta mbetet për plotësim me dorë', async () => {
    const user = userEvent.setup()
    data.label = { ok: false, error: 'offline' }
    await renderPage()
    await user.upload(screen.getByLabelText('Fotografo etiketën'), new File([new Uint8Array([0xff, 0xd8, 0xff])], 'etiketa.jpg', { type: 'image/jpeg' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Pa internet AI-ja nuk e lexon etiketën. Plotësoje me dorë.')
    expect(screen.getByLabelText('Emri')).toBeEnabled()
  })

  it('në anglisht', async () => {
    language.set('en')
    const { SupplementEditorPage } = await import('./supplement-editor')
    const router = createMemoryRouter([{ path: '/ushqimi/suplementi', element: <SupplementEditorPage /> }], { initialEntries: ['/ushqimi/suplementi'] })
    render(<RouterProvider router={router} />)
    expect(await screen.findByText('Photograph the label')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Add supplement' })).toBeInTheDocument()
    expect(within(screen.getByRole('radiogroup', { name: 'Type' })).getByRole('radio', { name: 'Protein powder' })).toBeChecked()
    expect(screen.getByRole('button', { name: 'Save supplement' })).toBeDisabled()
  })
})
