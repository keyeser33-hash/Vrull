import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { LocalStore } from '@/data/store'
import { language } from '@/i18n'

// Ushqimi me store të vërtetë, të mërkurën në 12:40 (ditë pushimi, 80 kg). Testing Library e kthen
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

  async function renderPage() {
    const { NutritionPage } = await import('./nutrition')
    const router = createMemoryRouter([{ path: '/ushqimi', element: <NutritionPage /> }], { initialEntries: ['/ushqimi'] })
    render(<RouterProvider router={router} />)
    return router
  }

  // Numrat e mëdhenj rrotullohen (RollingNumber): shifrat ndahen në elemente, ndaj kontrollohen me
  // `toHaveTextContent` te prindi ose me emrin e grupit, jo me `getByText`.
  const hero = (name: RegExp) => screen.getByRole('region', { name })

  it('kaloritë që mbeten dhe makrot; vakti i radhës me "Si në plan"; dita me vaktet e regjistruara në një rresht', async () => {
    const user = userEvent.setup()
    await renderPage()
    const panel = (await screen.findByRole('heading', { level: 2, name: 'Dreka' })).closest('section')!
    expect(screen.getByText('ditë pushimi')).toBeInTheDocument()
    expect(hero(/^Sot: 0 nga 3\s037 kcal, mbeten 3\s037$/)).toHaveTextContent('3 037kcal mbeten0 nga 3 037')
    expect(screen.getByRole('group', { name: 'Proteina 0 nga 260 gramë' })).toHaveTextContent('Proteina0 / 260 g')
    expect(within(panel).getByText('Vakti i radhës · 13:00 · pas 20 min')).toBeInTheDocument()
    expect(within(panel).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Ton albacore në ujë1 kanoçe',
      'Bukë integrale2 feta',
      'Majonezë light1 lugë gjelle',
      'Mollë1 e madhe',
    ])
    expect(within(panel).getByText(/^Rreth 495 kcal · P 42 · K \d+ · Y \d+ g$/)).toBeInTheDocument()
    expect(within(panel).getByRole('button', { name: 'Ndrysho' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Snack paradite, 10:30, Pa regjistruar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dreka, 13:00, I radhës' })).toHaveTextContent('13:00DrekaI radhës')
    expect(screen.queryByRole('button', { name: /vakt i regjistruar/ })).toBeNull()
    // Uji mbetet vetëm te Sot.
    expect(screen.queryByText('Uji')).toBeNull()

    await user.click(within(panel).getByRole('button', { name: 'Si në plan' }))
    expect(await screen.findByRole('heading', { level: 2, name: 'Snack pasdite' })).toBeInTheDocument()
    expect(hero(/^Sot: 495 nga 3\s037 kcal, mbeten 2\s542$/)).toHaveTextContent('2 542kcal mbeten495 nga 3 037')
    expect(screen.getByRole('group', { name: 'Proteina 42 nga 260 gramë' })).toHaveTextContent('42 / 260 g')
    const logged = screen.getByRole('button', { name: /^1 vakt i regjistruar/ })
    expect(logged).toHaveTextContent('1 vakt i regjistruarDreka495 kcal')
    expect(logged).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('button', { name: /^Dreka, 13:00/ })).toBeNull()
    // Rreshti → detaji (§0.3c): lista hapet në vend (250 ms); e mbyllur s'lexohet dhe s'merr fokusin.
    const list = document.getElementById(logged.getAttribute('aria-controls')!)!
    expect(list.closest('[inert]')).not.toBeNull()
    await user.click(logged)
    expect(logged).toHaveAttribute('aria-expanded', 'true')
    expect(list.closest('[inert]')).toBeNull()
    expect(list.closest('.grid')).toHaveClass('motion-safe:duration-250')
    expect(screen.getByRole('button', { name: 'Dreka, 13:00, Regjistruar · 495 kcal' })).toHaveTextContent('495 kcal')
    expect(screen.getByRole('button', { name: 'Snack pasdite, 15:30, I radhës' })).toBeInTheDocument()
    expect(within(screen.getByRole('navigation', { name: 'Plani i ushqimit' })).getAllByRole('link').map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Objektivat', '/ushqimi/objektivat'],
      ['Plani im', '/ushqimi/plani'],
      ['Oraret', '/ushqimi/oraret'],
    ])
  })

  it('vakti hapet në fletë; një artikull hiqet; lloji i ditës ndërrohet me një prekje', async () => {
    const user = userEvent.setup()
    await renderPage()
    await user.click(await screen.findByRole('button', { name: /^1 vakt i regjistruar/ }))
    await user.click(screen.getByRole('button', { name: /^Dreka, 13:00, Regjistruar/ }))
    const sheet = screen.getByRole('dialog', { name: 'Dreka · 13:00' })
    await user.click(within(sheet).getByRole('button', { name: 'Hiq Mollë' }))
    expect(await within(sheet).findByText(/^379 kcal/)).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Mbyll' }))

    await user.click(screen.getByRole('button', { name: /^Lloji i ditës: pushim/ }))
    expect(await screen.findByText('ditë stërvitjeje')).toBeInTheDocument()
    expect(hero(/^Sot: 379 nga 3\s625 kcal, mbeten 3\s246$/)).toHaveTextContent('3 246kcal mbeten379 nga 3 625')
    expect(screen.getByRole('button', { name: 'Para stërvitjes, 17:45, Në pritje, 5 suplemente' })).toHaveTextContent('5 suplemente')
  })

  it('suplementet sipas orës: të marrat në një rresht, një buton për gjithë grupin, secili më vete te lista', async () => {
    const user = userEvent.setup()
    await renderPage()
    expect(await screen.findByRole('button', { name: /^Para gjumit, 22:30/ })).toHaveTextContent('2 suplemente')
    const section = screen.getByRole('region', { name: /^Suplementet/ })
    // Testi i mëparshëm e bëri ditën ditë stërvitjeje: shake-u shton suplementet e tij.
    expect(section).toHaveTextContent('Suplementet · 0 nga 17')
    expect(within(section).queryByRole('button', { name: /^Marrë/ })).toBeNull()

    // Një suplement i vetëm në orë: emri, vakti me dozën dhe "E mora".
    const lunch = within(section).getByRole('button', { name: 'E mora: Multivitaminë, Dreka' })
    expect(lunch).toHaveTextContent('E mora')
    expect(lunch.parentElement).toHaveTextContent('13:00MultivitaminëDreka · 1 dozë')
    await user.click(lunch)
    expect(await within(section).findByText('· 1 nga 17', { exact: false })).toBeInTheDocument()
    const taken = within(section).getByRole('button', { name: /^Marrë/ })
    expect(taken).toHaveTextContent('MarrëMultivitaminë')
    expect(document.getElementById(taken.getAttribute('aria-controls')!)!.closest('[inert]')).not.toBeNull()
    await user.click(taken)
    expect(within(section).getByRole('checkbox', { name: /Multivitaminë/ })).toBeChecked()
    expect(within(section).getByRole('checkbox', { name: /Multivitaminë/ }).closest('label')).toHaveTextContent('13:00 · Dreka · 1 dozëVetëm për mungesa')

    // Grupi: "Të 7" i shënon të gjitha; rreshti i grupit ikën te "Marrë".
    const shake = within(section).getByRole('button', { name: /^Pas stërvitjes · 7/ })
    expect(shake).toHaveTextContent('Pas stërvitjes · 7Kreatinë, beta-alaninë, betainë, BCAA, karnitinë, glutaminë, dekstrozë ose gummy')
    await user.click(within(section).getByRole('button', { name: 'Të 7 të marra: Pas stërvitjes' }))
    expect(await within(section).findByText('· 8 nga 17', { exact: false })).toBeInTheDocument()
    expect(within(section).queryByRole('button', { name: /^Pas stërvitjes · 7/ })).toBeNull()
    // Njëri hiqet më vete te lista e të marrave dhe kthehet te ora e vet.
    await user.click(within(section).getByRole('checkbox', { name: /Glutaminë/ }))
    expect(await within(section).findByText('· 7 nga 17', { exact: false })).toBeInTheDocument()
    expect(within(section).getByRole('button', { name: 'E mora: Glutaminë, Pas stërvitjes' })).toBeInTheDocument()

    // Grupi hapet në listën me kutitë: një suplement shënohet më vete.
    const bedtime = within(section).getByRole('button', { name: /^Para gjumit · 2/ })
    expect(bedtime).toHaveTextContent('Para gjumit · 2Pluhur proteine, ZMA')
    expect(within(section).queryByRole('checkbox', { name: /ZMA/ })).toBeNull()
    await user.click(bedtime)
    expect(bedtime).toHaveAttribute('aria-expanded', 'true')
    expect(within(section).getByRole('checkbox', { name: /ZMA/ }).closest('label')).toHaveTextContent('ZMA1 dozëE dobët')
    expect(document.getElementById(bedtime.getAttribute('aria-controls')!)!.closest('[inert]')).toBeNull()

    await user.click(within(section).getByRole('button', { name: 'Ndrysho listën' }))
    const sheet = screen.getByRole('dialog', { name: 'Suplementet' })
    const zma = await within(sheet).findByRole('switch', { name: /ZMA/ })
    expect(zma.closest('label')).toHaveTextContent('E dobët pa mungesë')
    await user.click(zma)
    await user.click(within(sheet).getByRole('button', { name: 'Mbyll' }))
    // Rreshti ekziston edhe para rifreskimit: pritet derisa ZMA të mos jetë më aty.
    await waitFor(() => expect(screen.getByRole('button', { name: /^Para gjumit, 22:30/ })).toHaveTextContent('1 suplement'))
    expect(screen.getByRole('region', { name: /^Suplementet/ })).toHaveTextContent('Suplementet · 7 nga 16')
    expect(within(screen.getByRole('region', { name: /^Suplementet/ })).getByRole('button', { name: 'E mora: Pluhur proteine, Para gjumit' }).parentElement).toHaveTextContent(
      '22:30Pluhur proteinePara gjumit · 1–2 scoop',
    )
  })

  it('në anglisht: vaktet, shablloni i Jimit, sasitë, suplementet dhe numrat sipas gjuhës', async () => {
    const user = userEvent.setup()
    language.set('en')
    await renderPage()
    // Testet e mëparshme: dreka e regjistruar pa mollën, dita e stërvitjes, ZMA e fikur, 7 suplemente të marra.
    const panel = (await screen.findByRole('heading', { level: 2, name: 'Afternoon snack' })).closest('section')!
    expect(screen.getByText('training day')).toBeInTheDocument()
    expect(hero(/^Today: 379 of 3,625 kcal, 3,246 left$/)).toHaveTextContent('3,246kcal left379 of 3,625')
    expect(screen.getByRole('group', { name: /^Protein, \d+ of 328 grams$/ })).toHaveTextContent('/ 328 g')
    expect(screen.getByRole('group', { name: /^Carbs, \d+ of \d+ grams$/ })).toBeInTheDocument()
    expect(within(panel).getByText('Next meal · 15:30 · in 2 hr 50 min')).toBeInTheDocument()
    expect(within(panel).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Protein powder1 scoop',
      'Peanut butter1 tbsp',
      'Jam1 tbsp',
      'Wholemeal bread2 slices',
    ])
    expect(within(panel).getByText(/^About \d+ kcal · P \d+ · C \d+ · F \d+ g$/)).toBeInTheDocument()
    expect(within(panel).getByRole('button', { name: 'As planned' })).toBeInTheDocument()
    expect(within(panel).getByRole('button', { name: 'Edit' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Afternoon snack, 15:30, Next' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pre-workout, 17:45, Coming up, 5 supplements' })).toHaveTextContent('5 supplements')
    const logged = screen.getByRole('button', { name: /^1 meal logged/ })
    expect(logged).toHaveTextContent('1 meal loggedLunch379 kcal')
    await user.click(logged)
    expect(screen.getByRole('button', { name: 'Lunch, 13:00, Logged · 379 kcal' })).toBeInTheDocument()
    expect(screen.getByText(/^Jim’s protein is about 3\.3–4\.1 g\/kg/)).toBeInTheDocument()
    expect(within(screen.getByRole('navigation', { name: 'Food plan' })).getAllByRole('link').map((link) => link.textContent)).toEqual(['Targets', 'My plan', 'Meal times'])

    const section = screen.getByRole('region', { name: /^Supplements/ })
    expect(section).toHaveTextContent('Supplements · 7 of 16')
    await user.click(within(section).getByRole('button', { name: /^Taken/ }))
    expect(within(section).getByRole('checkbox', { name: /Multivitamin/ }).closest('label')).toHaveTextContent('13:00 · Lunch · 1 doseOnly for deficiencies')
    expect(within(section).getByRole('button', { name: 'Took it: Glutamine, Post-workout' })).toHaveTextContent('Took it')
    const shake = within(section).getByRole('button', { name: /^Pre-workout · 5/ })
    expect(shake).toHaveTextContent('Pre-workout · 5Protein powder, creatine, beta-alanine, betaine, BCAA')
    expect(within(section).getByRole('button', { name: 'All 5 taken: Pre-workout' })).toHaveTextContent('All 5')
    await user.click(shake)
    expect(within(section).getAllByRole('checkbox', { name: /Creatine/ }).find((box) => !(box as HTMLInputElement).checked)!.closest('label')).toHaveTextContent('1.5–5 g')
    expect(document.body.textContent).not.toMatch(/[ëç]/)

    await user.click(screen.getByRole('button', { name: /^Lunch, 13:00/ }))
    const sheet = screen.getByRole('dialog', { name: 'Lunch · 13:00' })
    // Të fundit (0.22) ngarkohen më vonë dhe kanë të njëjtin emër: pritet lista, që prova të mos varet nga koha,
    // dhe rreshti i regjistruar njihet nga butoni i tij.
    await within(sheet).findByRole('region', { name: 'Recent' })
    expect(within(sheet).getByRole('button', { name: 'Remove Albacore tuna in water' })).toBeInTheDocument()
    expect(within(sheet).getByRole('button', { name: 'Remove Wholemeal bread' })).toBeInTheDocument()
    expect(within(sheet).getByText('64 g · 161 kcal')).toBeInTheDocument()
    expect(within(sheet).getByRole('link', { name: 'Search for a food' })).toHaveAttribute('href', '/ushqimi/shto/lunch')
    await user.click(within(sheet).getByRole('button', { name: 'Close' }))

    await user.click(screen.getByRole('button', { name: 'Edit list' }))
    const list = screen.getByRole('dialog', { name: 'Supplements' })
    expect(await within(list).findByRole('switch', { name: /ZMA/ })).not.toBeChecked()
    expect(within(list).getByRole('switch', { name: /ZMA/ }).closest('label')).toHaveTextContent('1 dose · Weak without a deficiency')
  })
  // V2-E2-03: pa profil, objektivat vijnë nga Jimi dhe ekrani fton te kalkulatori.
  it('objektivat e Jimit me ftesën te Objektivat', async () => {
    await renderPage()
    expect(await screen.findByText('Llogarit objektivat e tua')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Llogarit' })).toHaveAttribute('href', '/ushqimi/objektivat')
    expect(screen.getByRole('link', { name: 'Objektivat' })).toHaveAttribute('href', '/ushqimi/objektivat')
  })
})
