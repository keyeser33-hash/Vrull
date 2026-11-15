import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router'
import type { LocalDatabase } from '@/data/db'
import type { LocalStore } from '@/data/store'
import { language } from '@/i18n'

// Plotëso makrot (V2-E3-28c, SPEC §0.3h) me store të vërtetë, të mërkurën 18 nëntor në 12:30 (ditë pushimi, 80 kg: 3 037
// kcal dhe 260 g proteinë; dreka në 13:00 është vakti i radhës). Një vakt i shpejtë i mëngjesit lë 520 kcal dhe 46 g proteinë.
const data = vi.hoisted(() => ({ store: null as unknown as LocalStore, db: null as unknown as LocalDatabase }))
vi.mock('@/data/app-data', async () => {
  const { createDatabase } = await import('@/data/db')
  const { createLocalStore } = await import('@/data/store')
  const db = createDatabase(`fill-macros-${crypto.randomUUID()}`)
  const store = createLocalStore(db, { userId: () => '11111111-1111-4111-8111-111111111111' })
  data.store = store
  data.db = db
  return { store, useLocalQuery: (await import('@/test/local-query')).useLocalQueryFor(store) }
})

const TODAY = '2026-11-18'

function Where() {
  const location = useLocation()
  return <p data-testid="where">{`${location.pathname}${location.search}`}</p>
}

async function renderPage() {
  const { FillMacrosPage } = await import('./fill-macros')
  const router = createMemoryRouter(
    [
      { path: '/ushqimi/plotesomakrot', element: <FillMacrosPage /> },
      { path: '/ushqimi/shto/:meal', element: <Where /> },
      { path: '/ushqimi', element: <Where /> },
      { path: '/ushqimi/objektivat', element: <Where /> },
    ],
    { initialEntries: ['/ushqimi', '/ushqimi/plotesomakrot'], initialIndex: 1 },
  )
  render(<RouterProvider router={router} />)
  return router
}

/** Mëngjesi i shpejtë: kaloritë dhe proteina që e lënë ditën me 520 kcal dhe 46 g proteinë. */
async function eaten(kcal = 2517, proteinG = 214) {
  const { logQuickMacros } = await import('@/data/quick-food')
  await logQuickMacros(data.store, { date: TODAY, meal: 'breakfast_1', name: 'Mëngjesi jashtë', kcal, proteinG, carbsG: 0, fatG: 0, favorite: false })
}

/** Plani im bosh për ditën e pushimit, me një ushqim te dreka kur jepet. */
async function plan(item?: { id: string; name: string; per100: { kcal: number; proteinG: number; carbsG: number; fatG: number } }) {
  const { myPlan, saveMyPlanMeal, userFoodItem } = await import('@/data/my-plan')
  const { nutritionDay } = await import('@/data/nutrition')
  const day = await nutritionDay(data.store, TODAY, data.store.now())
  const current = (await myPlan(data.store, 'rest', day.meals.map((entry) => entry.meal), null)).meals
  for (const entry of current) await saveMyPlanMeal(data.store, 'rest', current, entry.meal, entry.meal === 'lunch' && item ? [userFoodItem({ ...item, sourceId: null }, 210)] : [])
}

async function seedPowder() {
  const { saveSupplement } = await import('@/data/supplements')
  return saveSupplement(data.store, {
    name: 'Pluhur proteine',
    kind: 'protein',
    doseAmount: 1,
    doseUnit: 'scoop',
    scoopG: 30,
    timing: ['lunch'],
    macros: { kcal: 120, proteinG: 24, carbsG: 3, fatG: 1.5 },
    countsAsFood: true,
  })
}

async function seedFoods() {
  const { createCustomFood } = await import('@/data/foods')
  const { setFavorite } = await import('@/data/quick-food')
  const tuna = await createCustomFood(data.store, { name: 'Ton albacore', kcal: 116, proteinG: 26, carbsG: 0, fatG: 0.8, servingG: 142, servingLabel: '1 kanoçe' })
  const bread = await createCustomFood(data.store, { name: 'Bukë integrale', kcal: 250, proteinG: 10, carbsG: 45, fatG: 3, servingG: 28, servingLabel: '1 fetë' })
  await setFavorite(data.store, tuna, 142)
  await setFavorite(data.store, bread, 28)
  const powder = await seedPowder()
  const fillet = await createCustomFood(data.store, { name: 'Fileto gjeli', kcal: 120, proteinG: 22.5, carbsG: 0, fatG: 2 })
  return { tuna, bread, powder, fillet }
}

const cards = async (name = 'Propozimet') => Array.from((await screen.findByRole('list', { name })).children) as HTMLElement[]
const head = (card: HTMLElement) => /^\d+ kcal · \d+ g P/.exec(card.textContent ?? '')?.[0]
const bySource = (list: HTMLElement[], source: string) => list.find((card) => card.textContent?.includes(source))!
const clearAll = () => Promise.all([data.db.foods.clear(), data.db.diary_entries.clear(), data.db.supplements.clear(), data.db.supplement_logs.clear(), data.db.meal_templates.clear(), data.db.nutrition_targets.clear()])

describe('Plotëso makrot', () => {
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
    await clearAll()
  })
  afterEach(() => language.set('sq'))

  it('kreu, "Mbeten … · ora", kartat sipas burimit me artikujt, mbulimin dhe shënimin; hapja nuk shkruan asgjë', async () => {
    const { fillet } = await seedFoods()
    await eaten()
    await plan({ id: fillet, name: 'Fileto gjeli', per100: { kcal: 120, proteinG: 22.5, carbsG: 0, fatG: 2 } })
    await renderPage()
    expect(await screen.findByRole('heading', { level: 1, name: 'Plotëso makrot' })).toBeInTheDocument()
    expect(await screen.findByText('Mbeten 520 kcal dhe 46 g proteinë · 12:30')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Kthehu te Ushqimi' })).toBeInTheDocument()
    const list = await cards()
    expect(list).toHaveLength(3)
    // Të gjitha mbushin proteinën; renditen sipas kalorive, nga më pak. Toni (1 kanoçe) mbushet me 40 g fileto.
    expect(list.map((card) => head(card))).toEqual(['213 kcal · 46 g P', '240 kcal · 48 g P', '252 kcal · 47 g P'])
    expect(list[0]).toHaveTextContent('Ushqimet e tuaTon albacore1 kanoçe · 142 gFileto gjeli40 gMbush proteinën · mbeten 307 kcal')
    // Pluhuri: 2 lugë = 48 g proteinë, 240 kcal.
    expect(bySource(list, 'Suplementet e tua')).toHaveTextContent('240 kcal · 48 g PSuplementet e tuaPluhur proteine2 scoop · 60 gMbush proteinën · mbeten 280 kcal')
    // Plani im: 210 g fileto = 252 kcal dhe 47 g proteinë.
    expect(bySource(list, 'Plani im')).toHaveTextContent('252 kcal · 47 g PPlani imFileto gjeli210 gMbush proteinën · mbeten 268 kcal')
    for (const card of list) expect(within(card).getByRole('button', { name: /^Shto në shportë: / })).toHaveTextContent('Shto në shportë')
    expect(screen.getByText(/^Llogaritur në telefon nga ushqimet e tua, Plani im dhe suplementet, pa AI\./)).toBeInTheDocument()
    expect(screen.queryByRole('link')).toBeNull()
    // Faqja vetëm lexon: asnjë ushqim i planit nuk u ruajt dhe shporta mbeti bosh.
    expect((await data.store.all('foods')).filter((row) => row.source === 'template')).toHaveLength(0)
    expect(window.localStorage.getItem('vrull.basket')).toBeNull()
  })

  it('asnjë propozim nuk kalon kalorit që mbeten, as proteinën shumë mbi 46 g', async () => {
    await seedFoods()
    await eaten(2900, 214)
    await plan()
    await renderPage()
    expect(await screen.findByText('Mbeten 137 kcal dhe 46 g proteinë · 12:30')).toBeInTheDocument()
    for (const card of await cards()) {
      expect(Number.parseInt(/^(\d+) kcal/.exec(card.textContent ?? '')?.[1] ?? '9999', 10)).toBeLessThanOrEqual(137)
    }
  })

  it('"Shto në shportë": artikujt hyjnë te shporta e vaktit të radhës dhe hapet rishikimi te "Shto ushqim"', async () => {
    const user = userEvent.setup()
    const { tuna, bread, powder } = await seedFoods()
    await eaten()
    await plan()
    const router = await renderPage()
    const list = await cards()
    // Pa fileton: pluhuri (100 %, 240 kcal), kanoçja me katër feta bukë (100 %, 445 kcal), pastaj bukë e vetme (7 feta, 43 %).
    expect(list.map((card) => head(card))).toEqual(['240 kcal · 48 g P', '445 kcal · 48 g P', '490 kcal · 20 g P'])
    await user.click(within(bySource(list, 'Ton albacore')).getByRole('button', { name: 'Shto në shportë: Ton albacore, Bukë integrale' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/ushqimi/shto/lunch'))
    expect(await screen.findByTestId('where')).toHaveTextContent('/ushqimi/shto/lunch?ndrysho=shporta')
    const saved = JSON.parse(window.localStorage.getItem('vrull.basket') ?? 'null') as { items: { foodId: string; grams: number; name: string }[] }
    expect(saved.items.map((item) => [item.foodId, item.grams, item.name])).toEqual([
      [tuna, 142, 'Ton albacore'],
      [bread, 112, 'Bukë integrale'],
    ])
    // Pluhuri nuk u shkrua te ditari: shporta është vetëm gati.
    expect(await data.store.where('diary_entries', 'date', TODAY)).toHaveLength(1)
    expect(powder).toBeTruthy()
  })

  it('shtimi bashkohet me atë që shporta ka tashmë', async () => {
    const user = userEvent.setup()
    const { tuna } = await seedFoods()
    await eaten()
    await plan()
    const { basketItemFromFood, saveBasket } = await import('@/data/basket')
    const { foodById } = await import('@/data/foods')
    saveBasket([basketItemFromFood((await foodById(data.store, tuna))!, 100)])
    await renderPage()
    await user.click(within(bySource(await cards(), 'Ton albacore')).getByRole('button', { name: /^Shto në shportë/ }))
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('ndrysho=shporta'))
    const saved = JSON.parse(window.localStorage.getItem('vrull.basket') ?? 'null') as { items: { foodId: string; grams: number }[] }
    expect(saved.items.find((item) => item.foodId === tuna)?.grams).toBe(242)
  })

  it('ushqimi i planit që s’është ruajtur ende ruhet vetëm kur shtohet në shportë', async () => {
    const user = userEvent.setup()
    await eaten()
    // Plani i Jimit i paprekur: dreka ka ushqime të shabllonit, pa asnjë rresht në `foods`.
    await renderPage()
    const plan = (await cards()).find((card) => card.textContent?.includes('Plani im'))
    expect(plan).toBeDefined()
    expect((await data.store.all('foods')).filter((row) => row.source === 'template')).toHaveLength(0)
    await user.click(within(plan!).getByRole('button', { name: /^Shto në shportë/ }))
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('ndrysho=shporta'))
    const saved = JSON.parse(window.localStorage.getItem('vrull.basket') ?? 'null') as { items: { foodId: string; source: string }[] }
    expect(saved.items.length).toBeGreaterThan(0)
    expect(saved.items.every((item) => item.source === 'template')).toBe(true)
    expect((await data.store.all('foods')).filter((row) => row.source === 'template').length).toBeGreaterThan(0)
  })

  it('pluhuri i proteinës numërohet një herë: plani i Jimit e ka të njëjtin pluhur, por propozohet vetëm ai i suplementit', async () => {
    const powder = await seedPowder()
    await eaten()
    const { jimFoodItem } = await import('@/nutrition/my-plan')
    const { myPlan, saveMyPlanMeal } = await import('@/data/my-plan')
    const { nutritionDay } = await import('@/data/nutrition')
    const day = await nutritionDay(data.store, TODAY, data.store.now())
    const current = (await myPlan(data.store, 'rest', day.meals.map((entry) => entry.meal), null)).meals
    for (const entry of current) await saveMyPlanMeal(data.store, 'rest', current, entry.meal, entry.meal === 'lunch' ? [{ ...jimFoodItem('protein'), name: 'Pluhur proteine', sourceId: 'jim:protein' }] : [])
    const { toggleSupplement } = await import('@/data/supplements')
    for (const taken of [false, true]) {
      if (taken) await toggleSupplement(data.store, { date: TODAY, supplementId: powder, meal: 'lunch' })
      await renderPage()
      const list = await cards()
      // Pluhuri del një herë, nga suplementi; pluhuri i planit nuk del si "Plani im".
      expect(list).toHaveLength(1)
      expect(list[0]).toHaveTextContent('Suplementet e tua')
      expect(list[0]).not.toHaveTextContent('Plani im')
      cleanup()
    }
  })

  it('proteina e mbushur: asnjë propozim, vetëm "Proteina e ditës u mbush"', async () => {
    await seedFoods()
    await eaten(2517, 262)
    await renderPage()
    expect(await screen.findByRole('heading', { name: 'Proteina e ditës u mbush' })).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Propozimet' })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Shto në shportë/ })).toBeNull()
    expect(screen.getByText('Mbeten 520 kcal dhe 0 g proteinë · 12:30')).toBeInTheDocument()
  })

  it('kalori negative: asnjë propozim dhe thuhet pse; 0 g proteinë nuk del negative', async () => {
    await seedFoods()
    await eaten(3100, 100)
    await renderPage()
    expect(await screen.findByRole('heading', { name: 'Kaloritë e ditës mbaruan' })).toBeInTheDocument()
    expect(screen.getByText('Mbeten 0 kcal dhe 160 g proteinë · 12:30')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Shto në shportë/ })).toBeNull()
  })

  it('pa ushqime: asnjë propozim dhe një fjali që thotë çfarë të bëjë', async () => {
    await eaten()
    await plan()
    await renderPage()
    expect(await screen.findByRole('heading', { name: 'Ende nuk ka ushqime për të propozuar' })).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Propozimet' })).toBeNull()
  })

  it('asnjë ushqim nuk futet në kalori: thuhet', async () => {
    await seedFoods()
    await eaten(3010, 214)
    await plan()
    await renderPage()
    expect(await screen.findByRole('heading', { name: 'Asnjë ushqim nuk futet në kalorit që mbeten' })).toBeInTheDocument()
  })

  it('pa objektiva (pa peshë): lidhja te Objektivat', async () => {
    const weights = await data.db.body_measurements.toArray()
    await data.db.body_measurements.clear()
    try {
      await renderPage()
      expect(await screen.findByRole('heading', { name: 'Pa objektiva nuk ka çfarë të plotësohet' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Objektivat' })).toHaveAttribute('href', '/ushqimi/objektivat')
    } finally {
      await data.db.body_measurements.bulkPut(weights)
    }
  })

  it('në anglisht: kreu, burimet, njësitë, shporta dhe shënimi', async () => {
    const user = userEvent.setup()
    const { fillet } = await seedFoods()
    await eaten()
    await plan({ id: fillet, name: 'Fileto gjeli', per100: { kcal: 120, proteinG: 22.5, carbsG: 0, fatG: 2 } })
    language.set('en')
    await renderPage()
    expect(await screen.findByRole('heading', { level: 1, name: 'Fill my macros' })).toBeInTheDocument()
    expect(await screen.findByText('520 kcal and 46 g protein left · 12:30')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back to Food' })).toBeInTheDocument()
    const list = await cards('Suggestions')
    const powder = bySource(list, 'Your supplements')
    expect(powder).toHaveTextContent('240 kcal · 48 g PYour supplementsProtein powder2 scoops · 60 gCovers your protein · 280 kcal left')
    expect(bySource(list, 'My plan')).toHaveTextContent('252 kcal · 47 g PMy planFileto gjeli210 gCovers your protein · 268 kcal left')
    expect(bySource(list, 'Your foods')).toHaveTextContent('Ton albacore1 kanoçe · 142 g')
    expect(within(powder).getByRole('button', { name: 'Add to basket: Protein powder' })).toHaveTextContent('Add to basket')
    expect(screen.getByText(/^Worked out on your phone from your foods, My plan and your supplements, without AI\./)).toBeInTheDocument()
    await user.click(within(powder).getByRole('button', { name: /^Add to basket/ }))
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/ushqimi/shto/lunch?ndrysho=shporta'))
  })
})
