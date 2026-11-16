import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { LocalStore } from '@/data/store'
import { language } from '@/i18n/language'
import { sampleWeek, type TestClock } from './programme-test-setup'

// Faqja e ushtrimit (bordi "Ushtrimi", V2-E1-09): foto bardh e zi, muskujt, rekordet me grafikun e
// e1RM-së, historia e seteve dhe videoja; edhe për ushtrimet e bibliotekës që s'janë në telefon.
const data = vi.hoisted(() => ({
  store: null as unknown as LocalStore,
  clock: { date: new Date() } as TestClock,
  explain: null as unknown as (request: unknown) => Promise<unknown>,
}))
vi.mock('@/data/app-data', async () => {
  const { createDatabase } = await import('@/data/db')
  const { createLocalStore } = await import('@/data/store')
  const store = createLocalStore(createDatabase(`exercise-${crypto.randomUUID()}`), {
    userId: () => '11111111-1111-4111-8111-111111111111',
    now: () => data.clock.date,
  })
  data.store = store
  return {
    store,
    exerciseExplainRemote: { explain: (request: unknown) => data.explain(request) },
    useLocalQuery: (await import('@/test/local-query')).useLocalQueryFor(store),
  }
})

async function benchId() {
  const { exerciseCatalog } = await import('@/data/exercises')
  return (await exerciseCatalog(data.store)).items.find((item) => item.name === 'Bench Press')!.exerciseId!
}

async function renderAt(path: string) {
  const { ExercisePage } = await import('./exercise')
  const router = createMemoryRouter([{ path: '/ushtrimi/:exerciseId', element: <ExercisePage /> }], { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

describe('Ushtrimi', () => {
  // Foto e një ushtrimi jashtë Shortcut to Size merret nga interneti: në prova nuk ka rrjet.
  const fetchPhoto = vi.fn(async () => {
    throw new Error('pa rrjet në prova')
  })
  beforeAll(async () => {
    await import('@/data/app-data')
    await sampleWeek(data.store, data.clock)
  })
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchPhoto)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    act(() => language.set('sq'))
  })

  it('Bench Press: foto e paketuar, muskujt, rekordet dhe historia si te bordi', async () => {
    const user = userEvent.setup()
    await renderAt(`/ushtrimi/${await benchId()}`)
    expect(await screen.findByRole('heading', { level: 1, name: 'Bench Press' })).toBeInTheDocument()
    expect(screen.getByText('Gjoksi · shufër · 4 sete te Shortcut to Size')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Bench Press, fillimi i lëvizjes' })).toHaveAttribute('src', '/exercise-photos/Barbell_Bench_Press_-_Medium_Grip.jpg')
    expect(screen.getByRole('img', { name: 'Bench Press, fundi i lëvizjes' })).toHaveAttribute('src', '/exercise-photos/Barbell_Bench_Press_-_Medium_Grip-end.jpg')
    expect(screen.getByText('Poshtë 2 s · lart 1 s')).toBeInTheDocument()
    expect(fetchPhoto).not.toHaveBeenCalled()

    const muscles = screen.getByRole('region', { name: 'Muskujt' })
    expect(muscles).toHaveTextContent('KryesorGjoksi')
    expect(muscles).toHaveTextContent('NdihmësShpatullat, tricepsi')

    const records = screen.getByRole('region', { name: 'Rekordet e tua' })
    expect(records).toHaveTextContent('86kge1RM')
    expect(records).toHaveTextContent('+9,3 kg nga Java 0')
    expect(within(records).getByRole('img')).toHaveAccessibleName('e1RM sipas javës: Java 0 76,7\u00A0kg, Java 1 86\u00A0kg')
    expect(records).toHaveTextContent('Pesha më e madhe60 kg × 13')

    const history = screen.getByRole('region', { name: 'Historia e seteve' })
    const sessions = within(history).getAllByRole('listitem')
    expect(sessions[0]).toHaveTextContent('60 kg × 13E diel, 1 nëntor · Java 1')
    expect(sessions[1]).toHaveTextContent('50 kg × 14E diel, 25 tetor · Java 0')

    await user.click(within(muscles).getByRole('button', { name: 'Rrotullo në 3D' }))
    const sheet = screen.getByRole('dialog', { name: 'Muskujt e Bench Press' })
    await user.click(within(sheet).getByRole('button', { name: 'Mbyll' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('videoja: shtohet me lidhje YouTube, shfaqet brenda dhe hapet jashtë app-it', async () => {
    const user = userEvent.setup()
    await renderAt(`/ushtrimi/${await benchId()}`)
    await user.click(await screen.findByRole('button', { name: /Shto video nga YouTube/ }))
    const sheet = screen.getByRole('dialog', { name: 'Videoja e ushtrimit' })
    await user.type(within(sheet).getByLabelText('Lidhja e YouTube'), 'https://vimeo.com/1')
    await user.click(within(sheet).getByRole('button', { name: 'Ruaj' }))
    expect(within(sheet).getByRole('alert')).toHaveTextContent('Kjo nuk është lidhje videoje YouTube')
    await user.clear(within(sheet).getByLabelText('Lidhja e YouTube'))
    await user.type(within(sheet).getByLabelText('Lidhja e YouTube'), 'https://youtu.be/dQw4w9WgXcQ')
    await user.click(within(sheet).getByRole('button', { name: 'Ruaj' }))
    // Lidhja e përdoruesit zë vendin e videos së zgjedhur: "Shiko videon" e luan atë.
    const watch = await screen.findByRole('button', { name: 'Ndrysho videon' })
    expect(watch).toBeInTheDocument()
    expect(screen.getAllByText('Lidhja që shtove').length).toBeGreaterThan(0)
    await user.click(screen.getAllByRole('button', { name: /Shiko videon/ })[0])
    const player = screen.getByRole('dialog', { name: 'Videoja' })
    expect(within(player).getByTitle('Videoja e Bench Press')).toHaveAttribute('src', expect.stringContaining('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'))
    expect(within(player).getByRole('link', { name: /Hap në YouTube/ })).toHaveAttribute('href', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    await user.click(within(player).getByRole('button', { name: 'Mbyll' }))
    // Pa lidhjen e përdoruesit kthehet videoja e zgjedhur (baza e provës ndahet mes provave).
    await user.click(screen.getByRole('button', { name: 'Ndrysho videon' }))
    await user.click(within(screen.getByRole('dialog', { name: 'Videoja e ushtrimit' })).getByRole('button', { name: 'Hiq videon' }))
    expect(await screen.findByRole('button', { name: /Shiko videon/ })).toHaveTextContent('NASM · 0:25')
  })

  it('Bench Press: videoja e zgjedhur, udhëzuesi me burimet, "Më shumë video" dhe "Pak histori"', async () => {
    const user = userEvent.setup()
    await renderAt(`/ushtrimi/${await benchId()}`)
    await screen.findByRole('heading', { level: 1, name: 'Bench Press' })
    expect(screen.getByRole('button', { name: /Shiko videon/ })).toHaveTextContent('NASM · 0:25')
    for (const name of ['Përgatitja', 'Lëvizja hap pas hapi', 'Tempo dhe fryma', 'Sinjalet e formës', 'Gabimet e zakonshme', 'Këshilla të avancuara', 'Siguria', 'Pak histori']) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument()
    }
    // Secili seksion ka "Burimi" me lidhje që hapet jashtë app-it.
    const setup = screen.getByRole('heading', { name: 'Përgatitja' }).closest('section')!
    expect(setup).toHaveTextContent('Burimi:')
    const link = within(setup).getAllByRole('link')[0]
    expect(link).toHaveAttribute('href', expect.stringMatching(/^https:\/\//))
    expect(link).toHaveAttribute('target', '_blank')
    // Sinjalet: të parat tre dalin te seanca.
    const cues = screen.getByRole('heading', { name: 'Sinjalet e formës' }).closest('section')!
    expect(within(cues).getAllByText('Del te seanca')).toHaveLength(3)
    expect(within(cues).getByText('Bërrylat rreth 45° nga trupi')).toBeInTheDocument()
    // Këshilla me emrin e ekspertit.
    expect(within(screen.getByRole('heading', { name: 'Këshilla të avancuara' }).closest('section')!).getAllByText(/Jim Stoppani, PhD/).length).toBeGreaterThan(0)
    // Më shumë video: titulli, kanali, autori, kohëzgjatja; hapen në YouTube.
    const more = screen.getByRole('heading', { name: 'Më shumë video' }).closest('section')!
    expect(within(more).getAllByRole('link')).toHaveLength(3)
    expect(more).toHaveTextContent('Barbell Medicine · Jordan Feigenbaum, MD · 17:22')

    await user.click(screen.getByRole('button', { name: /Shiko videon/ }))
    expect(screen.getByTitle('Videoja e Bench Press')).toHaveAttribute('src', expect.stringContaining('/embed/CayG6UYqL8g'))
  })

  it('"Zgjero" hap ekranin e plotë të lëvizjes me rrëshqitësin, 3 sinjalet dhe videon', async () => {
    const user = userEvent.setup()
    await renderAt(`/ushtrimi/${await benchId()}`)
    await user.click(await screen.findByRole('button', { name: 'Zgjero' }))
    const sheet = screen.getByRole('dialog', { name: 'Bench Press' })
    expect(within(sheet).getByRole('slider', { name: 'Pozicioni i lëvizjes, nga fillimi te fundi' })).toBeInTheDocument()
    expect(within(sheet).getAllByRole('listitem')).toHaveLength(3)
    expect(within(sheet).getByText('Bërrylat rreth 45° nga trupi')).toBeInTheDocument()
    expect(within(sheet).getByRole('button', { name: /Shiko videon/ })).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Mbyll' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('ushtrim pa udhëzues (Cable Crunch): lëvizja, muskujt dhe videoja, pa seksione bosh', async () => {
    await renderAt('/ushtrimi/Cable_Crunch')
    expect(await screen.findByRole('heading', { level: 1, name: /Crunch/ })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /fillimi i lëvizjes/ })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Muskujt' })).toBeInTheDocument()
    for (const name of ['Përgatitja', 'Lëvizja hap pas hapi', 'Sinjalet e formës', 'Gabimet e zakonshme', 'Siguria', 'Pak histori']) {
      expect(screen.queryByRole('heading', { name })).not.toBeInTheDocument()
    }
    expect(screen.getByText('Poshtë 2 s · lart 1 s')).toBeInTheDocument()
  })

  it('ushtrim i bibliotekës që s’është në telefon: "Pa foto" pa rrjet, muskujt nga grupet, pa rekorde', async () => {
    await renderAt('/ushtrimi/Arnold_Dumbbell_Press')
    expect(await screen.findByRole('heading', { level: 1, name: 'Arnold Dumbbell Press' })).toBeInTheDocument()
    expect(screen.getByText('Shpatullat · dumbbell')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('Pa foto')).toBeInTheDocument())
    expect(screen.queryByRole('img', { name: /lëvizjes/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Përgatitja' })).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Rekordet e tua' })).toHaveTextContent('Rekordet dalin pas setit të parë me peshë.')
    expect(screen.queryByRole('region', { name: 'Historia e seteve' })).not.toBeInTheDocument()
  })

  it('ushtrim që nuk gjendet', async () => {
    await renderAt('/ushtrimi/nuk-ekziston')
    expect(await screen.findByText('Ky ushtrim nuk gjendet.')).toBeInTheDocument()
  })

  it('anglisht', async () => {
    act(() => language.set('en'))
    await renderAt(`/ushtrimi/${await benchId()}`)
    expect(await screen.findByText('Chest · barbell · 4 sets in Shortcut to Size')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Muscles' })).toHaveTextContent('PrimaryChest')
    const records = screen.getByRole('region', { name: 'Your records' })
    expect(records).toHaveTextContent('+9.3 kg since Week 0')
    expect(records).toHaveTextContent('Heaviest set60 kg × 13')
    expect(screen.getByRole('region', { name: 'Set history' })).toHaveTextContent('Sunday, 1 November · Week 1')
    expect(screen.getByRole('button', { name: 'Rotate in 3D' })).toBeInTheDocument()
    expect(screen.getByText('Down 2 s · up 1 s')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Bench Press, start of the movement' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Watch the video/ })).toHaveTextContent('NASM · 0:25')
    for (const name of ['Setup', 'Step by step', 'Tempo and breathing', 'Form cues', 'Common mistakes', 'Advanced tips', 'Safety', 'More videos', 'A bit of history']) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument()
    }
    const setup = screen.getByRole('heading', { name: 'Setup' }).closest('section')!
    expect(setup).toHaveTextContent('Source:')
  })

  // "Shpjegoje më shumë" (V56, §0.3e; bordi "Ushtrimi · AI"): pa prush, "Shpjeguar nga AI", i ruajtur në telefon,
  // dhe pa internet ose pas kufirit butoni thotë pse.
  describe('"Shpjegoje më shumë"', () => {
    const reply = (...paragraphs: string[]) => ({ ok: true as const, paragraphs, costEur: 0.001 })
    const online = (value: boolean) => vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(value)

    afterEach(() => vi.restoreAllMocks())

    it('anglisht: kërkesa me udhëzuesin anglisht, shpjegimi, etiketa dhe mbyllja', async () => {
      const requests: any[] = []
      data.explain = async (request) => (requests.push(request), reply('Elbows decide the work.', 'Keep the chest up.', 'Do not bounce.'))
      const user = userEvent.setup()
      act(() => language.set('en'))
      await renderAt(`/ushtrimi/${await benchId()}`)
      const button = await screen.findByRole('button', { name: 'Explain more' })
      await waitFor(() => expect(button).toBeEnabled())
      expect(screen.getByText('With AI · counts towards your monthly limit')).toBeInTheDocument()
      await user.click(button)
      const section = await screen.findByRole('region', { name: 'AI explanation' })
      expect(section).toHaveTextContent('Explained by AI')
      expect(section).toHaveTextContent('Elbows decide the work.')
      expect(section).toHaveTextContent('AI explanations can contain mistakes. The sourced facts are above.')
      expect(requests).toHaveLength(1)
      expect(requests[0]).toMatchObject({ language: 'en', exercise: { name: 'Bench Press', primary: ['Chest'] } })
      expect(requests[0].guide.cues.join(' ')).toMatch(/elbows/i)
      expect(requests[0].guide.cues.join(' ')).not.toMatch(/Bërrylat/)
      await user.click(screen.getByRole('button', { name: 'Close the explanation' }))
      expect(screen.queryByRole('region', { name: 'AI explanation' })).not.toBeInTheDocument()
    })

    it('pa internet: butoni thotë pse; kur vjen interneti shpjegimi ruhet, dhe hapja e dytë punon pa internet', async () => {
      const calls = vi.fn(async () => reply('Një paragraf.', 'Dy paragrafë.', 'Tre paragrafë.'))
      data.explain = calls
      const user = userEvent.setup()
      const state = online(false)
      const view = await renderAt(`/ushtrimi/${await benchId()}`)
      const button = await screen.findByRole('button', { name: 'Shpjegoje më shumë' })
      await waitFor(() => expect(screen.getByText(/^Pa internet: shpjegimi me AI/)).toBeInTheDocument())
      expect(button).toBeDisabled()
      expect(calls).not.toHaveBeenCalled()

      state.mockReturnValue(true)
      act(() => window.dispatchEvent(new Event('online')))
      await waitFor(() => expect(button).toBeEnabled())
      await user.click(button)
      const section = await screen.findByRole('region', { name: 'Shpjegim nga AI' })
      expect(section).toHaveTextContent('Shpjeguar nga AI')
      expect(section).toHaveTextContent('Shpjegimet e AI-së mund të kanë gabime. Faktet me burim janë më sipër.')
      expect(calls).toHaveBeenCalledTimes(1)

      await user.click(screen.getByRole('button', { name: 'Mbyll shpjegimin' }))
      state.mockReturnValue(false)
      act(() => window.dispatchEvent(new Event('offline')))
      await user.click(await screen.findByRole('button', { name: 'Shpjegoje më shumë' }))
      expect(await screen.findByRole('region', { name: 'Shpjegim nga AI' })).toHaveTextContent('Dy paragrafë.')
      expect(calls).toHaveBeenCalledTimes(1)
      view.dispose()
    })

    it('pas kufirit të muajit: butoni thotë pse dhe nuk thërret asgjë', async () => {
      const calls = vi.fn(async () => reply('A', 'B', 'C'))
      data.explain = calls
      await data.store.put('ai_usage', {
        id: crypto.randomUUID(),
        user_id: '11111111-1111-4111-8111-111111111111',
        month: `${data.clock.date.getFullYear()}-${String(data.clock.date.getMonth() + 1).padStart(2, '0')}-01`,
        feature: 'explain',
        model: 'claude-haiku-5-5',
        input_tokens: 1000,
        output_tokens: 500,
        cost_usd: 11,
        cost_eur: 10,
      })
      await renderAt('/ushtrimi/Cable_Crunch')
      const button = await screen.findByRole('button', { name: 'Shpjegoje më shumë' })
      await waitFor(() => expect(screen.getByText(/^Kufiri i AI-së u arrit; rinis më /)).toBeInTheDocument())
      expect(button).toBeDisabled()
      expect(calls).not.toHaveBeenCalled()
    })
  })
})
