import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { LocalStore } from '@/data/store'
import { language } from '@/i18n'

// Kontrolli javor (V33, V2-E2-04): objektivat personale nga 2 nëntor, java 9–15 nëntor me 6 ditë
// 2 800 kcal dhe peshën 88 kg pa lëvizur; e hëna 16 nëntor.
const data = vi.hoisted(() => ({ store: null as unknown as LocalStore }))
vi.mock('@/data/app-data', async () => {
  const { createDatabase } = await import('@/data/db')
  const { createLocalStore } = await import('@/data/store')
  const store = createLocalStore(createDatabase(`weekly-check-ui-${crypto.randomUUID()}`), { userId: () => '11111111-1111-4111-8111-111111111111' })
  data.store = store
  return { store, useLocalQuery: (await import('@/test/local-query')).useLocalQueryFor(store) }
})

const MONDAY = '2026-11-16'

describe('kontrolli javor', () => {
  beforeEach(async () => {
    await import('@/data/app-data')
    for (const table of ['weekly_checks', 'diary_entries', 'body_measurements', 'user_settings', 'nutrition_targets'] as const) {
      for (const row of await data.store.all(table)) await data.store.remove(table, row.id)
    }
    const { completeOnboarding } = await import('@/data/profile')
    const { EMPTY_TARGETS_PROFILE, saveTargetsProfile } = await import('@/data/targets-profile')
    await completeOnboarding(data.store, { weightKg: 88, trainingDays: [1, 2, 4, 5], trainingTime: '21:00', wakeTime: '08:20', sleepTime: '01:00' }, () => new Date('2026-11-02T08:00:00'))
    await saveTargetsProfile(data.store, { ...EMPTY_TARGETS_PROFILE, sex: 'male', heightCm: 185, activity: 'sedentary', goal: 'gain' }, '2026-11-02')
    for (const date of ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14']) {
      await data.store.put('diary_entries', { date, meal: 'lunch', kcal: 2800, protein_g: 170, carbs_g: 350, fat_g: 80, logged_at: `${date}T13:00:00.000Z` })
    }
    await data.store.put('body_measurements', { date: '2026-11-15', weight_kg: 88 })
  })
  afterEach(() => language.set('sq'))

  async function renderCard() {
    const { WeeklyCheckCard, WeeklyCheckSummary } = await import('./weekly-check-card')
    return render(
      <>
        <WeeklyCheckCard date={MONDAY} />
        <WeeklyCheckSummary date={MONDAY} from="2026-11-02" />
      </>,
    )
  }

  it('propozon 90 kcal; "Po" e pranon, karta ikën dhe korrigjimi del te historia', async () => {
    const user = userEvent.setup()
    await renderCard()
    const card = await screen.findByRole('region', { name: 'Pesha nuk lëvizi' })
    expect(within(card).getByText('Kontrolli javor · Java 2')).toBeInTheDocument()
    expect(within(card).getByText(/^Synimi ishte \+0,2\skg\. Regjistrove ushqimin 6 ditë nga 7, mesatarisht 2\s800 kcal\.$/)).toBeInTheDocument()
    expect(within(card).getByRole('img', { name: /^Pesha trend në 14 ditë: nga 88,0\skg në 88,0\skg; synimi 88,2\skg$/ })).toBeInTheDocument()
    expect(card).toHaveTextContent(/Shto 90 kcal në ditë, te karbohidratet: stërvitje 3\s020, pushim 2\s720\./)

    await user.click(within(card).getByRole('button', { name: 'Po, shto 90 kcal' }))
    await vi.waitFor(() => expect(screen.queryByRole('region', { name: 'Pesha nuk lëvizi' })).not.toBeInTheDocument())
    expect(await screen.findByText(/^Java 2: korrigjimi u pranua\. Kontrolli tjetër del e hënë, 23 nëntor\.$/)).toBeInTheDocument()
    const history = screen.getByRole('definition')
    expect(history).toHaveTextContent('+90')
  })

  it('"Jo tani" e heq kartën pa ndryshuar objektivat', async () => {
    const user = userEvent.setup()
    await renderCard()
    await user.click(await screen.findByRole('button', { name: 'Jo tani' }))
    expect(await screen.findByText(/^Java 2: objektivat mbetën si ishin\./)).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Pesha nuk lëvizi' })).not.toBeInTheDocument()
    const { readAdjustments } = await import('@/data/targets-profile')
    expect(await readAdjustments(data.store)).toEqual([])
  })

  it('në anglisht', async () => {
    language.set('en')
    await renderCard()
    const card = await screen.findByRole('region', { name: 'Your weight held steady' })
    expect(within(card).getByText('Weekly review · Week 2')).toBeInTheDocument()
    expect(card).toHaveTextContent(/Add 90 kcal a day, to carbs: training 3,020, rest 2,720\./)
    expect(within(card).getByRole('button', { name: 'Yes, add 90 kcal' })).toBeInTheDocument()
    expect(within(card).getByRole('button', { name: 'Not now' })).toBeInTheDocument()
  })
})
