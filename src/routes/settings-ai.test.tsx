import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { LocalStore } from '@/data/store'
import { CLEAN } from '@/data/tables'
import { language } from '@/i18n/language'

// Cilësimet › AI (V2-E1-11; bordi "Cilësimet · AI") dhe grupi "AI" te Cilësimet, me rreshtat e kostos
// siç vijnë nga serveri.
const data = vi.hoisted(() => ({ store: null as unknown as LocalStore, db: null as unknown }))
vi.mock('@/data/app-data', async () => {
  const { createDatabase } = await import('@/data/db')
  const { createLocalStore } = await import('@/data/store')
  const { useLocalQueryFor } = await import('@/test/local-query')
  const db = createDatabase(`ai-ui-${crypto.randomUUID()}`)
  const store = createLocalStore(db, { userId: () => '11111111-1111-4111-8111-111111111111', now: () => new Date(2026, 10, 8, 10, 0) })
  data.store = store
  data.db = db
  return { store, useLocalQuery: useLocalQueryFor(store) }
})

async function spent(month: string, cost: number) {
  const db = data.db as { ai_usage: { put: (row: object) => Promise<unknown> } }
  await db.ai_usage.put({
    id: crypto.randomUUID(),
    user_id: '11111111-1111-4111-8111-111111111111',
    created_at: '2026-11-08T09:00:00Z',
    updated_at: '2026-11-08T09:00:00Z',
    deleted_at: null,
    month,
    feature: 'program_pdf',
    model: 'claude-sonnet-5-5',
    input_tokens: 1,
    output_tokens: 1,
    cost_usd: cost,
    cost_eur: cost,
    _dirty: CLEAN,
  })
}

async function renderAt(path: string) {
  const { AiSettingsPage, AiUsageGroup } = await import('./settings-ai')
  const router = createMemoryRouter(
    [
      { path: '/cilesimet/ai', element: <AiSettingsPage /> },
      { path: '/cilesimet', element: <AiUsageGroup /> },
    ],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />)
}

describe('Cilësimet › AI', () => {
  beforeAll(async () => {
    await import('@/data/app-data')
  })
  afterEach(async () => {
    language.set('sq')
    await (data.db as { ai_usage: { clear: () => Promise<void> } }).ai_usage.clear()
  })

  it('muaji, sa mbetet deri më 1 dhjetor, ku shkon dhe kufiri', async () => {
    await spent('2026-11-01', 0.6)
    await spent('2026-11-01', 0.8)
    await spent('2026-10-01', 3)
    await renderAt('/cilesimet/ai')
    expect(await screen.findByRole('heading', { level: 1, name: 'AI' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { level: 2, name: 'Nëntori' })).toBeInTheDocument()
    expect(screen.getByText('1,40')).toBeInTheDocument()
    expect(screen.getByText('€ nga €10')).toBeInTheDocument()
    expect(screen.getByText(/Mbeten €8,60/)).toHaveTextContent('Mbeten €8,60 deri më 1 dhjetor')
    expect(screen.getByRole('meter', { name: 'Përdorimi i AI-së këtë muaj' })).toHaveAttribute('aria-valuetext', '€1,40 nga €10')
    expect(screen.getByText('Leximi i PDF-ve').closest('li')).toHaveTextContent('Mbush ndërtuesin e programit€1,40')
    // Ushqimi dhe shpjegimet vijnë me Etapat 2 dhe 3; kufiri ndryshohet nga faqja e Adminit (V31).
    expect(screen.queryByText(/Foto e pjatës|Ushqimi me fjalë|Pse\?/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ndrysho kufirin' })).not.toBeInTheDocument()
    expect(screen.getByText(/AI ndalet deri më 1 dhjetor\./)).toBeInTheDocument()
    expect(screen.getByText('Admini, për çdo person veçmas. Yti është €10 në muaj.')).toBeInTheDocument()
  })

  it('te kufiri: AI rinis më 1 të muajit tjetër', async () => {
    await spent('2026-11-01', 10.05)
    await renderAt('/cilesimet/ai')
    expect(await screen.findByText('10,05')).toBeInTheDocument()
    expect(screen.getByText('Kufiri u arrit')).toBeInTheDocument()
    expect(screen.getByText('AI rinis më 1 dhjetor')).toBeInTheDocument()
  })

  it('grupi "AI" te Cilësimet hap faqen', async () => {
    await spent('2026-11-01', 1.4)
    await renderAt('/cilesimet')
    const row = await screen.findByRole('link', { name: 'Përdorimi këtë muaj, €1,40 nga €10' })
    expect(row).toHaveAttribute('href', '/cilesimet/ai')
    expect(row).toHaveTextContent('Përdorimi këtë muaj€1,40nga €10')
  })

  it('anglisht', async () => {
    language.set('en')
    await spent('2026-11-01', 1.4)
    await renderAt('/cilesimet/ai')
    expect(await screen.findByRole('heading', { level: 2, name: 'November' })).toBeInTheDocument()
    expect(screen.getByText('1.40')).toBeInTheDocument()
    expect(screen.getByText('€ of €10')).toBeInTheDocument()
    expect(screen.getByText(/€8.60 left/)).toHaveTextContent('€8.60 left until 1 December')
    expect(screen.getByText('Reading PDFs')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'What uses AI' })).toBeInTheDocument()
  })
})
