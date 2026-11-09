import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { AdminPerson, AdminResult } from '@/data/ai-admin'
import { language } from '@/i18n'

// Cilësimet › Admini › Kufiri i AI-së (V42, V2-E2-17; bordi V22-Admin-Kufiri).
const zero = { eur: 0, count: 0 }
const person = (fields: Partial<AdminPerson>): AdminPerson => ({
  id: '11111111-1111-4111-8111-111111111111',
  name: 'pronari',
  isAdmin: false,
  limitEur: 10,
  spentEur: 0,
  byFeature: { food_text: zero, food_photo: zero, supplement_label: zero, program_pdf: zero, explain: zero },
  ...fields,
})
const PEOPLE = [
  person({ isAdmin: true, limitEur: 40, spentEur: 0.46, byFeature: { food_text: { eur: 0.21, count: 180 }, food_photo: { eur: 0.19, count: 38 }, supplement_label: zero, program_pdf: { eur: 0.06, count: 1 }, explain: zero } }),
  person({ id: '22222222-2222-4222-8222-222222222222', name: 'Arben', spentEur: 0.08 }),
  person({ id: '33333333-3333-4333-8333-333333333333', name: 'Klea', spentEur: 10 }),
]
const data = vi.hoisted(() => ({
  list: vi.fn(async (): Promise<AdminResult> => ({ ok: false, error: 'failed' })),
  setLimit: vi.fn(async (_id: string, _limit: number): Promise<AdminResult> => ({ ok: false, error: 'failed' })),
}))
vi.mock('@/data/app-data', () => ({ aiAdminRemote: { list: data.list, setLimit: data.setLimit } }))

async function renderPage() {
  const { AdminAiPage } = await import('./admin-ai')
  const router = createMemoryRouter(
    [
      { path: '/cilesimet', element: <h1>Cilësimet</h1> },
      { path: '/cilesimet/admin', element: <AdminAiPage /> },
    ],
    { initialEntries: ['/cilesimet', '/cilesimet/admin'], initialIndex: 1 },
  )
  render(<RouterProvider router={router} />)
}

describe('Kufiri i AI-së', () => {
  beforeEach(() => {
    data.list.mockResolvedValue({ ok: true, month: '2026-11-01', people: PEOPLE })
    data.setLimit.mockReset()
  })
  afterEach(() => {
    language.set('sq')
    vi.restoreAllMocks()
  })

  it('pronari me koston sipas veçorisë; miqtë; ai që arriti kufirin e thotë; −/+ 5 € dhe "Ruaj ndryshimet"', async () => {
    const user = userEvent.setup()
    data.setLimit.mockImplementation(async (id, limit) => ({ ok: true, month: '2026-11-01', people: PEOPLE.map((item) => (item.id === id ? { ...item, limitEur: limit } : item)) }))
    await renderPage()
    const owner = await screen.findByRole('region', { name: 'Ti (pronari)' })
    expect(owner).toHaveTextContent(/0,46\s€\s*nga 40\s€/)
    expect(within(owner).getByText(/180 mesazhe/)).toBeInTheDocument()
    expect(within(owner).getByText(/38 foto/)).toBeInTheDocument()
    expect(screen.getByText('Kostot e të gjitha veçorive numërohen bashkë. Kufiri rinis më 1 dhjetor.')).toBeInTheDocument()
    const klea = screen.getByRole('region', { name: 'Klea' })
    expect(klea).toHaveTextContent('Arriti kufirin. Kutia dhe fotoja i janë mbyllur deri më 1 dhjetor; regjistrimi me dorë punon.')
    expect(screen.getByRole('region', { name: 'Arben' })).not.toHaveTextContent('Arriti kufirin')

    const save = screen.getByRole('button', { name: 'Ruaj ndryshimet' })
    expect(save).toBeDisabled()
    await user.click(within(klea).getByRole('button', { name: 'Ngri kufirin e Klea me 5 €' }))
    expect(within(klea).getByRole('group', { name: 'Kufiri në muaj' })).toHaveTextContent(/15\s€/)
    await user.click(save)
    expect(data.setLimit).toHaveBeenCalledWith('33333333-3333-4333-8333-333333333333', 15)
    expect(await screen.findByRole('button', { name: 'Ruaj ndryshimet' })).toBeDisabled()
    expect(screen.getByRole('region', { name: 'Klea' })).not.toHaveTextContent('Arriti kufirin')
  })

  it('pa internet, jo admin', async () => {
    data.list.mockResolvedValueOnce({ ok: false, error: 'offline' })
    await renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent('Kufiri i AI-së kërkon internet.')
  })

  it('jo admin; anglisht', async () => {
    language.set('en')
    data.list.mockResolvedValueOnce({ ok: false, error: 'forbidden' })
    await renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent('This page is only for the admin.')
    expect(screen.getByRole('heading', { level: 1, name: 'AI limit' })).toBeInTheDocument()
  })
})
