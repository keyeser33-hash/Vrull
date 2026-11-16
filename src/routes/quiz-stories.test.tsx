import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { LocalStore } from '@/data/store'
import { language } from '@/i18n/language'
import { factById } from '@/learn/facts'

// Kuizi i së dielës si story (V56, SPEC §0.3e; bordet "Sot · E diela", "Kuizi · Hyrja", "Pyetja", "Përgjigja",
// "Rezultati"), me app-in e vërtetë mbi një bazë lokale prove. Java e kuizit: 9–15 nëntor 2026.
const data = vi.hoisted(() => ({ store: null as unknown as LocalStore, clock: new Date(2026, 10, 9, 10, 0) }))

vi.mock('@/lib/webgl', () => ({ webglAvailable: () => false }))
vi.mock('@/data/app-data', async () => {
  const store = new Proxy({} as LocalStore, {
    get: (_, key: keyof LocalStore) => {
      const value = data.store[key]
      return typeof value === 'function' ? value.bind(data.store) : value
    },
  })
  return { store, useLocalQuery: (await import('@/test/local-query')).useLocalQueryFor(store) }
})

const USER = '11111111-1111-4111-8111-111111111111'
const at = (day: number, month: number, hours = 10, minutes = 0) => new Date(2026, month - 1, day, hours, minutes)
const PROFILE = { weightKg: 88, trainingDays: [1, 2, 4, 5], trainingTime: '21:00', wakeTime: '08:20', sleepTime: '01:00' }

async function setup(clock = at(9, 11)) {
  const { createDatabase } = await import('@/data/db')
  const { createLocalStore } = await import('@/data/store')
  data.clock = at(1, 11, 8)
  data.store = createLocalStore(createDatabase(`learn-ui-${crypto.randomUUID()}`), { userId: () => USER, now: () => data.clock })
  const { completeOnboarding } = await import('@/data/profile')
  await completeOnboarding(data.store, PROFILE, () => data.clock)
  data.clock = clock
  return data.store
}

/** Sot: rrathët me shikuesit e tyre. */
async function renderToday(entry = '/') {
  const { useLocalQuery, store } = await import('@/data/app-data')
  const { todayView } = await import('@/data/today')
  const { TodayStories } = await import('./today-stories')
  function Host() {
    const view = useLocalQuery(() => todayView(store), [])
    return view ? <TodayStories view={view} /> : null
  }
  const router = createMemoryRouter(
    [
      { path: '/', element: <Host /> },
      { path: '/progresi/meso', element: <p>Faqja Mëso</p> },
    ],
    { initialEntries: [entry] },
  )
  render(<RouterProvider router={router} />)
  return router
}

const seen = async (place: 'today' | 'rest' | 'food', date: string, factId: string) => {
  const { markFactSeen } = await import('@/data/learn')
  await markFactSeen(data.store, place, date, factId)
}

/** Faktet e para të javës 9–15 nëntor, si te bordet: Bench Press te Sot dhe te pushimi, tërshëra, gjumi, proteina. */
async function weekOfFacts() {
  await seen('today', '2026-11-09', 'bench-press-1')
  await seen('rest', '2026-11-09', 'bench-press-2')
  await seen('food', '2026-11-10', 'oatmeal-1')
  await seen('today', '2026-11-11', 'sleep-1')
  await seen('today', '2026-11-12', 'protein-1')
}

describe('kuizi i së dielës', () => {
  afterEach(async () => {
    cleanup()
    await act(() => language.set('sq'))
  })

  it('me më pak se 5 fakte rrethi i kuizit nuk del; e diela 20:30 me 5 fakte del "Kuizi"', async () => {
    await setup(at(15, 11, 20, 30))
    await seen('today', '2026-11-11', 'sleep-1')
    await renderToday()
    expect(await screen.findByRole('button', { name: 'Java jote, e re' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Kuizi/ })).not.toBeInTheDocument()
    cleanup()
    await weekOfFacts()
    await renderToday()
    expect(await screen.findByRole('button', { name: 'Kuizi, e re' })).toBeInTheDocument()
  })

  it('hyrja, 5 pyetjet me shpjegimin dhe "Tjetra", rezultati; ruhet me javën dhe rrethi bëhet i shikuar', async () => {
    await setup(at(15, 11, 20, 30))
    await weekOfFacts()
    const router = await renderToday()
    await userEvent.click(await screen.findByRole('button', { name: 'Kuizi, e re' }))
    expect(router.state.location.search).toBe('?fleta=kuizi')
    const story = await screen.findByRole('dialog', { name: 'Kuizi i javës' })
    expect(within(story).getByRole('heading', { name: 'Kuizi i javës' })).toBeInTheDocument()
    expect(within(story).getByText('5 pyetje nga ajo që pe këtë javë')).toBeInTheDocument()
    expect(within(story).getByText('Vargu i kuizit nis sot.')).toBeInTheDocument()
    expect(within(within(story).getByRole('list', { name: 'Temat e pyetjeve' })).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Bench Press', 'Tërshërë e gatuar', 'Gjumi', 'Proteina'])
    await userEvent.click(within(story).getByRole('button', { name: 'Fillo' }))

    const order = ['bench-press-1', 'bench-press-2', 'oatmeal-1', 'sleep-1', 'protein-1'].map((id) => factById(id)!)
    for (const [index, fact] of order.entries()) {
      const question = await within(story).findByRole('heading', { name: fact.quiz.question.sq })
      expect(question).toBeInTheDocument()
      expect(within(story).getByText(`${index + 1} / 5`)).toBeInTheDocument()
      expect(within(story).getByText('Prek një përgjigje')).toBeInTheDocument()
      expect(within(story).queryByRole('button', { name: 'Tjetra' })).not.toBeInTheDocument()
      // E treta gabim, të tjerat sakt.
      const pick = index === 2 ? (fact.quiz.correct + 1) % fact.quiz.options.length : fact.quiz.correct
      await userEvent.click(within(story).getByRole('button', { name: fact.quiz.options[pick].sq }))
      const answers = within(story).getByRole('group', { name: 'Përgjigjet' })
      expect(within(answers).getByRole('button', { name: `${fact.quiz.options[fact.quiz.correct].sq}, e saktë` })).toBeInTheDocument()
      if (index === 2) expect(within(answers).getByRole('button', { name: `${fact.quiz.options[pick].sq}, e gabuar` })).toBeInTheDocument()
      expect(within(story).getByRole('heading', { name: 'Pse' })).toBeInTheDocument()
      expect(within(story).getAllByText(fact.text.sq).length).toBeGreaterThan(0)
      await userEvent.click(within(story).getByRole('button', { name: 'Tjetra' }))
    }
    expect(await within(story).findByText('4 nga 5 të sakta · 9–15 nëntor')).toBeInTheDocument()
    expect(within(story).getByText('4/5')).toBeInTheDocument()
    expect(within(story).getByRole('heading', { name: '1 javë radhazi' })).toBeInTheDocument()
    expect(within(story).getByText('Edhe 3 javë për arritjen Kuizi 4 javë.')).toBeInTheDocument()
    const mistakes = within(story).getByRole('region', { name: 'Ku gabove' })
    expect(within(mistakes).getByRole('heading', { name: order[2].quiz.question.sq })).toBeInTheDocument()
    expect(within(mistakes).getByText(`E saktë: ${order[2].quiz.options[order[2].quiz.correct].sq}`)).toBeInTheDocument()
    const [row] = await data.store.where('learn_events', 'kind', 'quiz')
    expect(row).toMatchObject({ date: '2026-11-09', score: 4, closed_on: '2026-11-15' })
    await userEvent.click(within(story).getByRole('button', { name: 'Mbaro' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await screen.findByRole('button', { name: 'Kuizi' })).toBeInTheDocument()
  })

  it('anglisht: hyrja dhe pyetja e parë', async () => {
    await setup(at(15, 11, 20, 30))
    await weekOfFacts()
    await act(() => language.set('en'))
    await renderToday('/?fleta=kuizi')
    const story = await screen.findByRole('dialog', { name: 'Weekly quiz' })
    expect(within(story).getByText('5 questions from what you saw this week')).toBeInTheDocument()
    await userEvent.click(within(story).getByRole('button', { name: 'Start' }))
    const fact = factById('bench-press-1')!
    expect(await within(story).findByRole('heading', { name: fact.quiz.question.en })).toBeInTheDocument()
    expect(within(story).getByText('Tap an answer')).toBeInTheDocument()
    await userEvent.click(within(story).getByRole('button', { name: fact.quiz.options[fact.quiz.correct].en }))
    expect(within(story).getByRole('button', { name: `${fact.quiz.options[fact.quiz.correct].en}, correct` })).toBeInTheDocument()
    expect(within(story).getByRole('button', { name: 'Next' })).toBeInTheDocument()
  })
})
