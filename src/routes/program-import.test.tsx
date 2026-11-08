import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { ReadResult } from '@/data/pdf-import'
import type { LocalStore } from '@/data/store'
import { CLEAN, TABLES } from '@/data/tables'
import { language } from '@/i18n/language'
import fixture from '@/program/pdf-import.fixture.json'

// Importi nga PDF (V2-E1-11; bordi "Importo nga PDF") me store të vërtetë dhe funksionin program-import
// të imituar me përgjigjen e regjistruar të AI-së për Shortcut to Size (pa asnjë thirrje të vërtetë).
const data = vi.hoisted(() => ({ store: null as unknown as LocalStore, db: null as unknown, read: vi.fn() }))
vi.mock('@/data/app-data', async () => {
  const { createDatabase } = await import('@/data/db')
  const { createLocalStore } = await import('@/data/store')
  const { useLocalQueryFor } = await import('@/test/local-query')
  const db = createDatabase(`pdf-ui-${crypto.randomUUID()}`)
  const store = createLocalStore(db, { userId: () => '11111111-1111-4111-8111-111111111111', now: () => new Date(2026, 10, 8, 10, 0) })
  data.store = store
  data.db = db
  return { store, useLocalQuery: useLocalQueryFor(store), programImportRemote: { read: data.read } }
})

const MONTH = { month: '2026-11-01', spentEur: 1.52, limitEur: 10 }
const SUCCESS: ReadResult = {
  ok: true,
  draft: fixture as never,
  uncertain: [7, 28, 31, 42],
  usage: { inputTokens: 120_000, outputTokens: 7_000, costEur: 0.28, ms: 41_000 },
  month: MONTH,
}

async function renderAt(path: string) {
  const { ProgramsPage, ProgramEditorPage } = await import('./program-editor')
  const { ProgramImportPage } = await import('./program-import')
  const router = createMemoryRouter(
    [
      { path: '/programet', element: <ProgramsPage /> },
      { path: '/programet/importo', element: <ProgramImportPage /> },
      { path: '/programi/editori/:programId', element: <ProgramEditorPage /> },
    ],
    { initialEntries: path.split('|') },
  )
  render(<RouterProvider router={router} />)
  return router
}

const pdf = (name = 'shortcut-to-size.pdf', size = 2_400_000) => new File([new Uint8Array(size)], name, { type: 'application/pdf' })

/** Kostoja e këtij muaji siç vjen nga serveri (rreshta të sinkronizuar). */
async function spent(cost: number) {
  const db = data.db as { ai_usage: { put: (row: object) => Promise<unknown> } }
  await db.ai_usage.put({
    id: crypto.randomUUID(),
    user_id: '11111111-1111-4111-8111-111111111111',
    created_at: '2026-11-08T09:00:00Z',
    updated_at: '2026-11-08T09:00:00Z',
    deleted_at: null,
    month: '2026-11-01',
    feature: 'program_pdf',
    model: 'claude-sonnet-5-5',
    input_tokens: 1,
    output_tokens: 1,
    cost_usd: cost,
    cost_eur: cost,
    _dirty: CLEAN,
  })
}

describe('importi nga PDF', () => {
  beforeAll(async () => {
    await import('@/data/app-data')
  })
  afterEach(async () => {
    language.set('sq')
    data.read.mockReset()
    // Çdo provë nis me bazën bosh: ushtrimet e krijuara nga një import ndryshojnë përputhjen e tjetrit.
    const db = data.db as Record<string, { clear: () => Promise<void> }>
    for (const table of TABLES) await db[table].clear()
  })

  it('nga Programet: skedari, leximi, "Kontrollo 4 ushtrime", parapamja dhe drafti te ndërtuesi', async () => {
    const user = userEvent.setup()
    await spent(1.24)
    let finish: (result: ReadResult) => void = () => {}
    data.read.mockImplementation(() => new Promise<ReadResult>((resolve) => (finish = resolve)))
    const router = await renderAt('/programet')
    await user.click(await screen.findByRole('button', { name: 'Importo nga PDF' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Importo nga PDF' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/programet/importo')
    expect(screen.getByRole('heading', { level: 2, name: 'Programi nga një PDF' })).toBeInTheDocument()
    expect(await screen.findByText(/Deri në 15 MB\. .* Këtë muaj: €1,24 nga €10/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Zgjidh PDF-në' })).toBeInTheDocument()

    await user.upload(screen.getByLabelText('PDF-ja e programit'), pdf())
    expect(await screen.findByRole('status')).toHaveTextContent('AI po e lexon')
    expect(screen.getByText('shortcut-to-size.pdf')).toBeInTheDocument()
    expect(data.read).toHaveBeenCalledTimes(1)
    const [request] = data.read.mock.calls[0]
    expect(request).toMatchObject({ fileName: 'shortcut-to-size.pdf', language: 'sq' })
    expect(request.known).toContain('Barbell Bench Press - Medium Grip')
    finish(SUCCESS)

    // Karta e skedarit si te bordi: faqet, koha, kostoja dhe muaji.
    expect(await screen.findByText('18 faqe · 2,3 MB')).toBeInTheDocument()
    expect(screen.getByText(/AI e lexoi/).closest('span')).toHaveTextContent('AI e lexoi · 18 faqe në 41 s')
    expect(screen.getByText('Kostoja: €0,28 nga kufiri')).toBeInTheDocument()
    expect(screen.getByText('muaji: €1,52 nga €10')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Kufiri i AI-së: €1,52 nga €10' })).toBeInTheDocument()

    // Ushtrimet e pasigurta: Po, alternativa, Tjetër; pa emër të njohur: Shto si të ri.
    expect(screen.getByRole('heading', { level: 2, name: 'Kontrollo 4 ushtrime' })).toBeInTheDocument()
    const flye = screen.getByRole('radiogroup', { name: 'A është kjo Incline Cable Flye?' })
    expect(within(flye).getAllByRole('radio').map((option) => option.textContent)).toEqual(['Po', 'Cable Crossover', 'Tjetër'])
    expect(screen.getByText('Faqja 7 · te PDF-ja: „Incline Cable Cable Flye“')).toBeInTheDocument()
    expect(within(screen.getByRole('radiogroup', { name: 'A është kjo High Cable Curls?' })).getAllByRole('radio')).toHaveLength(2)
    const band = screen.getByRole('radiogroup', { name: 'Ushtrim i ri?' })
    expect(within(band).getAllByRole('radio').map((option) => option.textContent)).toEqual(['Shto si të ri', 'Tjetër'])

    // Parapamja: emri, numrat, blloqet dhe dita e parë e hapur.
    expect(screen.getByRole('heading', { level: 2, name: 'Shortcut to Size' })).toBeInTheDocument()
    expect(screen.getByText('4 blloqe · 13 javë · 4 ditë · 66 ushtrime')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Blloqet: Java 0 1 javë, Faza 1 4 javë, Faza 2 4 javë, Faza 3 4 javë' })).toBeInTheDocument()
    const first = screen.getByRole('button', { name: /^Dita 1 · Gjoks, triceps, pulpa/ })
    expect(first).toHaveAttribute('aria-expanded', 'true')
    expect(first).toHaveTextContent('8 të njohura · 1 për t’u kontrolluar')
    expect(screen.getByText('Barbell Bench Press - Medium Grip').closest('li')).toHaveTextContent('4 × 12–15 → 3–5')
    expect(screen.getByText('„Incline Cable Cable Flye“').closest('li')).toHaveTextContent('Kontrollo')
    const back = screen.getByRole('button', { name: /^Dita 2 · Shpinë, biceps, bark/ })
    expect(back).toHaveAttribute('aria-expanded', 'false')
    expect(back).toHaveTextContent('10 · 3 për t’u kontrolluar')
    expect(screen.getByRole('button', { name: /^Dita 3 · Shpatulla, trapez, pulpa/ })).toHaveTextContent('7 · të gjitha të njohura')
    await user.click(back)
    expect(await screen.findByText('„Band Roundhouse Elbow“')).toBeInTheDocument()

    // "Krijo programin" pret përgjigjet.
    expect(screen.getByText('Programi hapet te ndërtuesi, ku e ndryshon si të duash.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Krijo programin' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Zgjidh një përgjigje për 4 ushtrimet sipër.')
    expect(await data.store.all('programs')).toHaveLength(0)

    await user.click(within(flye).getByRole('radio', { name: 'Po' }))
    expect(within(flye).getByRole('radio', { name: 'Po' })).toHaveAttribute('aria-checked', 'true')
    await user.click(within(screen.getByRole('radiogroup', { name: 'A është kjo High Cable Curls?' })).getByRole('radio', { name: 'Po' }))
    await user.click(within(band).getByRole('radio', { name: 'Shto si të ri' }))
    // "Tjetër": kërkimi te biblioteka, në fletë.
    await user.click(within(screen.getByRole('radiogroup', { name: 'A është kjo Barbell Hip Thrust?' })).getByRole('radio', { name: 'Tjetër' }))
    const sheet = await screen.findByRole('dialog', { name: 'Zgjidh ushtrimin' })
    expect(within(sheet).getByText('Te PDF-ja: „Hip Thrust“')).toBeInTheDocument()
    await user.type(within(sheet).getByRole('searchbox'), 'reverse crunch')
    await user.click(await within(sheet).findByRole('button', { name: /^Reverse Crunch/ }))
    expect(await screen.findByText('Zgjedhur: Reverse Crunch')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Krijo programin' }))
    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/programi\/editori\//))
    const programId = router.state.location.pathname.split('/').at(-1)!
    expect(await data.store.get('programs', programId)).toMatchObject({ name: 'Shortcut to Size', draft: true })
    expect(await screen.findByLabelText('Emri i programit')).toHaveValue('Shortcut to Size')
    const exercises = await data.store.all('exercises')
    expect(exercises.map((row) => row.name)).toEqual(expect.arrayContaining(['Reverse Crunch', 'High Cable Curls', 'Band Roundhouse Elbow', 'Incline Cable Flye']))
    expect(exercises.map((row) => row.name)).not.toContain('Barbell Hip Thrust')
  })

  it('i anuluar pas leximit: asnjë program nuk mbetet', async () => {
    const user = userEvent.setup()
    data.read.mockResolvedValue(SUCCESS)
    const router = await renderAt('/programet|/programet/importo')
    await user.upload(await screen.findByLabelText('PDF-ja e programit'), pdf())
    expect(await screen.findByRole('heading', { level: 2, name: 'Kontrollo 4 ushtrime' })).toBeInTheDocument()
    const before = (await data.store.all('programs')).length
    await user.click(screen.getByRole('button', { name: 'Mbrapa' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/programet'))
    expect(await data.store.all('programs')).toHaveLength(before)
  })

  it('kufiri i arritur: AI-ja nuk thirret dhe ekrani e thotë, me ndërtuesin si rrugë tjetër', async () => {
    const user = userEvent.setup()
    await spent(9.9)
    await spent(0.2)
    const router = await renderAt('/programet|/programet/importo')
    const alert = await screen.findByRole('alert')
    expect(within(alert).getByRole('heading', { name: 'Kufiri i AI-së u arrit' })).toBeInTheDocument()
    expect(alert).toHaveTextContent('Këtë muaj AI ka harxhuar €10,10 nga €10. Leximi i PDF-ve rinis më 1 dhjetor.')
    expect(screen.queryByRole('button', { name: 'Zgjidh PDF-në' })).not.toBeInTheDocument()
    await user.click(within(alert).getByRole('button', { name: 'Ndërto vetë' }))
    expect(router.state.location.pathname).toBe('/programet')
    expect(data.read).not.toHaveBeenCalled()
  })

  it('kufiri që e arrin serveri, gabimet me koston dhe "Provo përsëri"', async () => {
    const user = userEvent.setup()
    data.read.mockResolvedValueOnce({ ok: false, error: 'no_programme', month: MONTH, costEur: 0.06 })
    await renderAt('/programet/importo')
    await user.upload(await screen.findByLabelText('PDF-ja e programit'), pdf('fatura.pdf'))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('PDF-ja nuk u lexua')
    expect(alert).toHaveTextContent('AI nuk gjeti një program stërvitjeje në këtë PDF.')
    expect(alert).toHaveTextContent('Leximi kushtoi €0,06.')
    expect(screen.queryByRole('button', { name: 'Provo përsëri' })).not.toBeInTheDocument()

    data.read.mockResolvedValueOnce({ ok: false, error: 'offline' })
    await user.click(screen.getByRole('button', { name: 'Zgjidh një PDF tjetër' }))
    await user.upload(screen.getByLabelText('PDF-ja e programit'), pdf())
    expect(await screen.findByText('Pa internet. Leximi me AI kërkon internet.')).toBeInTheDocument()
    data.read.mockResolvedValueOnce({ ok: false, error: 'limit', month: { ...MONTH, spentEur: 10.02 } })
    await user.click(screen.getByRole('button', { name: 'Provo përsëri' }))
    expect(await screen.findByText('Këtë muaj AI ka harxhuar €10,02 nga €10. Leximi i PDF-ve rinis më 1 dhjetor.')).toBeInTheDocument()
    expect(data.read).toHaveBeenCalledTimes(3)
  })

  it('skedari që nuk është PDF ose kalon 15 MB nuk dërgohet', async () => {
    const user = userEvent.setup({ applyAccept: false })
    await renderAt('/programet/importo')
    await user.upload(await screen.findByLabelText('PDF-ja e programit'), new File(['x'], 'foto.jpg', { type: 'image/jpeg' }))
    expect(await screen.findByText('Ky skedar nuk është PDF.')).toBeInTheDocument()
    await user.upload(screen.getByLabelText('PDF-ja e programit'), pdf('i-madh.pdf', 16 * 1024 * 1024))
    expect(await screen.findByText('PDF-ja kalon 15 MB. Zgjidh një më të vogël.')).toBeInTheDocument()
    expect(data.read).not.toHaveBeenCalled()
  })

  it('anglisht', async () => {
    const user = userEvent.setup()
    language.set('en')
    data.read.mockResolvedValue(SUCCESS)
    await renderAt('/programet/importo')
    expect(await screen.findByRole('heading', { level: 1, name: 'Import from PDF' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Choose the PDF' })).toBeInTheDocument()
    await user.upload(screen.getByLabelText('Programme PDF'), pdf())
    expect(await screen.findByRole('heading', { level: 2, name: 'Check 4 exercises' })).toBeInTheDocument()
    expect(data.read.mock.calls[0][0]).toMatchObject({ language: 'en' })
    expect(screen.getByText('18 pages · 2.3 MB')).toBeInTheDocument()
    expect(screen.getByText('Cost: €0.28 of the limit')).toBeInTheDocument()
    expect(screen.getByText('Page 7 · in the PDF: “Incline Cable Cable Flye”')).toBeInTheDocument()
    expect(screen.getByRole('radiogroup', { name: 'Is this Incline Cable Flye?' })).toBeInTheDocument()
    expect(screen.getByRole('radiogroup', { name: 'A new exercise?' })).toBeInTheDocument()
    expect(screen.getByText('4 blocks · 13 weeks · 4 days · 66 exercises')).toBeInTheDocument()
    // Emrat e blloqeve dhe ditëve të Shortcut to Size përkthehen si te programi (`@/i18n/domain`).
    expect(screen.getByRole('button', { name: /^Day 1 · Chest, triceps, calves/ })).toHaveTextContent('8 recognised · 1 to check')
    expect(screen.getByText('Phase 1').parentElement).toHaveTextContent('Phase 1· 4 wk')
    expect(screen.getByRole('button', { name: 'Create programme' })).toBeInTheDocument()
  })
})
