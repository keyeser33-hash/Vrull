import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router'
import type { LocalStore } from '@/data/store'
import { language } from '@/i18n'

// Ushqimi i ri (V59, SPEC §0.3h) me store të vërtetë, të mërkurën 9 dhjetor në 12:40 (ditë pushimi, 80 kg, ngrihet 07:00).
// Dreka (13:00) është e radhës; Mëngjesi 1 e 2 dhe Snack paradite kanë kaluar pa regjistrim. Testing Library e kthen
// hapësirën që nuk thyhet (3 037 kcal) në hapësirë të zakonshme para krahasimit.
const data = vi.hoisted(() => ({ store: null as unknown as LocalStore }))
vi.mock('@/data/app-data', async () => {
  const { createDatabase } = await import('@/data/db')
  const { createLocalStore } = await import('@/data/store')
  const store = createLocalStore(createDatabase(`nutrition-ui-${crypto.randomUUID()}`), { userId: () => '11111111-1111-4111-8111-111111111111' })
  data.store = store
  return {
    store,
    useLocalQuery: (await import('@/test/local-query')).useLocalQueryFor(store),
  }
})

const TODAY = '2026-12-09'
const dayRows = async () => (await data.store.where('diary_entries', 'date', TODAY)).filter((row) => !row.deleted_at)

function Probe() {
  const location = useLocation()
  return <p data-testid="where">{`${location.pathname}${location.search}|${(location.state as { text?: string } | null)?.text ?? ''}`}</p>
}

describe('Ushqimi', () => {
  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-12-09T12:40:00'))
    await import('@/data/app-data')
    const { completeOnboarding } = await import('@/data/profile')
    await completeOnboarding(data.store, { weightKg: 80, trainingDays: [1, 2, 4, 5], trainingTime: '18:00', wakeTime: '07:00', sleepTime: '23:00' })
    const { ensureSupplements } = await import('@/data/supplements')
    await ensureSupplements(data.store)
  })
  afterAll(() => vi.useRealTimers())
  afterEach(() => language.set('sq'))

  async function renderPage(entry = '/ushqimi') {
    const { NutritionPage } = await import('./nutrition')
    const router = createMemoryRouter(
      [
        {
          path: '/ushqimi',
          element: (
            <>
              <NutritionPage />
              <Probe />
            </>
          ),
        },
        { path: '/ushqimi/shto/:meal', element: <Probe /> },
        { path: '/kutia', element: <Probe /> },
      ],
      { initialEntries: [entry] },
    )
    render(<RouterProvider router={router} />)
    return router
  }

  // Numrat e mëdhenj rrotullohen (RollingNumber): shifrat ndahen në elemente, ndaj kontrollohen me
  // `toHaveTextContent` te prindi ose me emrin e grupit, jo me `getByText`.
  const hero = (name: RegExp) => screen.findByRole('region', { name })
  const timeline = () => screen.findByRole('region', { name: 'Dita' })

  it('kreu me ditën dhe llojin, rreshti i ditës me ujin dhe "Plotëso makrot", lidhjet poshtë', async () => {
    await renderPage()
    expect(await screen.findByText('Sot · 9 dhjetor')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Ushqimi' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dita e kaluar' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Dita tjetër' })).toBeEnabled()
    const type = screen.getByRole('button', { name: /^Lloji i ditës: pushim/ })
    expect(type).toHaveTextContent('Pushim')
    expect(await hero(/^Sot: 0 nga 3\s037 kcal, mbeten 3\s037$/)).toHaveTextContent('3 037kcal mbeten0 nga 3 037')
    expect(screen.getByRole('group', { name: 'Proteina 0 nga 260 gramë' })).toHaveTextContent('Proteina0 / 260 g')
    const water = await screen.findByRole('button', { name: 'Uji: 0,0 nga 2,75 litra. Prek për të shtuar 250 ml' })
    expect(water).toHaveTextContent('Uji 0,0 / 2,75 L+250')
    const fill = screen.getByRole('link', { name: 'Plotëso makrot: mbeten 260 gramë proteinë' })
    expect(fill).toHaveAttribute('href', '/ushqimi/plotesomakrot')
    expect(fill).toHaveTextContent('Plotëso makrotmbeten 260 g P')
    expect(within(screen.getByRole('navigation', { name: 'Plani i ushqimit' })).getAllByRole('link').map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Objektivat', '/ushqimi/objektivat'],
      ['Plani im', '/ushqimi/plani'],
      ['Oraret', '/ushqimi/oraret'],
    ])
    expect(screen.getByRole('textbox', { name: 'Çfarë hëngre?' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dërgo' })).toBeDisabled()
    // Uji nuk është te Sot vetëm: një prekje shton 250 ml, "Zhbëj" e kthen.
    const user = userEvent.setup()
    await user.click(type)
    expect(await screen.findByRole('button', { name: /^Lloji i ditës: stërvitje/ })).toHaveTextContent('Stërvitje')
    expect(await hero(/^Sot: 0 nga 3\s625 kcal, mbeten 3\s625$/)).toBeInTheDocument()
    // Në ditë stërvitjeje vija e kohës ka rreshtin e stërvitjes me orën e saj, mes vakteve para dhe pas saj.
    const workout = (await within(await timeline()).findByText('Stërvitja 1')).closest('li')!
    expect(workout).toHaveTextContent('18:00Stërvitja 1Java 0 · pas 5 orë 20 min')
    expect(workout.previousElementSibling).toHaveTextContent('17:45Para stërvitjes')
    await user.click(screen.getByRole('button', { name: /^Lloji i ditës: stërvitje/ }))
    expect(await screen.findByRole('button', { name: /^Lloji i ditës: pushim/ })).toBeInTheDocument()
  })

  it('uji: një prekje shton 250 ml, njoftimi jep "Zhbëj"', async () => {
    const user = userEvent.setup()
    await renderPage()
    await user.click(await screen.findByRole('button', { name: /^Uji: 0,0 nga 2,75 litra/ }))
    const toast = await screen.findByRole('status')
    expect(toast).toHaveTextContent('U shtua një gotë · 0,25 LZhbëj')
    expect(await screen.findByRole('button', { name: 'Uji: 0,25 nga 2,75 litra. Prek për të shtuar 250 ml' })).toBeInTheDocument()
    await user.click(within(toast).getByRole('button', { name: 'Zhbëj' }))
    expect(await screen.findByRole('button', { name: 'Uji: 0,0 nga 2,75 litra. Prek për të shtuar 250 ml' })).toBeInTheDocument()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('vija e kohës: pa regjistruar me "Si në plan", vakti i radhës i hapur, ato që vijnë të zbehta', async () => {
    await renderPage()
    const line = await screen.findByRole('region', { name: 'Dita' })
    expect([...line.querySelectorAll(':scope > ol > li')].map((row) => row.querySelector('span')?.textContent)).toEqual(['07:00', '07:45', '10:30', '13:00', '15:30', '18:30', '22:30'])
    expect(within(line).getByRole('button', { name: 'Mëngjesi 1, 07:00, pa regjistruar' })).toHaveTextContent('Pa regjistruar · Pluhur proteine')
    expect(within(line).getByRole('button', { name: 'Snack paradite, 10:30, pa regjistruar' })).toBeInTheDocument()
    expect(within(line).getByRole('button', { name: 'Si në plan: Snack paradite' })).toBeInTheDocument()
    const next = within(line).getByRole('region', { name: 'Dreka' })
    expect(within(next).getByText('I radhës · pas 20 min')).toBeInTheDocument()
    expect(within(next).getByText(/^495 kcal · 42 g P$/)).toBeInTheDocument()
    expect(within(next).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Ton albacore në ujë1 kanoçe', 'Bukë integrale2 feta', 'Majonezë light1 lugë gjelle', 'Mollë1 e madhe'])
    expect(within(next).getByText('Me multivitaminë')).toBeInTheDocument()
    expect(within(next).getByRole('button', { name: 'Si në plan' })).toBeInTheDocument()
    expect(within(next).getByRole('button', { name: 'Ndrysho' })).toBeInTheDocument()
    const later = within(line).getByRole('button', { name: 'Snack pasdite, 15:30, në pritje' })
    expect(later).toHaveTextContent('Snack pasditePluhur proteine, gjalpë kikiriku, reçel, bukë')
    // Një prush për ekran: veprimi kryesor i kartës së radhës.
    expect(
      screen.getAllByRole('button').filter((button) => button.className.includes('bg-ember')),
    ).toHaveLength(1)
  })

  it('"Si në plan" te karta: njoftimi "U shtua te Dreka", rreshti i ngjeshur, dhe "Zhbëj" heq regjistrimet', async () => {
    const user = userEvent.setup()
    await renderPage()
    const next = (await screen.findByRole('region', { name: 'Dreka' })) as HTMLElement
    await user.click(within(next).getByRole('button', { name: 'Si në plan' }))
    const toast = await screen.findByRole('status')
    expect(toast).toHaveTextContent('U shtua te Dreka · 495 kcalZhbëj')
    expect(await hero(/^Sot: 495 nga 3\s037 kcal, mbeten 2\s542$/)).toHaveTextContent('2 542kcal mbeten495 nga 3 037')
    const row = await within(await timeline()).findByRole('button', { name: 'Dreka, 13:00, 495 kcal, 42 g proteinë' })
    expect(row).toHaveTextContent('Dreka495 kcal42 g P')
    expect(row.querySelectorAll('span.size-6')).toHaveLength(4)
    expect(await screen.findByRole('region', { name: 'Snack pasdite' })).toHaveTextContent('I radhës')
    await user.click(within(toast).getByRole('button', { name: 'Zhbëj' }))
    await waitFor(async () => expect(await dayRows()).toHaveLength(0))
    expect(await within(await timeline()).findByRole('region', { name: 'Dreka' })).toBeInTheDocument()
    expect(await hero(/^Sot: 0 nga 3\s037 kcal, mbeten 3\s037$/)).toBeInTheDocument()
  })

  it('‹ › ndërrojnë ditën: deri te nesër, jo më tej; data te kreu kthen te sot', async () => {
    const user = userEvent.setup()
    await renderPage()
    await user.click(await screen.findByRole('button', { name: 'Dita e kaluar' }))
    expect(await screen.findByRole('button', { name: 'Kthehu te sot' })).toHaveTextContent('8 dhjetor')
    // Pa peshë për atë ditë nuk ka objektiva: numri i ngrënë dhe asnjë pllakë "Plotëso makrot".
    expect(await hero(/^8 dhjetor: 0 kcal$/)).toBeInTheDocument()
    expect(screen.queryAllByRole('link', { name: /^Plotëso makrot/ })).toHaveLength(0)
    // Dita e kaluar: asnjë vakt i radhës; çdo vakt pa regjistrim është "pa regjistruar".
    expect(within(await timeline()).queryAllByText(/^I radhës/).length).toBe(0)
    expect(within(await timeline()).getByRole('button', { name: 'Darka, 20:30, pa regjistruar' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Kthehu te sot' }))
    expect(await screen.findByText('Sot · 9 dhjetor')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Dita tjetër' }))
    expect(await screen.findByRole('button', { name: 'Kthehu te sot' })).toHaveTextContent('10 dhjetor')
    expect(screen.getByRole('button', { name: 'Dita tjetër' })).toBeDisabled()
    expect(within(await timeline()).getByRole('region', { name: 'Mëngjesi 1' })).toHaveTextContent('I radhës')
    expect(within(await timeline()).queryAllByText(/pas \d+ min/).length).toBe(0)
  })

  it('rripi i suplementeve: gjurma e ditës, grupi i hapur, "E mora" me "Zhbëj", "Të N"', async () => {
    const user = userEvent.setup()
    await renderPage()
    const section = await screen.findByRole('region', { name: /^Suplementet/ })
    expect(section).toHaveTextContent('Suplementet0 nga 5')
    // Orët me suplemente; ora e vaktit të radhës është e hapur (korniza e prushit).
    expect(within(section).getByRole('group', { name: 'Orët e suplementeve' })).toHaveTextContent('07:001')
    const lunchSlot = within(section).getByRole('button', { name: '13:00: 1 suplement' })
    expect(lunchSlot).toHaveAttribute('aria-pressed', 'true')
    expect(lunchSlot.className).toContain('border-ember-text')
    expect(within(section).getByText('Dreka · 13:00')).toBeInTheDocument()
    await user.click(within(section).getByRole('button', { name: 'E mora: Multivitaminë' }))
    const toast = await screen.findByRole('status')
    expect(toast).toHaveTextContent('E mora: MultivitaminëZhbëj')
    expect(await within(section).findByRole('button', { name: '13:00: u morën' })).toBeInTheDocument()
    expect(section).toHaveTextContent('Suplementet1 nga 5')
    // Grupi u mbyll: hapet i pari me suplemente të mbetura. Ora e gjumit ka dy: "Të 2".
    await user.click(within(section).getByRole('button', { name: '22:30: 2 suplemente' }))
    expect(within(section).getByText('Para gjumit · 22:30')).toBeInTheDocument()
    await user.click(within(section).getByRole('button', { name: 'Të 2 të marra: Para gjumit' }))
    expect(await within(section).findByRole('button', { name: '22:30: u morën' })).toBeInTheDocument()
    expect(section).toHaveTextContent('Suplementet3 nga 5')
    // "Zhbëj" kthen të dyja.
    await user.click(within(await screen.findByRole('status')).getByRole('button', { name: 'Zhbëj' }))
    expect(await within(section).findByRole('button', { name: '22:30: 2 suplemente' })).toBeInTheDocument()
    // Chipi i marrë mbetet i zbehur; prekja e tij heq shenjën.
    await user.click(within(section).getByRole('button', { name: '13:00: u morën' }))
    const taken = within(section).getByRole('button', { name: 'Marrë: Multivitaminë. Prek për ta hequr shenjën' })
    expect(taken).toHaveAttribute('aria-pressed', 'true')
    expect(taken.className).toContain('opacity-60')
    await user.click(taken)
    expect(await within(section).findByRole('button', { name: '13:00: 1 suplement' })).toBeInTheDocument()
    expect(section).toHaveTextContent('Suplementet0 nga 5')
  })

  it('"N nga M" hap fletën e ditës me grupet, kutitë dhe evidencën; "Ndrysho listën" e çaktivizon një suplement', async () => {
    const user = userEvent.setup()
    await renderPage()
    await user.click(await screen.findByRole('button', { name: 'Suplementet e ditës: 0 nga 5. Hap listën' }))
    const sheet = await screen.findByRole('dialog', { name: 'Suplementet e ditës' })
    expect(sheet).toHaveTextContent('0 nga 5 · e mërkurë, 9 dhjetor')
    const bedtime = within(sheet).getByRole('region', { name: 'Para gjumit · 22:30' })
    expect(within(bedtime).getByRole('checkbox', { name: /ZMA/ }).closest('label')).toHaveTextContent('ZMA1 dozëE dobët')
    expect(within(sheet).getByRole('link', { name: 'Shto suplement' })).toHaveAttribute('href', '/ushqimi/suplementi')
    await user.click(within(bedtime).getByRole('checkbox', { name: /ZMA/ }))
    await waitFor(() => expect(sheet).toHaveTextContent('1 nga 5'))
    await user.click(within(bedtime).getByRole('checkbox', { name: /ZMA/ }))
    await user.click(within(sheet).getByRole('button', { name: 'Ndrysho listën' }))
    const zma = await within(sheet).findByRole('switch', { name: /ZMA/ })
    expect(zma.closest('label')).toHaveTextContent('E dobët pa mungesë')
    await user.click(zma)
    await user.click(within(sheet).getByRole('button', { name: 'Gata' }))
    await user.click(within(sheet).getByRole('button', { name: 'Mbyll' }))
    await waitFor(() => expect(screen.getByRole('region', { name: /^Suplementet/ })).toHaveTextContent('Suplementet0 nga 4'))
    // E kthen, që testet e tjera të kenë të njëjtën listë.
    const { setSupplementEnabled, supplementList } = await import('@/data/supplements')
    for (const item of await supplementList(data.store)) if (!item.enabled) await setSupplementEnabled(data.store, item.id, true)
  })

  it('fleta e vaktit: artikujt e planit me "Ndërro", veprimet e shpejta dhe "Si në plan" që mbyll fletën me njoftim', async () => {
    const user = userEvent.setup()
    await renderPage()
    await user.click(await within(await screen.findByRole('region', { name: 'Dreka' })).findByRole('button', { name: 'Ndrysho' }))
    const sheet = await screen.findByRole('dialog', { name: 'Dreka · 13:00' })
    expect(sheet).toHaveTextContent('Në plan · 495 kcal · P 42')
    expect(within(sheet).getByRole('link', { name: 'Ndërro Ton albacore në ujë' })).toHaveAttribute('href', '/ushqimi/plani?vakti=lunch&dita=pushimi&nderro=0')
    expect(within(sheet).getByRole('link', { name: /^Ndrysho sasinë e Ton albacore në ujë: 1 kanoçe$/ })).toHaveAttribute('href', '/ushqimi/plani?vakti=lunch&dita=pushimi')
    expect(within(sheet).getByRole('link', { name: 'Shto ushqim' })).toHaveAttribute('href', '/ushqimi/shto/lunch')
    expect(within(sheet).getByRole('link', { name: 'Barkodi' })).toHaveAttribute('href', '/ushqimi/shto/lunch?barkod=1')
    expect(within(sheet).getByRole('button', { name: 'Foto' })).toBeEnabled()
    expect(within(sheet).getByRole('button', { name: 'Makrot' })).toBeEnabled()
    expect(within(sheet).getByRole('button', { name: 'Si dje' })).toBeDisabled()
    expect(within(sheet).getByRole('button', { name: 'E mora: Multivitaminë' })).toHaveAttribute('aria-pressed', 'false')
    const plan = within(sheet).getByRole('button', { name: /^Si në plan/ })
    expect(plan).toHaveTextContent('4 ushqime · 495 kcal')
    expect(within(sheet).getAllByRole('button').filter((button) => button.className.includes('bg-ember'))).toHaveLength(1)
    await user.click(plan)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(await screen.findByRole('status')).toHaveTextContent('U shtua te Dreka · 495 kcalZhbëj')
    // Vakti i regjistruar: fleta tregon regjistrimet me heqjen.
    await user.click(await within(await timeline()).findByRole('button', { name: 'Dreka, 13:00, 495 kcal, 42 g proteinë' }))
    const logged = await screen.findByRole('dialog', { name: 'Dreka · 13:00' })
    await user.click(within(logged).getByRole('button', { name: 'Hiq Mollë' }))
    expect(await within(logged).findByText(/^379 kcal/)).toBeInTheDocument()
    expect(within(logged).queryByRole('button', { name: /^Si në plan/ })).toBeNull()
    await user.click(within(logged).getByRole('button', { name: 'Mbyll' }))
    // Vakti kthehet në gjendjen e mëparshme për provat tjera.
    for (const row of await dayRows()) await data.store.remove('diary_entries', row.id)
  })

  it('fusha "Çfarë hëngre?": Enter te kërkimi i vaktit të radhës, "Dërgo" te kutia e AI-së, barkodi', async () => {
    const user = userEvent.setup()
    const router = await renderPage()
    const field = await screen.findByRole('textbox', { name: 'Çfarë hëngre?' })
    await user.type(field, 'dy vezë')
    expect(screen.getByRole('button', { name: 'Dërgo' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Skano barkodin' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/ushqimi/shto/lunch'))
    expect(router.state.location.search).toBe('?barkod=1')
    await router.navigate('/ushqimi')
    await user.type(await screen.findByRole('textbox', { name: 'Çfarë hëngre?' }), 'dy vezë{Enter}')
    await waitFor(() => expect(router.state.location.pathname).toBe('/ushqimi/shto/lunch'))
    expect(router.state.location.search).toBe('?q=dy%20vez%C3%AB')
    await router.navigate('/ushqimi')
    await user.type(await screen.findByRole('textbox', { name: 'Çfarë hëngre?' }), 'pesë feta bukë')
    await user.click(screen.getByRole('button', { name: 'Dërgo' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/kutia'))
    expect(router.state.location.state).toEqual({ text: 'pesë feta bukë' })
  })

  it('në anglisht: kreu, ora, suplementet, vaktet dhe fusha', async () => {
    const user = userEvent.setup()
    language.set('en')
    await renderPage()
    expect(await screen.findByText('Today · 9 December')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Food' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous day' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Day type: rest/ })).toHaveTextContent('Rest')
    expect(await hero(/^Today: 0 of 3,037 kcal, 3,037 left$/)).toHaveTextContent('3,037kcal left0 of 3,037')
    expect(await screen.findByRole('button', { name: 'Water: 0.0 of 2.75 litres. Tap to add 250 ml' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Fill my macros: 260 g protein left' })).toBeInTheDocument()
    const section = screen.getByRole('region', { name: /^Supplements/ })
    expect(section).toHaveTextContent('Supplements0 of 5')
    expect(within(section).getByRole('button', { name: '13:00: 1 supplement' })).toBeInTheDocument()
    expect(within(section).getByRole('button', { name: 'Took it: Multivitamin' })).toBeInTheDocument()
    const line = screen.getByRole('region', { name: 'Day' })
    expect(within(line).getByRole('button', { name: 'Breakfast 1, 07:00, not logged' })).toBeInTheDocument()
    const next = within(line).getByRole('region', { name: 'Lunch' })
    expect(within(next).getByText('Next · in 20 min')).toBeInTheDocument()
    expect(within(next).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Albacore tuna in water1 can', 'Wholemeal bread2 slices', 'Light mayonnaise1 tbsp', 'Apple1 large'])
    expect(within(next).getByText('With multivitamin')).toBeInTheDocument()
    expect(within(next).getByRole('button', { name: 'As planned' })).toBeInTheDocument()
    expect(within(next).getByRole('button', { name: 'Edit' })).toBeInTheDocument()
    expect(within(line).getByRole('button', { name: 'Afternoon snack, 15:30, coming up' })).toBeInTheDocument()
    expect(within(screen.getByRole('navigation', { name: 'Food plan' })).getAllByRole('link').map((link) => link.textContent)).toEqual(['Targets', 'My plan', 'Meal times'])
    expect(screen.getByRole('textbox', { name: 'What did you eat?' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/[ëç]/)

    await user.click(within(next).getByRole('button', { name: 'Edit' }))
    const sheet = await screen.findByRole('dialog', { name: 'Lunch · 13:00' })
    expect(within(sheet).getByRole('link', { name: 'Swap Albacore tuna in water' })).toBeInTheDocument()
    expect(within(sheet).getByRole('link', { name: 'Add food' })).toHaveAttribute('href', '/ushqimi/shto/lunch')
    expect(within(sheet).getByRole('button', { name: 'Like yesterday' })).toBeInTheDocument()
    expect(within(sheet).getByRole('link', { name: 'Barcode' })).toBeInTheDocument()
    expect(within(sheet).getByRole('button', { name: /^As planned/ })).toHaveTextContent('4 items · 495 kcal')
  })

  // V2-E2-03: pa profil, objektivat vijnë nga Jimi dhe ekrani fton te kalkulatori.
  it('objektivat e Jimit me ftesën te Objektivat', async () => {
    await renderPage()
    expect(await screen.findByText('Llogarit objektivat e tua')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Llogarit' })).toHaveAttribute('href', '/ushqimi/objektivat')
    expect(screen.getByRole('link', { name: 'Objektivat' })).toHaveAttribute('href', '/ushqimi/objektivat')
  })
})
