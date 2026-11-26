import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router'
import type { LocalDatabase } from '@/data/db'
import type { LocalStore } from '@/data/store'
import { language } from '@/i18n'
import type { ExternalFood } from '@/nutrition/off'

// Shto ushqim (V59, SPEC §0.3h, V2-E3-28b) me store të vërtetë, të mërkurën 18 nëntor në 12:30 (ditë pushimi, 80 kg, ngrihet
// 07:00; dreka në 13:00). Open Food Facts zëvendësohet me përgjigje të njohura; Lista e Vrullit është e vërteta (skedarët e app-it); shporta ruhet në localStorage.
const data = vi.hoisted(() => ({ store: null as unknown as LocalStore, db: null as unknown as LocalDatabase }))
const off = vi.hoisted(() => ({ search: vi.fn(), product: vi.fn() }))
vi.mock('@/nutrition/off', async (original) => ({ ...(await original<object>()), offSearch: off.search, offProduct: off.product }))
const scanner = vi.hoisted(() => ({ native: false, scan: vi.fn() }))
vi.mock('@/lib/barcode-native', () => ({ canScanBarcode: () => scanner.native, scanBarcode: scanner.scan }))
vi.mock('@/data/app-data', async () => {
  const { createDatabase } = await import('@/data/db')
  const { createLocalStore } = await import('@/data/store')
  const db = createDatabase(`add-food-${crypto.randomUUID()}`)
  const store = createLocalStore(db, { userId: () => '11111111-1111-4111-8111-111111111111' })
  data.store = store
  data.db = db
  return {
    store,
    db,
    useLocalQuery: (await import('@/test/local-query')).useLocalQueryFor(store),
  }
})

const TODAY = '2026-11-18'
const YESTERDAY = '2026-11-17'
const NUTELLA: ExternalFood = {
  source: 'off',
  sourceId: '3017620422003',
  name: 'Nutella',
  brand: 'Ferrero',
  kcal: 539,
  proteinG: 6.3,
  carbsG: 57.5,
  fatG: 30.9,
  fiberG: 0,
  servingG: 15,
  servingLabel: '15 g',
}

function Landing() {
  const location = useLocation()
  return (
    <>
      <h1>Ushqimi</h1>
      <p data-testid="state">{JSON.stringify(location.state)}</p>
    </>
  )
}

async function renderPage(entry = '/ushqimi/shto/lunch') {
  const { AddFoodPage } = await import('./add-food')
  const router = createMemoryRouter(
    [
      { path: '/ushqimi/shto/:meal', element: <AddFoodPage /> },
      { path: '/ushqimi', element: <Landing /> },
    ],
    { initialEntries: ['/ushqimi', entry], initialIndex: 1 },
  )
  const view = render(<RouterProvider router={router} />)
  return { router, ...view }
}

/** Dje: pula 200 g dhe orizi 150 g te dreka; "Kos" i preferuar me porcionin 200 g. */
async function seed() {
  const { createCustomFood } = await import('@/data/foods')
  const { logFood } = await import('@/data/nutrition')
  const { setFavorite } = await import('@/data/quick-food')
  const chicken = await createCustomFood(data.store, { name: 'Gjoks pule', kcal: 120, proteinG: 22.5, carbsG: 0, fatG: 2.6 })
  const rice = await createCustomFood(data.store, { name: 'Oriz kaf', kcal: 123, proteinG: 2.7, carbsG: 25.6, fatG: 1, servingG: 150, servingLabel: '1 filxhan' })
  const yogurt = await createCustomFood(data.store, { name: 'Kos', kcal: 60, proteinG: 3.5, carbsG: 4.7, fatG: 3.3, servingG: 200, servingLabel: '1 gotë' })
  await logFood(data.store, { date: YESTERDAY, meal: 'lunch', foodId: chicken, grams: 200 })
  await logFood(data.store, { date: YESTERDAY, meal: 'lunch', foodId: rice, grams: 150 })
  await setFavorite(data.store, yogurt, 200)
  return { chicken, rice, yogurt }
}

const todayEntries = async () => (await data.store.where('diary_entries', 'date', TODAY)).filter((row) => !row.deleted_at).map((row) => [row.meal, row.grams, Math.round(Number(row.kcal))])
const basketRegion = () => screen.findByRole('region', { name: 'Shporta' })

describe('Shto ushqim', () => {
  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-18T12:30:00'))
    await import('@/data/app-data')
    const { completeOnboarding } = await import('@/data/profile')
    await completeOnboarding(data.store, { weightKg: 80, trainingDays: [1, 2, 4, 5], trainingTime: '18:00', wakeTime: '07:00', sleepTime: '23:00' })
  })
  afterAll(() => vi.useRealTimers())
  beforeEach(async () => {
    window.localStorage.clear()
    await Promise.all([data.db.foods.clear(), data.db.diary_entries.clear(), data.db.food_products.clear()])
    off.search.mockReset()
    off.product.mockReset()
  })
  afterEach(() => language.set('sq'))

  it('pa shkrim: mjetet, Si dje, Plani im, të preferuarat dhe të fundit; "+" e shton në shportë dhe bëhet − N +', async () => {
    const user = userEvent.setup()
    await seed()
    await renderPage()
    const tools = await screen.findByRole('group', { name: 'Mjetet' })
    expect(within(tools).getAllByRole('button').map((button) => button.textContent)).toEqual(['Barkodi', 'Foto', 'Makrot', 'Ushqim i ri'])
    expect(screen.getByRole('button', { name: /^Te Dreka · \d\d:\d\d$/ })).toBeInTheDocument()
    expect(screen.getByLabelText('Kërko ushqimin')).toHaveFocus()

    const yesterday = screen.getByRole('region', { name: 'Si dje · Dreka' })
    expect(yesterday).toHaveTextContent(/Gjoks pule/)
    expect(yesterday).toHaveTextContent(/Oriz kaf/)
    expect(yesterday).toHaveTextContent('2 ushqime · 425 kcal · 49 g P')
    const plan = screen.getByRole('region', { name: 'Plani im · Dreka' })
    expect(within(plan).getAllByRole('listitem')).toHaveLength(4)
    expect(plan).toHaveTextContent('Ton albacore në ujë')
    expect(plan).toHaveTextContent('1 kanoçe')
    const favorites = screen.getByRole('region', { name: 'Të preferuarat' })
    expect(favorites).toHaveTextContent('Kos')
    expect(favorites).toHaveTextContent('1 gotë · 120 kcal · 7 g P')
    expect(screen.getByRole('region', { name: 'Të fundit' })).toHaveTextContent('Oriz kaf')
    expect(screen.queryByRole('region', { name: 'Shporta' })).not.toBeInTheDocument()

    await user.click(within(plan).getByRole('button', { name: 'Shto Ton albacore në ujë në shportë' }))
    const basket = await basketRegion()
    expect(basket).toHaveTextContent('Ton albacore në ujë · 142 g')
    expect(within(basket).getByRole('button', { name: /^Shto te Dreka/ })).toHaveTextContent('1 ushqim')
    const counter = await within(plan).findByRole('group', { name: 'Ton albacore në ujë: 1 në shportë' })
    await user.click(within(counter).getByRole('button', { name: 'Një porcion më shumë: Ton albacore në ujë' }))
    expect(await within(plan).findByRole('group', { name: 'Ton albacore në ujë: 2 në shportë' })).toBeInTheDocument()
    expect(basket).toHaveTextContent('Ton albacore në ujë · 284 g')
    await user.click(within(plan).getByRole('button', { name: 'Një porcion më pak: Ton albacore në ujë' }))
    await user.click(within(plan).getByRole('button', { name: 'Një porcion më pak: Ton albacore në ujë' }))
    expect(screen.queryByRole('region', { name: 'Shporta' })).not.toBeInTheDocument()
    expect(within(plan).getByRole('button', { name: 'Shto Ton albacore në ujë në shportë' })).toBeInTheDocument()
  })

  it('kërkimi pa shkrim nuk thërret asnjë burim të jashtëm (as Open Food Facts)', async () => {
    await renderPage()
    expect(await screen.findByRole('group', { name: 'Mjetet' })).toBeInTheDocument()
    expect(off.search).not.toHaveBeenCalled()
  })

  it('"+ Të gjitha" te Si dje; shtimi te vakti regjistron çdo artikull, zbraz shportën dhe kthen te Ushqimi me njoftimin', async () => {
    const user = userEvent.setup()
    await seed()
    await renderPage()
    await user.click(await screen.findByRole('button', { name: 'Shto të gjitha në shportë: Si dje · Dreka' }))
    const basket = await basketRegion()
    expect(basket).toHaveTextContent('Gjoks pule · 200 g')
    expect(basket).toHaveTextContent('Oriz kaf · 1')
    expect(window.localStorage.getItem('vrull.basket')).toContain('Gjoks pule')
    await user.click(within(basket).getByRole('button', { name: /^Shto te Dreka/ }))
    expect(await screen.findByRole('heading', { name: 'Ushqimi' })).toBeInTheDocument()
    const state = JSON.parse(screen.getByTestId('state').textContent ?? 'null') as { added: { meal: string; kcal: number; ids: string[] } }
    expect(state.added).toMatchObject({ meal: 'lunch', kcal: 425 })
    expect(state.added.ids).toHaveLength(2)
    expect((await todayEntries()).sort()).toEqual([
      ['lunch', 150, 185],
      ['lunch', 200, 240],
    ])
    expect(window.localStorage.getItem('vrull.basket')).toBeNull()
  })

  it('"+ Të gjitha" te Plani im shton artikujt e vaktit me gramët e planit', async () => {
    const user = userEvent.setup()
    await renderPage()
    await user.click(await screen.findByRole('button', { name: 'Shto të gjitha në shportë: Plani im · Dreka' }))
    const basket = await basketRegion()
    await waitFor(() => expect(within(basket).getAllByRole('listitem')).toHaveLength(4))
    expect(basket).toHaveTextContent('Ton albacore në ujë · 142 g')
    expect(basket).toHaveTextContent('Mollë · 223 g')
    expect(within(basket).getByRole('button', { name: /^Shto te Dreka/ })).toHaveTextContent('4 ushqime')
  })

  it('Plani im si "Si në plan": pluhuri i proteinës i shënuar te suplementet nuk del dhe nuk shtohet dy herë', async () => {
    const { saveSupplement, toggleSupplement } = await import('@/data/supplements')
    const id = await saveSupplement(data.store, {
      name: 'Gold Standard 100% Whey',
      kind: 'protein',
      doseAmount: 1,
      doseUnit: 'scoop',
      scoopG: 30.4,
      timing: ['breakfast_1'],
      macros: { kcal: 120, proteinG: 24, carbsG: 3, fatG: 1.5 },
      countsAsFood: true,
    })
    await toggleSupplement(data.store, { date: TODAY, supplementId: id, meal: 'breakfast_1' })
    try {
      const user = userEvent.setup()
      await renderPage('/ushqimi/shto/breakfast_1')
      const plan = await screen.findByRole('region', { name: 'Plani im · Mëngjesi 1' })
      expect(plan).not.toHaveTextContent('Pluhur proteine')
      await user.click(screen.getByRole('button', { name: 'Shto të gjitha në shportë: Plani im · Mëngjesi 1' }))
      const basket = await basketRegion()
      expect(basket).not.toHaveTextContent('Pluhur proteine')
    } finally {
      await data.db.supplement_logs.clear()
      await data.db.supplements.clear()
    }
  })

  it('sasia: njësitë, çipat ½ · 1 · 2 · 3 · 4, ± , makrot, "Nga sa mbetet sot", ylli dhe shtimi në shportë', async () => {
    const user = userEvent.setup()
    const { yogurt } = await seed()
    await renderPage()
    await user.click(await within(await screen.findByRole('region', { name: 'Të preferuarat' })).findByRole('button', { name: /^Kos/ }))
    const sheet = await screen.findByRole('dialog', { name: 'Kos' })
    expect(sheet).toHaveTextContent('I yti · 60 kcal / 100 g')
    const units = within(sheet).getByRole('group', { name: 'Njësia' })
    expect(within(units).getByRole('button', { name: 'gotë · 200\u00a0g' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(sheet).getByLabelText('Sasia')).toHaveValue('1')
    expect(sheet).toHaveTextContent('120 kcal')
    expect(within(sheet).getByRole('heading', { name: 'Nga sa mbetet sot' })).toBeInTheDocument()
    expect(sheet).toHaveTextContent(/\d+% · 120 nga [\d\s]+ kcal/)

    await user.click(within(sheet).getByRole('button', { name: 'Një më shumë' }))
    expect(within(sheet).getByLabelText('Sasia')).toHaveValue('2')
    expect(sheet).toHaveTextContent('400 g')
    expect(sheet).toHaveTextContent('240 kcal')
    await user.click(within(within(sheet).getByRole('group', { name: 'Sa porcione' })).getByRole('button', { name: '½' }))
    expect(within(sheet).getByLabelText('Sasia')).toHaveValue('0,5')
    await user.click(within(within(sheet).getByRole('group', { name: 'Sa porcione' })).getByRole('button', { name: '3' }))
    expect(within(sheet).getByLabelText('Sasia')).toHaveValue('3')

    await user.click(within(units).getByRole('button', { name: 'gram' }))
    expect(within(sheet).getByLabelText('Sasia')).toHaveValue('600')
    expect(within(sheet).queryByRole('group', { name: 'Sa porcione' })).not.toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: '10 g më shumë' }))
    expect(within(sheet).getByLabelText('Sasia')).toHaveValue('610')
    await user.click(within(units).getByRole('button', { name: 'gotë · 200\u00a0g' }))
    // 610 g nuk është shumëfish i gjysmës së porcionit: kthehet në 1 porcion.
    expect(within(sheet).getByLabelText('Sasia')).toHaveValue('1')

    const star = within(sheet).getByRole('button', { name: 'Hiq nga të preferuarat' })
    expect(star).toHaveAttribute('aria-pressed', 'true')
    await user.click(star)
    await waitFor(async () => expect((await data.store.get('foods', yogurt))?.favorite_g ?? null).toBeNull())
    expect(await within(sheet).findByRole('button', { name: 'Shto te të preferuarat' })).toHaveAttribute('aria-pressed', 'false')

    await user.click(within(within(sheet).getByRole('group', { name: 'Sa porcione' })).getByRole('button', { name: '2' }))
    await user.click(within(sheet).getByRole('button', { name: /^Shto në shportë/ }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await basketRegion()).toHaveTextContent('Kos · 2')
    expect(await todayEntries()).toEqual([])
  })

  it('me shkrim: të tuat në telefon, pastaj Lista e Vrullit; Open Food Facts nuk thirret gjatë shkrimit, vetëm me prekje', async () => {
    const user = userEvent.setup()
    await seed()
    off.search.mockResolvedValue([NUTELLA])
    await renderPage()
    const field = await screen.findByLabelText('Kërko ushqimin')
    await user.type(field, 'gjoks')
    expect(await screen.findByRole('region', { name: 'Të tuat' })).toHaveTextContent('Gjoks pule')
    expect(screen.getByText('Punon pa internet')).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Mjetet' })).not.toBeInTheDocument()
    const list = await screen.findByRole('region', { name: 'Lista e Vrullit' })
    expect(list).toHaveTextContent('Gjoks pule pa lëkurë, i pagatuar')
    // Të tuat para Listës së Vrullit.
    expect(screen.getByRole('region', { name: 'Të tuat' }).compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // Pa asnjë thirrje Open Food Facts gjatë shkrimit.
    expect(off.search).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: /Kërko “gjoks” te produktet e paketuara/ }))
    expect(off.search).toHaveBeenCalledTimes(1)
    expect(off.search).toHaveBeenCalledWith('gjoks', expect.any(AbortSignal))
    const results = await screen.findByRole('region', { name: 'Open Food Facts' })
    expect(results).toHaveTextContent('Nutella')
    expect(results).toHaveTextContent('Ferrero')
    await user.click(within(results).getByRole('button', { name: 'Shto Nutella në shportë' }))
    expect(await basketRegion()).toHaveTextContent('Nutella · 15 g')
    const saved = (await data.store.all('foods')).filter((row) => row.source === 'off')
    expect(saved.map((row) => row.source_id)).toEqual(['3017620422003'])
    expect(within(results).getByRole('group', { name: 'Nutella: 1 në shportë' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Fshi kërkimin' }))
    expect(field).toHaveValue('')
    expect(await screen.findByRole('group', { name: 'Mjetet' })).toBeInTheDocument()
  })

  it('Lista e Vrullit: "veze" dhe "vezë" gjejnë vezën me emrin anglisht krahas, burimin dhe porcionin; "+" e ruan te ushqimet e tua', async () => {
    const user = userEvent.setup()
    const fetched = vi.spyOn(globalThis, 'fetch')
    await renderPage()
    const field = await screen.findByLabelText('Kërko ushqimin')
    await user.type(field, 'veze')
    const list = await screen.findByRole('region', { name: 'Lista e Vrullit' })
    const egg = (await within(list).findAllByRole('listitem'))[0]
    expect(egg).toHaveTextContent('Vezë')
    expect(egg).toHaveTextContent('Egg, whole, raw, fresh')
    expect(egg).toHaveTextContent('USDA')
    expect(egg).toHaveTextContent('1 large · 72 kcal · 6 g P')
    await user.clear(field)
    await user.type(field, 'vezë')
    expect((await within(await screen.findByRole('region', { name: 'Lista e Vrullit' })).findAllByRole('listitem'))[0]).toHaveTextContent('Vezë')

    await user.click(within(screen.getByRole('region', { name: 'Lista e Vrullit' })).getAllByRole('button', { name: /^Shto Vezë/ })[0])
    expect(await basketRegion()).toHaveTextContent('Vezë · 1')
    const saved = (await data.store.all('foods')).filter((row) => row.source === 'catalog')
    expect(saved).toHaveLength(1)
    expect(saved[0]).toMatchObject({ source_id: 'usda-fdc-171287', name: 'Vezë', serving_g: 50, serving_label: '1 large' })
    // Asnjë kërkesë rrjeti për listën, as për Open Food Facts.
    expect(fetched).not.toHaveBeenCalled()
    expect(off.search).not.toHaveBeenCalled()
    fetched.mockRestore()
  })

  it('Lista e Vrullit në anglisht: emri i burimit, pa emër shqip krahas, burimi i shkurtër', async () => {
    const user = userEvent.setup()
    language.set('en')
    await renderPage()
    await user.type(await screen.findByLabelText('Search for a food'), 'chicken')
    const list = await screen.findByRole('region', { name: 'Vrull food list' })
    const row = (await within(list).findAllByRole('listitem'))[0]
    expect(row).toHaveTextContent(/^Chicken/)
    expect(row).toHaveTextContent('USDA')
    expect(list).not.toHaveTextContent('Gjoks pule')
  })

  it('pjatat shqiptare (V65): "byrek", "tave kosi", "fasule" dhe "flija" dalin me emrin shqip dhe anglisht, "Vrull, recetë", "vlerësim" dhe porcionin e recetës', async () => {
    const user = userEvent.setup()
    const fetched = vi.spyOn(globalThis, 'fetch')
    await renderPage()
    const field = await screen.findByLabelText('Kërko ushqimin')
    await user.type(field, 'byrek')
    const list = await screen.findByRole('region', { name: 'Lista e Vrullit' })
    const spinach = (await within(list).findAllByRole('listitem')).find((row) => row.textContent?.includes('Byrek me spinaq'))!
    expect(spinach).toHaveTextContent('Spinach byrek')
    expect(spinach).toHaveTextContent('Vrull, recetë')
    expect(spinach).toHaveTextContent('vlerësim')
    expect(spinach).toHaveTextContent('1 copë · 264 kcal · 9 g P')
    await user.clear(field)
    await user.type(field, 'tave kosi')
    expect(await within(await screen.findByRole('region', { name: 'Lista e Vrullit' })).findByText('Tavë kosi')).toBeInTheDocument()
    await user.clear(field)
    await user.type(field, 'fasule')
    const beans = await within(await screen.findByRole('region', { name: 'Lista e Vrullit' })).findAllByRole('listitem')
    expect(beans.some((row) => row.textContent?.includes('Vrull, recetë') && row.textContent?.includes('1 pjatë'))).toBe(true)
    await user.clear(field)
    await user.type(field, 'flija')
    const flija = (await within(await screen.findByRole('region', { name: 'Lista e Vrullit' })).findAllByRole('listitem'))[0]
    expect(flija).toHaveTextContent('Flija')
    expect(flija).toHaveTextContent('recetë e lexuesve')
    expect(fetched).not.toHaveBeenCalled()
    fetched.mockRestore()
  })

  it('pjata shqiptare: "+" e ruan me porcionin e recetës; prekja hap faqen me përbërësit, vlerësimet dhe burimin me lidhje', async () => {
    const user = userEvent.setup()
    await renderPage()
    await user.type(await screen.findByLabelText('Kërko ushqimin'), 'byrek me spinaq')
    const list = await screen.findByRole('region', { name: 'Lista e Vrullit' })
    await user.click(within(list).getAllByRole('button', { name: /Byrek me spinaq/ })[0])
    const sheet = await screen.findByRole('dialog', { name: 'Byrek me spinaq' })
    expect(sheet).toHaveTextContent('Vrull, recetë · vlerësim')
    const recipe = within(sheet)
    expect(recipe.getByRole('heading', { name: 'Receta' })).toBeInTheDocument()
    expect(recipe.getByText('500 gr miell')).toBeInTheDocument()
    expect(recipe.getAllByText('500 g', { selector: 'span' })).toHaveLength(2)
    expect(recipe.getByRole('heading', { name: 'Çfarë është vlerësim' })).toBeInTheDocument()
    expect(recipe.getByText(/Vaj për tiganin dhe petët: 30 g/)).toBeInTheDocument()
    expect(recipe.getByText(/Shqiptarja\.com \(redaksia\)/)).toBeInTheDocument()
    const source = recipe.getByRole('link', { name: /Hap burimin/ })
    expect(source).toHaveAttribute('href', expect.stringMatching(/^https:\/\/shqiptarja\.com\//))
    expect(source).toHaveAttribute('rel', 'noreferrer')
    // Pas shtimit te shporta ruhet te ushqimet e tua me porcionin e recetës.
    await user.click(within(sheet).getByRole('button', { name: /^Shto në shportë/ }))
    expect(await basketRegion()).toHaveTextContent('Byrek me spinaq · 1')
    const saved = (await data.store.all('foods')).filter((row) => row.source === 'catalog')
    expect(saved[0]).toMatchObject({ source_id: 'vrull-dish-byrek-me-spinaq', name: 'Byrek me spinaq', serving_g: 136, serving_label: '1 copë' })
  })

  it('pjata e madhe: çipi "4" fiket kur kalon 2 kg (tavë kosi 554 g), "3" mbetet', async () => {
    const user = userEvent.setup()
    await renderPage()
    await user.type(await screen.findByLabelText('Kërko ushqimin'), 'tave kosi')
    const list = await screen.findByRole('region', { name: 'Lista e Vrullit' })
    await user.click(within(list).getAllByRole('button', { name: /Tavë kosi/ })[0])
    const sheet = within(await screen.findByRole('dialog', { name: 'Tavë kosi' }))
    expect(sheet.getByRole('button', { name: '4' })).toBeDisabled()
    expect(sheet.getByRole('button', { name: '3' })).toBeEnabled()
  })

  it('pjata shqiptare në anglisht: emri anglisht me emrin shqip krahas, porcioni "1 piece", faqja e recetës në anglisht', async () => {
    const user = userEvent.setup()
    language.set('en')
    await renderPage()
    await user.type(await screen.findByLabelText('Search for a food'), 'spinach byrek')
    const list = await screen.findByRole('region', { name: 'Vrull food list' })
    const row = (await within(list).findAllByRole('listitem'))[0]
    expect(row).toHaveTextContent(/^Spinach byrek/)
    expect(row).toHaveTextContent('Byrek me spinaq')
    expect(row).toHaveTextContent('Vrull recipe')
    expect(row).toHaveTextContent('estimate')
    expect(row).toHaveTextContent('1 piece')
    await user.click(within(row).getAllByRole('button', { name: /Spinach byrek/ })[0])
    const sheet = await screen.findByRole('dialog', { name: 'Spinach byrek' })
    expect(within(sheet).getByRole('heading', { name: 'Recipe' })).toBeInTheDocument()
    expect(within(sheet).getByRole('heading', { name: 'Ingredients' })).toBeInTheDocument()
    expect(within(sheet).getByText('Pan-cooked byrek with hand-rolled pastry, spinach, white cheese and egg.')).toBeInTheDocument()
  })

  it('një ushqim i listës që e ke tashmë te të tuat nuk del dy herë', async () => {
    const user = userEvent.setup()
    await renderPage()
    const field = await screen.findByLabelText('Kërko ushqimin')
    await user.type(field, 'veze')
    const list = await screen.findByRole('region', { name: 'Lista e Vrullit' })
    await user.click((await within(list).findAllByRole('button', { name: /^Shto Vezë/ }))[0])
    await basketRegion()
    await user.clear(field)
    await user.type(field, 'veze')
    const mine = await screen.findByRole('region', { name: 'Të tuat' })
    expect(mine).toHaveTextContent('Vezë')
    expect(mine).toHaveTextContent('USDA')
    const rest = screen.getByRole('region', { name: 'Lista e Vrullit' })
    expect(within(rest).queryByRole('button', { name: /^Shto Vezë, / })).not.toBeInTheDocument()
    expect(within(rest).queryAllByRole('button', { name: /^Shto Vezë$/ })).toHaveLength(0)
  })

  it('Open Food Facts pa internet ose me gabim: thuhet me fjalë; pa rezultate: thuhet', async () => {
    const user = userEvent.setup()
    await renderPage()
    await user.type(await screen.findByLabelText('Kërko ushqimin'), 'xyz')
    expect(await screen.findByText('Asnjë ushqim i yti për “xyz”.')).toBeInTheDocument()
    const online = vi.spyOn(window.navigator, 'onLine', 'get')
    online.mockReturnValue(false)
    await user.click(screen.getByRole('button', { name: /Kërko “xyz” te produktet e paketuara/ }))
    expect(await screen.findByText('Pa internet: produktet e paketuara kërkohen kur lidhesh.')).toBeInTheDocument()
    expect(off.search).not.toHaveBeenCalled()
    online.mockReturnValue(true)
    off.search.mockRejectedValueOnce(new Error('rrjeti'))
    await user.click(screen.getByRole('button', { name: /Kërko “xyz” te produktet e paketuara/ }))
    expect(await screen.findByText('Open Food Facts nuk u përgjigj. Provo përsëri.')).toBeInTheDocument()
    off.search.mockResolvedValueOnce([])
    await user.click(screen.getByRole('button', { name: /Kërko “xyz” te produktet e paketuara/ }))
    expect(await screen.findByText('Open Food Facts nuk gjeti asgjë për “xyz”.')).toBeInTheDocument()
    online.mockRestore()
  })

  it('?q= mbush kërkimin me fokus; ?barkod=1 hap fletën e barkodit, produkti hapet te sasia dhe mbyllja kthen te faqja', async () => {
    const user = userEvent.setup()
    await seed()
    const { router, unmount } = await renderPage('/ushqimi/shto/lunch?q=oriz')
    const field = await screen.findByLabelText('Kërko ushqimin')
    expect(field).toHaveValue('oriz')
    expect(field).toHaveFocus()
    expect(await screen.findByRole('region', { name: 'Të tuat' })).toHaveTextContent('Oriz kaf')
    unmount()

    off.product.mockResolvedValueOnce({ ...NUTELLA, sourceId: '8000500310427', name: 'Kinder Bueno', servingG: 21.5, servingLabel: '1 bar' })
    const second = await renderPage('/ushqimi/shto/lunch?barkod=1')
    const sheet = await screen.findByRole('dialog', { name: 'Barkodi' })
    await user.type(within(sheet).getByLabelText('Shifrat poshtë vijave'), '123')
    await user.click(within(sheet).getByRole('button', { name: 'Kërko' }))
    expect(within(sheet).getByRole('alert')).toHaveTextContent('Shkruaj të gjitha shifrat')
    await user.clear(within(sheet).getByLabelText('Shifrat poshtë vijave'))
    await user.type(within(sheet).getByLabelText('Shifrat poshtë vijave'), '8000500310427{Enter}')
    expect(off.product).toHaveBeenCalledWith('8000500310427')
    const amount = await screen.findByRole('dialog', { name: 'Kinder Bueno' })
    expect(within(amount).getByRole('button', { name: 'bar · 21,5\u00a0g' })).toBeInTheDocument()
    // Open Food Facts: atribuimi ODbL te produkti, dhe produkti i skanuar ndahet me grupin.
    expect(within(amount).getByText('Contains data from Open Food Facts, available under the Open Database License')).toBeInTheDocument()
    expect((await data.store.all('food_products')).map((row) => [row.barcode, row.source, row.license, row.name, row._dirty])).toEqual([['8000500310427', 'open_food_facts', 'ODbL-1.0', 'Kinder Bueno', 1]])
    await user.click(within(amount).getByRole('button', { name: 'Mbyll' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(second.router.state.location.pathname).toBe('/ushqimi/shto/lunch')
    expect(second.router.state.location.search).toBe('')
    expect(router).toBeDefined()
  })

  it('barkodi gjendet te produktet e grupit pa thirrur Open Food Facts, edhe pa internet; produkti i një tjetri del me markën, pa emrin e kujt e shtoi', async () => {
    const user = userEvent.setup()
    await data.db.food_products.put({ id: 'p-1', _dirty: 0, barcode: '5449000000996', source: 'open_food_facts', license: 'ODbL-1.0', name: 'Coca-Cola Zero', brand: 'Coca-Cola', kcal: 0.3, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: null, serving_g: 330, serving_label: '1 kanaçe', created_at: '2026-11-15T10:00:00Z', updated_at: '2026-11-15T10:00:00Z', deleted_at: null, server_updated_at: '2026-11-15T10:00:01Z' } as never)
    const online = vi.spyOn(window.navigator, 'onLine', 'get')
    online.mockReturnValue(false)
    await renderPage('/ushqimi/shto/lunch?barkod=1')
    // Faqja mbaron leximin para shkrimit (një rivizatim në mes të shkrimit e humbte fokusin).
    await screen.findAllByText('Ton albacore në ujë')
    const sheet = await screen.findByRole('dialog', { name: 'Barkodi' })
    await user.type(within(sheet).getByLabelText('Shifrat poshtë vijave'), '5449000000996{Enter}')
    const amount = await screen.findByRole('dialog', { name: 'Coca-Cola Zero' })
    expect(off.product).not.toHaveBeenCalled()
    expect(within(amount).getByText('Contains data from Open Food Facts, available under the Open Database License')).toBeInTheDocument()
    const saved = (await data.store.all('foods')).filter((row) => row.source === 'off')
    expect(saved.map((row) => [row.source_id, row.brand])).toEqual([['5449000000996', 'Coca-Cola']])
    // Nuk krijohet një rresht i dytë te grupi.
    expect(await data.db.food_products.count()).toBe(1)
    online.mockRestore()
  })

  it('me shkrim: seksioni "Produktet e grupit" me produktin e një tjetri, pas Listës së Vrullit', async () => {
    const user = userEvent.setup()
    await data.db.food_products.put({ id: 'p-2', _dirty: 0, barcode: '8000500310427', source: 'open_food_facts', license: 'ODbL-1.0', name: 'Kinder Bueno', brand: 'Ferrero', kcal: 572, protein_g: 8.6, carbs_g: 49.5, fat_g: 37, fiber_g: null, serving_g: 21.5, serving_label: '1 bar', created_at: '2026-11-15T10:00:00Z', updated_at: '2026-11-15T10:00:00Z', deleted_at: null, server_updated_at: '2026-11-15T10:00:01Z' } as never)
    await renderPage()
    await user.type(await screen.findByLabelText('Kërko ushqimin'), 'kinder')
    const group = await screen.findByRole('region', { name: 'Produktet e grupit' })
    expect(group).toHaveTextContent('Kinder Bueno')
    expect(group).toHaveTextContent('Ferrero')
    expect(group).not.toHaveTextContent('added_by')
    await user.click(within(group).getByRole('button', { name: 'Shto Kinder Bueno në shportë' }))
    expect(await basketRegion()).toHaveTextContent('Kinder Bueno · 1')
    expect(off.search).not.toHaveBeenCalled()
  })

  it('barkodi që mungon shtohet si ushqim i ri; "Ushqim i ri" nga mjetet hap sasinë dhe e shton në shportë', async () => {
    const user = userEvent.setup()
    off.product.mockResolvedValueOnce(null)
    await renderPage()
    await user.click(within(await screen.findByRole('group', { name: 'Mjetet' })).getByRole('button', { name: 'Barkodi' }))
    let sheet = screen.getByRole('dialog', { name: 'Barkodi' })
    await user.type(within(sheet).getByLabelText('Shifrat poshtë vijave'), '1234567890123{Enter}')
    await user.click(await within(sheet).findByRole('button', { name: 'Shto si ushqim të ri' }))
    sheet = screen.getByRole('dialog', { name: 'Ushqim i ri' })
    await user.type(within(sheet).getByLabelText('Emri'), 'Bukë e zezë')
    await user.click(within(sheet).getByRole('button', { name: 'Ruaj ushqimin' }))
    expect(within(sheet).getByRole('alert')).toHaveTextContent('Shkruaj kcal dhe makrot për 100 g, si numra.')
    for (const [label, value] of [['Kcal', '250'], ['Proteina, g', '9'], ['Karbohidrate, g', '45'], ['Yndyrë, g', '3,5'], ['Një porcion, g', '40']]) {
      await user.type(within(sheet).getByLabelText(label), value)
    }
    await user.click(within(sheet).getByRole('button', { name: 'Ruaj ushqimin' }))
    const amount = await screen.findByRole('dialog', { name: 'Bukë e zezë' })
    expect(within(amount).getByLabelText('Sasia')).toHaveValue('1')
    expect(within(amount).getByRole('button', { name: /^Shto në shportë/ })).toHaveTextContent('100 kcal · 4 g proteinë')
    await user.click(within(amount).getByRole('button', { name: 'Një më shumë' }))
    await user.click(within(amount).getByRole('button', { name: /^Shto në shportë/ }))
    expect(await basketRegion()).toHaveTextContent('Bukë e zezë · 80 g')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('rishikimi: sasia ndryshohet, vakti ndërrohet, "Sot pas regjistrimit", shtimi te vakti i zgjedhur dhe "Fshi shportën"', async () => {
    const user = userEvent.setup()
    await seed()
    await renderPage()
    await user.click(await screen.findByRole('button', { name: 'Shto të gjitha në shportë: Si dje · Dreka' }))
    const basket = await basketRegion()
    await user.click(within(basket).getByRole('button', { name: 'Hap shportën' }))
    let sheet = await screen.findByRole('dialog', { name: 'Shporta' })
    expect(sheet).toHaveTextContent('2 ushqime · prek sasinë për ta ndryshuar')
    expect(within(sheet).getByRole('region', { name: /^Pas regjistrimit: 425 nga [\d\s]+ kcal/ })).toHaveTextContent('Sot pas regjistrimit')
    expect(sheet).toHaveTextContent('425 kcal')

    await user.click(within(sheet).getByRole('button', { name: 'Ndrysho sasinë: Gjoks pule, 200\u00a0g' }))
    const edit = await screen.findByRole('dialog', { name: 'Gjoks pule' })
    expect(within(edit).getByLabelText('Sasia')).toHaveValue('200')
    await user.click(within(edit).getByRole('button', { name: '10 g më shumë' }))
    await user.click(within(edit).getByRole('button', { name: /^Ruaj sasinë/ }))
    sheet = await screen.findByRole('dialog', { name: 'Shporta' })
    expect(within(sheet).getByRole('button', { name: 'Ndrysho sasinë: Gjoks pule, 210\u00a0g' })).toBeInTheDocument()
    expect(sheet).toHaveTextContent('437 kcal')

    await user.click(within(sheet).getByRole('button', { name: /^Te Dreka · / }))
    const picker = await screen.findByRole('dialog', { name: 'Zgjidh vaktin' })
    expect(within(picker).getByRole('button', { name: /^Dreka · / })).toHaveAttribute('aria-pressed', 'true')
    await user.click(within(picker).getByRole('button', { name: /^Darka · / }))
    sheet = await screen.findByRole('dialog', { name: 'Shporta' })
    expect(await within(sheet).findByRole('button', { name: /^Te Darka · / })).toBeInTheDocument()

    await user.click(within(sheet).getByRole('button', { name: 'Hiq Oriz kaf' }))
    expect(sheet).toHaveTextContent('1 ushqim · prek sasinë për ta ndryshuar')
    await user.click(within(sheet).getByRole('button', { name: /^Shto te Darka/ }))
    expect(await screen.findByRole('heading', { name: 'Ushqimi' })).toBeInTheDocument()
    expect(await todayEntries()).toEqual([['dinner', 210, 252]])
    expect(JSON.parse(screen.getByTestId('state').textContent ?? 'null')).toMatchObject({ added: { meal: 'dinner', kcal: 252 } })
  })

  it('"Fshi shportën" e zbraz dhe mbyll fletën; shporta mbetet pas ringarkimit të ekranit', async () => {
    const user = userEvent.setup()
    await seed()
    const first = await renderPage()
    await user.click(await screen.findByRole('button', { name: 'Shto të gjitha në shportë: Si dje · Dreka' }))
    await basketRegion()
    first.unmount()
    await renderPage()
    const basket = await basketRegion()
    expect(basket).toHaveTextContent('Gjoks pule · 200 g')
    await user.click(within(basket).getByRole('button', { name: 'Hap shportën' }))
    const sheet = await screen.findByRole('dialog', { name: 'Shporta' })
    await user.click(within(sheet).getByRole('button', { name: 'Fshi shportën' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.queryByRole('region', { name: 'Shporta' })).not.toBeInTheDocument()
    expect(window.localStorage.getItem('vrull.basket')).toBeNull()
    expect(await todayEntries()).toEqual([])
  })

  it('shporta e dëmtuar në telefon nuk prish ekranin', async () => {
    window.localStorage.setItem('vrull.basket', '{jo json')
    await renderPage()
    expect(await screen.findByRole('group', { name: 'Mjetet' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Shporta' })).not.toBeInTheDocument()
  })

  it('vakti ndërrohet nga çipi: seksionet ndjekin vaktin', async () => {
    const user = userEvent.setup()
    await renderPage()
    await user.click(await screen.findByRole('button', { name: /^Te Dreka · / }))
    const picker = await screen.findByRole('dialog', { name: 'Zgjidh vaktin' })
    await user.click(within(picker).getByRole('button', { name: /^Darka · / }))
    expect(await screen.findByRole('region', { name: 'Plani im · Darka' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Te Darka · / })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('në anglisht: tekstet, njësitë, shporta; emrat e ushqimeve të planit në anglisht, ata të tuat siç janë', async () => {
    const user = userEvent.setup()
    await seed()
    language.set('en')
    await renderPage()
    expect(await screen.findByRole('heading', { level: 1, name: 'Add to Lunch' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back to Food' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Scan a barcode' })).toBeInTheDocument()
    const tools = await screen.findByRole('group', { name: 'Tools' })
    expect(within(tools).getAllByRole('button').map((button) => button.textContent)).toEqual(['Barcode', 'Photo', 'Macros', 'New food'])
    expect(screen.getByRole('button', { name: /^To Lunch · / })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Like yesterday · Lunch' })).toHaveTextContent('2 foods · 425 kcal · 49 g P')
    const plan = screen.getByRole('region', { name: 'My plan · Lunch' })
    expect(plan).toHaveTextContent('Albacore tuna in water')
    expect(screen.getByRole('region', { name: 'Favourites' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Recent' })).toBeInTheDocument()

    await user.click(within(plan).getByRole('button', { name: 'Add Albacore tuna in water to the basket' }))
    const basket = await screen.findByRole('region', { name: 'Basket' })
    await user.click(within(basket).getByRole('button', { name: 'Open the basket' }))
    const sheet = await screen.findByRole('dialog', { name: 'Basket' })
    expect(sheet).toHaveTextContent('1 food · tap the amount to change it')
    expect(within(sheet).getByRole('button', { name: 'Clear the basket' })).toBeInTheDocument()
    expect(within(sheet).getByRole('region', { name: /^After logging: / })).toHaveTextContent('Today after logging')
    await user.click(within(sheet).getByRole('button', { name: /^Change the amount: Albacore tuna in water/ }))
    const amount = await screen.findByRole('dialog', { name: 'Albacore tuna in water' })
    expect(within(amount).getByRole('button', { name: /^Save amount/ })).toBeInTheDocument()
    expect(within(amount).getByRole('button', { name: '10 g less' })).toBeInTheDocument()
    expect(within(amount).getByText('Out of what is left today')).toBeInTheDocument()
    await user.click(within(amount).getByRole('button', { name: 'Close' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Basket' })).getByRole('button', { name: 'Close' }))

    await user.type(screen.getByLabelText('Search for a food'), 'zzz')
    expect(await screen.findByText('None of your foods match “zzz”.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Search “zzz” in packaged products/ })).toHaveTextContent('Open Food Facts · needs internet')
    expect(screen.getByText('Works offline')).toBeInTheDocument()
    expect(document.body.textContent?.replace(/Gjoks pule|Oriz kaf/g, '')).not.toMatch(/[ëç]/)
  })

  it('shporta e shpejtë: asnjë regjistrim para "Shto te vakti"; çipi mund të hiqet me 44 px dhe emri i butonit', async () => {
    const user = userEvent.setup()
    await seed()
    await renderPage()
    await user.click(await screen.findByRole('button', { name: 'Shto Kos në shportë' }))
    const basket = await basketRegion()
    expect(await todayEntries()).toEqual([])
    await act(async () => undefined)
    await user.click(within(basket).getByRole('button', { name: 'Hiq Kos' }))
    expect(screen.queryByRole('region', { name: 'Shporta' })).not.toBeInTheDocument()
  })
})
