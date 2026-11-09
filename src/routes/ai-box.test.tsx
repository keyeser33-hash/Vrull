import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { Draft, ParseRequest } from '../../supabase/functions/log-parse/shared'
import type { BoxResult } from '@/data/ai-box'
import type { LocalStore } from '@/data/store'
import { language } from '@/i18n'
import { boxText } from '@/lib/box-text'

// Kutia e AI-së (V40, V2-E2-13; bordet V22-Kutia-*): dërgimi, pyetja, përmbledhja, regjistrimi dhe pa internet.
const data = vi.hoisted(() => ({
  store: null as unknown as LocalStore,
  requests: [] as ParseRequest[],
  reply: null as null | ((request: ParseRequest) => BoxResult),
}))
vi.mock('@/data/app-data', async () => {
  const { createDatabase } = await import('@/data/db')
  const { createLocalStore } = await import('@/data/store')
  const store = createLocalStore(createDatabase(`ai-box-ui-${crypto.randomUUID()}`), { userId: () => '11111111-1111-4111-8111-111111111111' })
  data.store = store
  return {
    store,
    boxRemote: {
      parse: async (request: ParseRequest) => {
        data.requests.push(request)
        return data.reply!(request)
      },
    },
    useLocalQuery: (await import('@/test/local-query')).useLocalQueryFor(store),
  }
})

const MONTH = { month: '2026-11-01', spentEur: 0.2, limitEur: 10 }
const empty: Draft = {
  foods: [],
  water: [],
  supplements: [],
  sets: [],
  answer: null,
  notUnderstood: [],
}
const ref = (request: ParseRequest, name: string) => request.context.foods.find((food) => food.name === name)!.ref
const supplementRef = (request: ParseRequest, name: string) => request.context.supplements.find((supplement) => supplement.name === name)!.ref
const PANETONE = { kcal: 362, proteinG: 6.5, carbsG: 55, fatG: 13 }
const panetone = (grams: number | null): Draft['foods'][number] => ({
  said: 'panetone',
  ref: null,
  name: 'Panetone',
  grams,
  portion: grams ? '' : '',
  estimated: false,
  per100: PANETONE,
  options: grams
    ? []
    : [
        { label: '1 fetë', grams: 80 },
        { label: '2 feta', grams: 160 },
        { label: '3 feta', grams: 240 },
      ],
  meal: 'dinner',
  time: null,
  day: 0,
})

/** Mesazhi shembull i pronarit (08.11.2026), siç e ktheu AI-ja e vërtetë (MESIMET, "AI-ja"). */
const example = (request: ParseRequest): BoxResult => ({
  ok: true,
  costEur: 0.00103,
  month: MONTH,
  draft: {
    ...empty,
    foods: [
      {
        said: 'dy tost',
        ref: ref(request, 'Bukë integrale'),
        name: 'Bukë integrale',
        grams: 64,
        portion: '2 feta',
        estimated: false,
        per100: null,
        options: [],
        meal: null,
        time: '12:00',
        day: 0,
      },
      {
        said: 'gjysmë pule',
        ref: null,
        name: 'Pulë e pjekur me lëkurë',
        grams: 300,
        portion: 'gjysmë pule',
        estimated: true,
        per100: { kcal: 239, proteinG: 27.3, carbsG: 0, fatG: 13.6 },
        options: [],
        meal: 'dinner',
        time: null,
        day: 0,
      },
      panetone(null),
    ],
    supplements: [
      {
        ref: supplementRef(request, 'Kreatinë'),
        amount: 1,
        meal: null,
        time: null,
        day: 0,
      },
    ],
    water: [{ ml: 500, time: null, day: 0 }],
  },
})

describe('Kutia e AI-së', () => {
  beforeAll(async () => {
    await import('@/data/app-data')
    const { completeOnboarding } = await import('@/data/profile')
    const { ensureSupplements } = await import('@/data/supplements')
    await completeOnboarding(data.store, {
      weightKg: 88,
      trainingDays: [1, 2, 4, 5],
      trainingTime: '21:00',
      wakeTime: '08:20',
      sleepTime: '01:00',
    })
    await ensureSupplements(data.store)
  })
  beforeEach(async () => {
    data.requests = []
    boxText.set('')
    for (const table of ['diary_entries', 'supplement_logs', 'water_logs'] as const) for (const row of await data.store.all(table)) await data.store.remove(table, row.id)
  })
  afterEach(() => {
    language.set('sq')
    vi.restoreAllMocks()
  })

  async function renderPage(state?: { photo: NonNullable<ParseRequest['image']>; text: string }) {
    const { AiBoxPage } = await import('./ai-box')
    const router = createMemoryRouter(
      [
        { path: '/', element: <p>Sot</p> },
        { path: '/kutia', element: <AiBoxPage /> },
      ],
      { initialEntries: ['/', state ? { pathname: '/kutia', state } : '/kutia'], initialIndex: 1 },
    )
    render(<RouterProvider router={router} />)
    await screen.findByRole('heading', { name: 'Kutia e AI-së' })
    return router
  }

  it('mesazhi shembull: pyetja për panetonen, përmbledhja dhe regjistrimi me një prekje', async () => {
    const user = userEvent.setup()
    data.reply = example
    await renderPage()
    const message = 'Në 12:00 hëngra dy tost. Në darkë gjysmë pule dhe panetone. Mora edhe kreatinën dhe dy gota ujë.'
    await user.type(screen.getByLabelText('Shkruaj ose thuaj çfarë bëre'), message)
    // Teksti ruhet në telefon që në shkrim (pa internet mbetet).
    expect(boxText.get()).toBe(message)
    await user.click(screen.getByRole('button', { name: 'Dërgo' }))

    expect(await screen.findByRole('heading', { name: 'Sa panetone hëngre?' })).toBeInTheDocument()
    expect(data.requests[0]).toMatchObject({ text: message, history: [] })
    const understood = screen.getByRole('region', { name: 'Çfarë kuptova' })
    expect(within(understood).getByText('sa?')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^1 fetë · 80\sg$/ }))

    expect(await screen.findByRole('heading', { name: 'Kontrollo dhe regjistro' })).toBeInTheDocument()
    // Orët e vakteve vijnë me ditën nga baza: pritet grupi me orën.
    const dinner = await screen.findByRole('region', {
      name: /^Darka · \d\d:\d\d$/,
    })
    expect(within(dinner).getByText('Pulë e pjekur me lëkurë')).toBeInTheDocument()
    expect(within(dinner).getByText(/gjysmë pule · 300 g · vlerësim/)).toBeInTheDocument()
    expect(within(dinner).getByText('Panetone')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Suplementet' })).toHaveTextContent('Kreatinë')
    expect(screen.getByRole('region', { name: 'Uji' })).toHaveTextContent('500 ml')
    expect(screen.getByText('AI · rreth 0,001 €')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Regjistro të gjitha' }))
    expect(await screen.findByText('Sot')).toBeInTheDocument()
    const entries = await data.store.all('diary_entries')
    expect(entries.map((row) => Number(row.grams)).sort((a, b) => a - b)).toEqual([64, 80, 300])
    expect(await data.store.all('supplement_logs')).toHaveLength(1)
    expect((await data.store.all('water_logs')).map((row) => Number(row.ml))).toEqual([500])
    expect(boxText.get()).toBe('')
  })

  it('përgjigja e lirë dërgohet me bisedën dhe plotëson rreshtin', async () => {
    const user = userEvent.setup()
    data.reply = (request) =>
      request.history?.length
        ? {
            ok: true,
            costEur: 0.0002,
            month: MONTH,
            draft: { ...empty, foods: [panetone(120)] },
          }
        : {
            ok: true,
            costEur: 0.001,
            month: MONTH,
            draft: { ...empty, foods: [panetone(null)] },
          }
    await renderPage()
    await user.type(screen.getByLabelText('Shkruaj ose thuaj çfarë bëre'), 'panetone në darkë')
    await user.click(screen.getByRole('button', { name: 'Dërgo' }))
    await user.type(await screen.findByLabelText('Përgjigju ose shto diçka'), 'një fetë e gjysmë')
    await user.click(screen.getByRole('button', { name: 'Dërgo' }))
    expect(await screen.findByRole('heading', { name: 'Kontrollo dhe regjistro' })).toBeInTheDocument()
    expect(data.requests[1]).toMatchObject({
      text: 'një fetë e gjysmë',
      history: [
        { role: 'user', text: 'panetone në darkë' },
        { role: 'assistant', text: 'Sa panetone hëngre?' },
      ],
    })
    expect(screen.getByText(/120 g/)).toBeInTheDocument()
  })

  it('një rresht ndryshohet (gramët, vakti) ose hiqet para regjistrimit', async () => {
    const user = userEvent.setup()
    data.reply = () => ({
      ok: true,
      costEur: 0.0002,
      month: MONTH,
      draft: { ...empty, foods: [panetone(80)] },
    })
    await renderPage()
    await user.type(screen.getByLabelText('Shkruaj ose thuaj çfarë bëre'), 'një fetë panetone')
    await user.click(screen.getByRole('button', { name: 'Dërgo' }))
    await user.click(await screen.findByRole('button', { name: 'Ndrysho Panetone' }))
    const sheet = screen.getByRole('dialog', { name: 'Panetone' })
    await user.click(within(sheet).getByRole('button', { name: 'Më shumë' }))
    await user.click(within(sheet).getByRole('button', { name: 'Para gjumit' }))
    await user.click(within(sheet).getByRole('button', { name: 'Gati' }))
    expect(screen.getByRole('region', { name: /^Para gjumit/ })).toHaveTextContent('90 g')
    await user.click(screen.getByRole('button', { name: 'Ndrysho Panetone' }))
    await user.click(within(screen.getByRole('dialog', { name: 'Panetone' })).getByRole('button', { name: 'Hiqe nga lista' }))
    expect(screen.getByText(/Nuk gjeta asgjë për të regjistruar/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Regjistro të gjitha' })).toBeDisabled()
  })

  it('setet te stërvitja e radhës: tabela, pyetja për ushtrimin shtesë dhe regjistrimi', async () => {
    const user = userEvent.setup()
    data.reply = (request) => {
      const next = request.context.workouts.find((workout) => workout.status === 'next')!
      return {
        ok: true,
        costEur: 0.0004,
        month: MONTH,
        draft: {
          ...empty,
          sets: [
            { said: 'bench', workoutRef: next.ref, exerciseRef: next.exercises[0].ref, exerciseName: next.exercises[0].name, sets: [1, 2, 3].map(() => ({ reps: 10, weightKg: 60, rir: null })), day: 0 },
            { said: 'dips', workoutRef: next.ref, exerciseRef: null, exerciseName: 'Dips', sets: [1, 2].map(() => ({ reps: 12, weightKg: null, rir: 2 })), day: 0 },
          ],
        },
      }
    }
    await renderPage()
    await user.type(screen.getByLabelText('Shkruaj ose thuaj çfarë bëre'), 'sot bëra bench 3×10 me 60 kg dhe dips 2×12')
    await user.click(screen.getByRole('button', { name: 'Dërgo' }))
    const [table] = await screen.findAllByRole('table', { name: /^Setet e / })
    expect(within(table).getAllByRole('row')).toHaveLength(4)
    expect(screen.getByText(/e1RM 80,0\skg/)).toBeInTheDocument()
    expect(screen.getByText('Dips - Chest Version nuk është te ' + data.requests[0].context.workouts[0].label + '. Ta shtoj si ushtrim shtesë?')).toBeInTheDocument()
    expect(screen.getByText(/Dips - Chest Version pret përgjigjen tënde/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Po, si shtesë' }))
    await user.click(screen.getByRole('button', { name: 'Regjistro të gjitha' }))
    expect(await screen.findByText('Sot')).toBeInTheDocument()
    const sets = await data.store.all('set_logs')
    expect(sets).toHaveLength(5)
    expect(sets.filter((row) => row.slot_id == null).map((row) => Number(row.rir))).toEqual([2, 2])
    expect((await data.store.all('workout_sessions')).filter((row) => row.status === 'in_progress')).toHaveLength(1)
    for (const row of sets) await data.store.remove('set_logs', row.id)
    for (const row of await data.store.all('workout_sessions')) await data.store.remove('workout_sessions', row.id)
  })

  it('trajneri: pyetja merr përgjigjen nga faktet, pa "Regjistro"', async () => {
    const user = userEvent.setup()
    data.reply = () => ({ ok: true, costEur: 0.0003, month: MONTH, draft: { ...empty, answer: { headline: '44 g proteinë', text: 'Ke 132 nga 176 g.' } } })
    await renderPage()
    await user.type(screen.getByLabelText('Shkruaj ose thuaj çfarë bëre'), 'Sa proteinë më mbetet sot?')
    await user.click(screen.getByRole('button', { name: 'Dërgo' }))
    expect(await screen.findByRole('heading', { name: '44 g proteinë' })).toBeInTheDocument()
    expect(screen.getByText('Ke 132 nga 176 g.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Regjistro të gjitha' })).toBeNull()
    expect(data.requests[0].facts).toMatch(/^Food day /)
    await user.type(screen.getByLabelText('Pyet ose shkruaj çfarë bëre'), 'Po nesër?')
    await user.click(screen.getByRole('button', { name: 'Dërgo' }))
    await vi.waitFor(() => expect(data.requests).toHaveLength(2))
    expect(data.requests[1].history).toEqual([
      { role: 'user', text: 'Sa proteinë më mbetet sot?' },
      { role: 'assistant', text: '44 g proteinë. Ke 132 nga 176 g.' },
    ])
  })

  it('foto e pjatës: dërgohet një herë me vaktin; pa ushqim në foto, ekrani e thotë me fjalë', async () => {
    const photo = { mediaType: 'image/jpeg' as const, data: 'A'.repeat(400) }
    // Si e ktheu AI-ja e vërtetë një foto me sallatë makaronash (09.11.2026).
    data.reply = () => ({
      ok: true,
      costEur: 0.00036,
      month: MONTH,
      draft: {
        ...empty,
        foods: [{ said: 'foto', ref: null, name: 'Makarona me karkaleca', grams: 350, portion: '', estimated: true, per100: { kcal: 165, proteinG: 7.5, carbsG: 20, fatG: 6 }, options: [], meal: 'lunch', time: null, day: 0 }],
      },
    })
    await renderPage({ photo, text: 'Foto e pjatës për Dreka.' })
    expect(await screen.findByRole('button', { name: /Makarona me karkaleca/ })).toHaveTextContent(/350\sg · vlerësim/)
    expect(data.requests).toHaveLength(1)
    expect(data.requests[0]).toMatchObject({ text: 'Foto e pjatës për Dreka.', image: photo })
    cleanup()

    // Si e ktheu AI-ja e vërtetë një foto pa ushqim: shenja nuk del si tekst.
    data.reply = () => ({ ok: true, costEur: 0.00034, month: MONTH, draft: { ...empty, notUnderstood: ['photo'] } })
    await renderPage({ photo, text: 'Foto e pjatës për Dreka.' })
    expect(await screen.findByText('Në foto nuk dallova ushqim. Provo një foto tjetër ose shkruaje me fjalë.')).toBeInTheDocument()
    expect(screen.queryByText(/Nuk e regjistrova/)).toBeNull()
  })

  it('pa internet: teksti mbetet, "Dërgo" pret rrjetin dhe karta e thotë', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    boxText.set('Në drekë 200 g pulë me oriz')
    await renderPage()
    expect(screen.getByLabelText('Shkruaj ose thuaj çfarë bëre')).toHaveValue('Në drekë 200 g pulë me oriz')
    expect(screen.getByRole('status')).toHaveTextContent('Kutia kërkon internet')
    expect(screen.getByRole('button', { name: 'Dërgo, pret internetin' })).toBeDisabled()
  })

  it('kufiri i muajit dhe gabimi: teksti mbetet me shpjegimin', async () => {
    const user = userEvent.setup()
    data.reply = () => ({
      ok: false,
      error: 'limit',
      month: { ...MONTH, spentEur: 10 },
    })
    await renderPage()
    await user.type(screen.getByLabelText('Shkruaj ose thuaj çfarë bëre'), 'dy vezë')
    await user.click(screen.getByRole('button', { name: 'Dërgo' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Kufiri i AI-së për këtë muaj u arrit (10,00 € nga 10,00 €)')
    expect(screen.getByLabelText('Shkruaj ose thuaj çfarë bëre')).toHaveValue('dy vezë')
  })

  it('anglisht', async () => {
    const user = userEvent.setup()
    language.set('en')
    data.reply = () => ({
      ok: true,
      costEur: 0.0002,
      month: MONTH,
      draft: { ...empty, foods: [panetone(null)] },
    })
    await renderPage().catch(() => null)
    await user.type(await screen.findByLabelText('Type or say what you did'), 'panettone')
    await user.click(screen.getByRole('button', { name: 'Send' }))
    expect(
      await screen.findByRole('heading', {
        name: 'How much panetone did you have?',
      }),
    ).toBeInTheDocument()
    expect(data.requests[0].context.language).toBe('en')
  })
})
