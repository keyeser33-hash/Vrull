import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { LocalStore } from '@/data/store'
import { language } from '@/i18n/language'

// Ndërtuesi i programeve (V2-E1-10) me store të vërtetë: Programet, struktura, dita me tërheqje dhe
// sloti me nivelet, si te bordet "Programet", "Ndërto", "Dita" dhe "Sloti".
const data = vi.hoisted(() => ({ store: null as unknown as LocalStore }))
vi.mock('@/data/app-data', async () => {
  const { createDatabase } = await import('@/data/db')
  const { createLocalStore } = await import('@/data/store')
  const { useLocalQueryFor } = await import('@/test/local-query')
  const store = createLocalStore(createDatabase(`editor-ui-${crypto.randomUUID()}`), { userId: () => '11111111-1111-4111-8111-111111111111' })
  data.store = store
  return { store, useLocalQuery: useLocalQueryFor(store) }
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

/** Një program Upper/Lower i ri, si te "Ndërto nga shablloni", me emrat në gjuhën e dhënë. */
async function upperLower(names = { block: { base: 'Bazat', strength: 'Forca' }, day: { upperA: 'Sipër A', lowerA: 'Poshtë A', upperB: 'Sipër B', lowerB: 'Poshtë B' } }) {
  const { createFromTemplate, programEditor } = await import('@/data/program-editor')
  const programId = await createFromTemplate(data.store, 'upper_lower_4', {
    program: { shortcut_to_size: 'Shortcut to Size', full_body_3: 'Full body 3 ditë', upper_lower_4: 'Upper/Lower 4 ditë' },
    ...names,
  })
  return (await programEditor(data.store, programId))!
}

/** Rreshtat e listës së ditës janë 76 px me 8 px mes tyre, që tërheqja të gjejë vendin. */
function layoutRows() {
  return vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const row = this.closest('li')
    const index = row?.parentElement ? [...row.parentElement.children].indexOf(row) : 0
    return new DOMRect(0, 100 + index * 84, 358, 76)
  })
}

describe('ndërtuesi i programeve', () => {
  beforeAll(async () => {
    await import('@/data/app-data')
    const { completeOnboarding } = await import('@/data/profile')
    await completeOnboarding(data.store, { weightKg: 80, trainingDays: [1, 2, 4, 5], trainingTime: '18:00', wakeTime: '07:00', sleepTime: '23:00' })
  })
  afterEach(() => {
    language.set('sq')
    vi.restoreAllMocks()
  })

  it('nga Programi te struktura e programit aktiv dhe te Programet', async () => {
    await renderAt('/programi')
    expect(await screen.findByRole('heading', { level: 1, name: 'Shortcut to Size' }, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ndrysho programin' })).toHaveAttribute('href', expect.stringMatching(/^\/programi\/editori\//))
    expect(screen.getByRole('link', { name: 'Shiko të gjitha programet' })).toHaveAttribute('href', '/programet')
  })

  it('Programet: aktivi me javën, të mitë me draftet dhe shabllonet; pa PDF dhe pa miqtë ende', async () => {
    await upperLower()
    await renderAt('/programet')
    expect(await screen.findByRole('heading', { level: 1, name: 'Programet' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ndërto program' })).toBeInTheDocument()
    expect(screen.queryByText(/Importo nga PDF|Nga miqtë/)).not.toBeInTheDocument()

    const active = await screen.findByRole('link', { name: /^Shortcut to Size/ })
    expect(active).toHaveTextContent('Java 0 · 4 ditë në javë')
    expect(active).toHaveTextContent('Aktiv')
    expect(active).toHaveTextContent('java 1 nga 13 · historia dhe treguesi ruhen')
    expect(within(active).getByRole('img', { name: 'Java 1 nga 13' })).toBeInTheDocument()

    const mine = screen.getByRole('region', { name: 'Të mitë' })
    expect(within(mine).getByRole('link', { name: /Upper\/Lower 4 ditë/ })).toHaveTextContent('Draft · 2 blloqe · 4 ditë')
    const templates = screen.getByRole('region', { name: 'Shabllonet' })
    expect(within(templates).getAllByRole('button').map((row) => row.textContent)).toEqual([
      'Shortcut to Size13 javë · 4 ditë · Jim Stoppani',
      'Full body 3 ditë8 javë · 3 ditë · për fillestarë',
      'Upper/Lower 4 ditë8 javë · 4 ditë · sipër dhe poshtë',
    ])
  })

  it('Ndërto nga shablloni: struktura, javët e blloqeve, progresi i zgjuar, "Ruaj programin" dhe "Fillo programin"', async () => {
    const user = userEvent.setup()
    const router = await renderAt('/programi|/programet')
    await user.click(await screen.findByRole('button', { name: /^Full body 3 ditë/ }))
    const sheet = screen.getByRole('dialog', { name: 'Full body 3 ditë' })
    expect(within(sheet).getAllByRole('listitem').map((day) => day.textContent)).toEqual(['1Dita A5 ushtrime', '2Dita B5 ushtrime', '3Dita C6 ushtrime'])
    await user.click(within(sheet).getByRole('button', { name: 'Ndërto nga shablloni' }))

    expect(await screen.findByText('Program i ri · struktura')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mbyll ndërtuesin' })).toBeInTheDocument()
    expect(screen.getByLabelText('Emri i programit')).toHaveValue('Full body 3 ditë')
    expect(screen.getByText('Nisur nga shablloni Full body 3 ditë')).toBeInTheDocument()
    expect(screen.getByText('8 javë gjithsej')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Bazat, javët 1–4' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Forca, javët 5–8' })).toBeInTheDocument()

    const strength = screen.getByRole('group', { name: 'Javët e bllokut Forca' })
    await user.click(within(strength).getByRole('button', { name: 'Një javë më pak' }))
    expect(await screen.findByText('7 javë gjithsej')).toBeInTheDocument()
    expect(within(strength).getByText('3 javë')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Shto bllok' }))
    expect(await screen.findByRole('button', { name: 'Blloku 3, javët 8–10' })).toBeInTheDocument()

    expect(screen.getByText('3 në javë')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^Dita 1, Dita A: 5 ushtrime · ~\d+ min$/ })).toBeInTheDocument()

    // Progresi i zgjuar: i ndezur, RIR ≥ 2 dhe +2,5 kg; me dumbbell +2 (hapi 2 kg).
    const smart = screen.getByRole('region', { name: 'Progresi i zgjuar' })
    expect(within(smart).getByRole('switch', { name: 'Progresi i zgjuar' })).toHaveAttribute('aria-checked', 'true')
    expect(within(smart).getByText(/Me dumbbell shtesa është \+2 kg/)).toBeInTheDocument()
    await user.selectOptions(within(smart).getByRole('combobox', { name: 'Pragu i RIR-it' }), '3')
    const programId = router.state.location.pathname.split('/').at(-1)!
    await waitFor(async () => expect((await data.store.get('programs', programId))?.progression).toEqual({ minRir: 3, incrementKg: 2.5 }))

    await user.click(screen.getByRole('button', { name: 'Ruaj programin' }))
    const saved = await screen.findByRole('dialog', { name: 'Programi u ruajt' })
    expect((await data.store.get('programs', programId))?.draft).toBe(false)
    await user.click(within(saved).getByRole('button', { name: 'Fillo programin' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/programi'))
    expect((await data.store.all('user_settings'))[0].active_program_id).toBe(programId)
    expect(await screen.findByRole('heading', { level: 1, name: 'Full body 3 ditë' })).toBeInTheDocument()
    // Provat e tjera nisin me Shortcut to Size aktiv; ekrani mbyllet para ndërrimit.
    cleanup()
    const { switchProgram } = await import('@/data/training')
    const { programList } = await import('@/data/program-editor')
    await switchProgram(data.store, (await programList(data.store)).find((program) => program.name === 'Shortcut to Size')!.id)
  })

  it('dita: ushtrimet me recetën dhe blloqet që ndryshojnë; radha me shigjetat dhe me tërheqje', async () => {
    const view = await upperLower()
    const [upperA] = view.days
    const user = userEvent.setup()
    await renderAt(`/programi/editori/${view.id}|/programi/editori/${view.id}/dita/${upperA.id}`)

    expect(await screen.findByRole('heading', { level: 1, name: 'Sipër A' })).toBeInTheDocument()
    expect(screen.getByText(/^Dita 1 nga 4 · 6 ushtrime · ~\d+ min$/)).toBeInTheDocument()
    const list = screen.getByRole('list', { name: 'Ushtrimet e ditës me radhë' })
    const rows = () => within(list).getAllByRole('link').map((link) => link.textContent)
    expect(rows()[0]).toBe('1 · Bench Press4 × 6–8 · RIR 2 · pushim 2:30Te blloku Forca: 4 × 4–6 · RIR 1')
    // Ushtrimi i Shortcut to Size me të njëjtën ID të bibliotekës ripërdoret (Side_Lateral_Raise).
    expect(rows()[4]).toBe('5 · Dumbbell Lateral Raise3 × 12–15 · RIR 1 · pushim 1:00')

    // Për aksesueshmërinë: prekja e dorezës shfaq "lart" dhe "poshtë"; shigjetat e tastierës lëvizin.
    const handle = screen.getByRole('button', { name: 'Tërhiq për radhitje: Bench Press' })
    await user.click(handle)
    expect(handle).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Zhvendose lart: Bench Press' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Zhvendose poshtë: Bench Press' }))
    await waitFor(() => expect(rows()[1]).toMatch(/^2 · Bench Press/))
    expect(screen.getByRole('status')).toHaveTextContent('Bench Press: vendi 2 nga 6')
    handle.focus()
    await user.keyboard('{ArrowDown}')
    await waitFor(() => expect(rows()[2]).toMatch(/^3 · Bench Press/))

    // Tërheqja me miun: Bench Press (i treti) shkon i pari.
    layoutRows()
    const drag = screen.getByRole('button', { name: 'Tërhiq për radhitje: Bench Press' })
    fireEvent.pointerDown(drag, { pointerId: 1, pointerType: 'mouse', button: 0, clientY: 300 })
    fireEvent.pointerMove(drag, { pointerId: 1, pointerType: 'mouse', clientY: 250 })
    fireEvent.pointerMove(drag, { pointerId: 1, pointerType: 'mouse', clientY: 120 })
    expect(screen.getByRole('listitem', { name: 'Bench Press, duke u tërhequr' })).toBeInTheDocument()
    fireEvent.pointerUp(drag, { pointerId: 1, pointerType: 'mouse', clientY: 120 })
    fireEvent.click(drag)
    await waitFor(() => expect(rows()[0]).toMatch(/^1 · Bench Press/))
    expect(drag).toHaveAttribute('aria-pressed', 'false')
    const { programEditor } = await import('@/data/program-editor')
    expect((await programEditor(data.store, view.id))!.days[0].slots.map((slot) => slot.name).slice(0, 3)).toEqual(['Bench Press', 'Wide-Grip Pulldown', 'Incline Dumbbell Press'])

    // Prekja e gjatë me gisht: pa pritur, lëvizja e gishtit nuk e nis tërheqjen.
    fireEvent.pointerDown(drag, { pointerId: 2, pointerType: 'touch', button: 0, clientY: 138 })
    fireEvent.pointerMove(drag, { pointerId: 2, pointerType: 'touch', clientY: 400 })
    expect(screen.queryByRole('listitem', { name: /duke u tërhequr/ })).not.toBeInTheDocument()
    fireEvent.pointerUp(drag, { pointerId: 2, pointerType: 'touch', clientY: 400 })

    await user.click(screen.getByRole('button', { name: 'Shto ushtrim' }))
    const picker = screen.getByRole('dialog', { name: 'Shto ushtrim' })
    expect(picker).toHaveAccessibleDescription('Del i fundit te Sipër A, me 3 sete dhe 8–12 përsëritje me RIR 2. I ndryshon pas shtimit.')
    await user.type(within(picker).getByLabelText('Kërko ushtrimin'), 'goblet squat')
    await user.click(await within(picker).findByRole('button', { name: /^Goblet Squat/ }))
    await waitFor(() => expect(rows()[6]).toBe('7 · Goblet Squat3 × 8–12 · RIR 2 · pushim 1:30'))
  })

  it('sloti: niveli "Ky bllok", vlerat me burimin, RIR-i dhe "Ruaj për bllokun Forca"; "Hiq ndryshimin"', async () => {
    const view = await upperLower()
    const bench = view.days[0].slots[0]
    const strength = view.blocks[1]
    const user = userEvent.setup()
    const dayPath = `/programi/editori/${view.id}/dita/${view.days[0].id}`
    const router = await renderAt(`${dayPath}|/programi/editori/${view.id}/sloti/${bench.id}`)

    expect(await screen.findByRole('heading', { level: 1, name: 'Bench Press' })).toBeInTheDocument()
    expect(screen.getByText('Sipër A · ushtrimi 1')).toBeInTheDocument()
    expect(screen.getByText('Gjoksi · ndihmës: gjoksi i sipërm, deltoidi i përparmë, tricepsi')).toBeInTheDocument()
    const level = screen.getByRole('radiogroup', { name: 'Niveli' })
    expect(within(level).getByRole('radio', { name: 'Gjithë programi' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('button', { name: 'Përsëritjet: 6–8' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ruaj për gjithë programin' })).toBeEnabled()

    await user.click(within(level).getByRole('radio', { name: 'Ky bllok' }))
    await user.click(within(screen.getByRole('radiogroup', { name: 'Cili bllok' })).getByRole('radio', { name: 'Forca' }))
    expect(router.state.location.search).toBe(`?blloku=${strength.id}`)
    expect(screen.getByText('Forca ndryshon 1 vlerë. Të tjerat vijnë nga programi.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Përsëritjet: 4–6' })).toBeInTheDocument()
    expect(screen.getAllByText('blloku Forca · programi 6–8')).toHaveLength(1)
    expect(screen.getByText('blloku Forca · programi 2')).toBeInTheDocument()
    const sets = screen.getByRole('group', { name: 'Setet: 4' })
    expect(within(sets.parentElement!).getByText('nga programi')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '1' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: '2' }))
    await user.click(screen.getByRole('button', { name: 'Një set më pak' }))
    await user.click(screen.getByRole('button', { name: 'Rest-pause' }))
    await user.click(screen.getByRole('button', { name: 'Ruaj për bllokun Forca' }))
    // "Ruaj për…" ruan dhe kthehet te dita, që e thotë ndryshimin e bllokut.
    expect(await screen.findByRole('heading', { level: 1, name: 'Sipër A' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(dayPath)
    expect(screen.getByRole('link', { name: /^1 · Bench Press/ })).toHaveTextContent('Te blloku Forca: 3 × 4–6 · RIR 2')
    const { programEditor } = await import('@/data/program-editor')
    const plans = (await programEditor(data.store, view.id))!
    expect(plans.plan(strength.id, 2, view.days[0].id).slots[0]).toMatchObject({ sets: 3, target: { min: 4, max: 6, rir: { min: 2, max: 2 } }, technique: { type: 'rest_pause' } })
    expect(plans.plan(view.blocks[0].id, 2, view.days[0].id).slots[0]).toMatchObject({ sets: 4, technique: { type: 'none' } })

    await user.click(screen.getByRole('link', { name: /^1 · Bench Press/ }))
    await user.click(within(await screen.findByRole('radiogroup', { name: 'Niveli' })).getByRole('radio', { name: 'Ky bllok' }))
    await user.click(within(screen.getByRole('radiogroup', { name: 'Cili bllok' })).getByRole('radio', { name: 'Forca' }))
    expect(screen.getByText('Forca ndryshon 3 vlera. Të tjerat vijnë nga programi.')).toBeInTheDocument()

    // Receta te fleta: intervali i ri vlen pas "Ruaj për…".
    await user.click(screen.getByRole('button', { name: 'Përsëritjet: 4–6' }))
    const recipe = screen.getByRole('dialog', { name: 'Receta' })
    expect(recipe).toHaveAccessibleDescription('Vlen për: blloku Forca.')
    const max = within(recipe).getByLabelText('Përsëritje, max')
    await user.clear(max)
    await user.type(max, '3')
    await user.click(within(recipe).getByRole('button', { name: 'Përdor recetën' }))
    expect(within(recipe).getByRole('alert')).toHaveTextContent('Maksimumi duhet të jetë sa minimumi ose më shumë.')
    await user.clear(max)
    await user.type(max, '5')
    await user.click(within(recipe).getByRole('button', { name: 'Përdor recetën' }))
    expect(await screen.findByRole('button', { name: 'Përsëritjet: 4–5' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: 'Hiq ndryshimin' }))
    expect(await screen.findByText('Forca: ende pa ndryshime. Vlerat vijnë nga programi.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Përsëritjet: 6–8' })).toBeInTheDocument()
  })

  it('sloti: progresi i zgjuar si programi ose me rregull më vete në nivelin e zgjedhur', async () => {
    const view = await upperLower()
    const curl = view.days[0].slots[5]
    const user = userEvent.setup()
    await renderAt(`/programi/editori/${view.id}/sloti/${curl.id}`)
    const smart = await screen.findByRole('region', { name: 'Progresi i zgjuar' })
    expect(within(smart).getByRole('radio', { name: 'Si programi' })).toHaveAttribute('aria-checked', 'true')
    expect(smart).toHaveTextContent('Programi: RIR ≥ 2, +2,5 kg. Propozimi del te seanca.')
    await user.click(within(smart).getByRole('radio', { name: 'Rregull më vete' }))
    await user.selectOptions(within(smart).getByRole('combobox', { name: 'Pragu i RIR-it' }), '1')
    await user.selectOptions(within(smart).getByRole('combobox', { name: 'Shtesa' }), '1')
    await user.click(screen.getByRole('button', { name: 'Ruaj për gjithë programin' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Sipër A' })).toBeInTheDocument()
    const { programEditor } = await import('@/data/program-editor')
    const plan = (await programEditor(data.store, view.id))!.plan(view.blocks[0].id, 1, view.days[0].id).slots[5]
    expect(plan.progression).toEqual({ minRir: 1, incrementKg: 1 })
  })

  it('anglisht: struktura dhe dita e një programi të ndërtuar në anglisht', async () => {
    language.set('en')
    const view = await upperLower({ block: { base: 'Foundations', strength: 'Strength' }, day: { upperA: 'Upper A', lowerA: 'Lower A', upperB: 'Upper B', lowerB: 'Lower B' } })
    const user = userEvent.setup()
    await renderAt(`/programi/editori/${view.id}`)
    expect(await screen.findByText('New programme · structure')).toBeInTheDocument()
    expect(screen.getByLabelText('Programme name')).toBeInTheDocument()
    expect(screen.getByText('8 weeks in total')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Foundations, weeks 1–4' })).toBeInTheDocument()
    expect(screen.getByText('4 a week')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Smart progression' })).toHaveTextContent('When every set reaches the top of the range at RIR')
    expect(screen.getByRole('button', { name: 'Save programme' })).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: /^Day 1, Upper A/ }))
    expect(await screen.findByText(/^Day 1 of 4 · 6 exercises · ~\d+ min$/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^1 · Bench Press/ })).toHaveTextContent('4 × 6–8 · RIR 2 · rest 2:30In the Strength block: 4 × 4–6 · RIR 1')
    expect(screen.getByRole('button', { name: 'Add exercise' })).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/Ushtrim|javë|Ruaj|pushim/)
  })
})
