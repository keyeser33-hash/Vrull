import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router'
import type { LocalStore } from '@/data/store'
import { language } from '@/i18n'

// "Mbyll ditën" (V70, V71) me store të vërtetë, të mërkurën 9 dhjetor në 21:30 (ditë pushimi, 80 kg, ngrihet 07:00):
// shtatë vakte, asnjëri i shënuar.
const data = vi.hoisted(() => ({ store: null as unknown as LocalStore }))
vi.mock('@/data/app-data', async () => {
  const { createDatabase } = await import('@/data/db')
  const { createLocalStore } = await import('@/data/store')
  const store = createLocalStore(createDatabase(`close-day-${crypto.randomUUID()}`), { userId: () => '11111111-1111-4111-8111-111111111111' })
  data.store = store
  return {
    store,
    useLocalQuery: (await import('@/test/local-query')).useLocalQueryFor(store),
  }
})

const TODAY = '2026-12-09'
const rows = async (meal: string) => (await data.store.where('diary_entries', 'date', TODAY)).filter((row) => !row.deleted_at && row.meal === meal)

function Probe() {
  const location = useLocation()
  return <p data-testid="where">{`${location.pathname}${location.search}`}</p>
}

describe('Mbyll ditën', () => {
  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-12-09T21:30:00'))
    await import('@/data/app-data')
    const { completeOnboarding } = await import('@/data/profile')
    await completeOnboarding(data.store, { weightKg: 80, trainingDays: [1, 2, 4, 5], trainingTime: '18:00', wakeTime: '07:00', sleepTime: '23:00' })
  })
  afterAll(() => vi.useRealTimers())
  afterEach(() => language.set('sq'))

  async function renderPage(entry = '/ushqimi/mbyll') {
    const { CloseDayPage } = await import('./close-day')
    const router = createMemoryRouter(
      [
        { path: '/ushqimi/mbyll', element: <CloseDayPage /> },
        { path: '/ushqimi', element: <Probe /> },
        { path: '/ushqimi/shto/:meal', element: <Probe /> },
      ],
      { initialEntries: [entry] },
    )
    render(<RouterProvider router={router} />)
    // Kreu del që te skeleti: prit vaktet.
    await screen.findAllByRole('listitem')
    return router
  }
  const card = (name: string) => screen.getByRole('heading', { name }).closest('li') as HTMLElement

  it('tregon çdo vakt të ditës me katër veprimet dhe sa mbeten', async () => {
    await renderPage()
    expect(screen.getAllByRole('listitem')).toHaveLength(7)
    const lunch = within(card('Dreka'))
    expect(lunch.getByText('Pa shënuar')).toBeInTheDocument()
    expect(lunch.getByRole('button', { name: 'Si në plan: Dreka' })).toBeEnabled()
    // Dje nuk ka asgjë: "Si dje" është i fikur.
    expect(lunch.getByRole('button', { name: 'Si dje: Dreka' })).toBeDisabled()
    expect(lunch.getByRole('link', { name: 'Tjetër: Dreka' })).toHaveAttribute('href', '/ushqimi/shto/lunch')
    expect(lunch.getByRole('button', { name: 'E kapërceva: Dreka' })).toBeEnabled()
    expect(screen.getByRole('status')).toHaveTextContent('Mbeten edhe 7 vakte')
    expect(screen.getByText('0 nga 7')).toBeInTheDocument()
  })

  it('"Si në plan" e regjistron vaktin dhe "E kapërceva" e mbyll pa ushqim', async () => {
    const user = userEvent.setup()
    await renderPage()
    await user.click(within(card('Dreka')).getByRole('button', { name: 'Si në plan: Dreka' }))
    await waitFor(async () => expect((await rows('lunch')).length).toBeGreaterThan(0))
    await waitFor(() => expect(within(card('Dreka')).getByRole('link', { name: 'Ndrysho: Dreka' })).toBeInTheDocument())
    expect(within(card('Dreka')).getByText(/kcal · \d+ g proteinë/)).toBeInTheDocument()

    await user.click(within(card('Darka')).getByRole('button', { name: 'E kapërceva: Darka' }))
    await waitFor(() => expect(within(card('Darka')).getByRole('button', { name: 'Hape sërish: Darka' })).toBeInTheDocument())
    expect(await rows('dinner')).toHaveLength(0)
    expect(screen.getByText('2 nga 7')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Mbeten edhe 5 vakte')

    // Hapet sërish.
    await user.click(within(card('Darka')).getByRole('button', { name: 'Hape sërish: Darka' }))
    await waitFor(() => expect(within(card('Darka')).getByText('Pa shënuar')).toBeInTheDocument())
  })

  it('në anglisht, dhe "U krye" kthen te Ushqimi', async () => {
    language.set('en')
    const user = userEvent.setup()
    const { CloseDayPage } = await import('./close-day')
    const router = createMemoryRouter(
      [
        { path: '/ushqimi/mbyll', element: <CloseDayPage /> },
        { path: '/ushqimi', element: <Probe /> },
      ],
      { initialEntries: ['/ushqimi/mbyll'] },
    )
    render(<RouterProvider router={router} />)
    expect(await screen.findByRole('heading', { name: 'Close the day' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Skipped it: Dinner' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(await screen.findByTestId('where')).toHaveTextContent('/ushqimi')
  })

  it('me ?data= të djeshme mbyll ditën e djeshme, pa "Tjetër"; një datë më e vjetër bie te sot', async () => {
    const user = userEvent.setup()
    await renderPage('/ushqimi/mbyll?data=2026-12-08')
    expect(screen.getByRole('heading', { name: 'Mbyll dje' })).toBeInTheDocument()
    const lunch = within(card('Dreka'))
    expect(lunch.queryByRole('link', { name: 'Tjetër: Dreka' })).not.toBeInTheDocument()
    await user.click(lunch.getByRole('button', { name: 'E kapërceva: Dreka' }))
    await waitFor(() => expect(within(card('Dreka')).getByRole('button', { name: 'Hape sërish: Dreka' })).toBeInTheDocument())
    const { readSchedule, skippedOn } = await import('@/data/schedule-settings')
    expect(skippedOn((await readSchedule(data.store)).plan, '2026-12-08')).toContain('lunch')
  })

  it('një datë më e vjetër se dje bie te sot', async () => {
    await renderPage('/ushqimi/mbyll?data=2026-12-01')
    expect(screen.getByRole('heading', { name: 'Mbyll ditën' })).toBeInTheDocument()
  })
})
