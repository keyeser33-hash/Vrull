import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { LocalStore } from '@/data/store'
import { language } from '@/i18n/language'
import { factById } from '@/learn/facts'

// Faqja Mëso (Progresi › Mëso; V56, SPEC §0.3e, bordi "Progresi › Mëso"), me app-in e vërtetë mbi një bazë lokale
// prove: faktet e para me kërkimin, kuizi i hapur, kuizet e kaluara dhe vargu, gjendja bosh.
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

async function renderLearn(entry = '/progresi/meso') {
  const { LearnPage } = await import('./learn')
  const router = createMemoryRouter([{ path: '/progresi/meso', element: <LearnPage /> }], { initialEntries: [entry] })
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

describe('faqja Mëso', () => {
  afterEach(async () => {
    cleanup()
    await act(() => language.set('sq'))
  })

  it('bosh: tregon ku dalin faktet', async () => {
    await setup()
    await renderLearn()
    expect(await screen.findByRole('heading', { name: 'Ende pa fakte' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Mëso' })).toBeInTheDocument()
    expect(screen.getByText('0 fakte të parë')).toBeInTheDocument()
    expect(screen.getByText('Gjatë pushimit')).toBeInTheDocument()
  })

  it('faktet më të rejat sipër me burimin; kërkimi te teksti dhe emri; kuizi i hapur dhe kuizet e kaluara', async () => {
    await setup(at(15, 11, 20, 30))
    await weekOfFacts()
    await renderLearn()
    const list = await screen.findByRole('region', { name: 'Faktet që ke parë' })
    const items = within(list).getAllByRole('listitem')
    expect(items.map((item) => item.firstElementChild?.textContent)).toEqual([
      '12 nëntorSot · Proteina',
      '11 nëntorSot · Gjumi',
      '10 nëntorUshqimi · Tërshërë e gatuar',
      '9 nëntorPushimi · Bench Press',
      '9 nëntorSot · Bench Press',
    ])
    expect(screen.getByText('5 fakte të parë')).toBeInTheDocument()
    const source = factById('oatmeal-1')!.source
    expect(within(items[2]).getByRole('link', { name: `Hap burimin: ${source.label}` })).toHaveAttribute('href', source.url)
    // Kërkimi: emri i ushtrimit, pa shenjat e shkronjave.
    await userEvent.type(screen.getByRole('searchbox', { name: 'Kërko te faktet' }), 'bench')
    expect(within(list).getAllByRole('listitem')).toHaveLength(2)
    await userEvent.clear(screen.getByRole('searchbox', { name: 'Kërko te faktet' }))
    await userEvent.type(screen.getByRole('searchbox', { name: 'Kërko te faktet' }), 'tershere')
    expect(within(list).getAllByRole('listitem').map((item) => item.firstElementChild?.textContent)).toEqual(['10 nëntorUshqimi · Tërshërë e gatuar'])
    await userEvent.clear(screen.getByRole('searchbox', { name: 'Kërko te faktet' }))
    await userEvent.type(screen.getByRole('searchbox', { name: 'Kërko te faktet' }), 'zzz')
    expect(within(list).getByText('Asnjë fakt për "zzz".')).toBeInTheDocument()
    // Kuizi i javës del te faqja në të njëjtën kohë.
    await userEvent.clear(screen.getByRole('searchbox', { name: 'Kërko te faktet' }))
    expect(screen.getByRole('heading', { name: '5 pyetje nga java jote' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Fillo kuizin' }))
    expect(await screen.findByRole('dialog', { name: 'Kuizi i javës' })).toBeInTheDocument()
  })

  it('kuizet e kaluara me rezultatin dhe vargu; anglisht', async () => {
    await setup(at(15, 11, 20, 30))
    await weekOfFacts()
    const { quizView, saveQuiz } = await import('@/data/learn')
    const view = (await quizView(data.store))!
    await saveQuiz(data.store, view.monday, view.facts!, view.facts!.map((fact) => fact.quiz.correct))
    await act(() => language.set('en'))
    await renderLearn()
    const quizzes = await screen.findByRole('region', { name: 'Past quizzes' })
    expect(within(quizzes).getByRole('listitem', { name: '9–15 November: 5 of 5, 15 November' })).toBeInTheDocument()
    const streak = screen.getByRole('region', { name: 'Quiz streak' })
    expect(within(streak).getByText('1')).toBeInTheDocument()
    expect(within(streak).getByText('week in a row')).toBeInTheDocument()
    expect(within(streak).getByText('3 more weeks to the Quiz 4 weeks achievement.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Learn' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Start the quiz' })).not.toBeInTheDocument()
  })
})
