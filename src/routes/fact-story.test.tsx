import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { LocalStore } from '@/data/store'
import { language } from '@/i18n/language'
import { factById } from '@/learn/facts'

// "A e dije?" te Sot si story (V57, SPEC §0.3e, §0.3f; bordet "Sot · Stories", "Story · A e dije?"), me app-in e vërtetë
// mbi një bazë lokale prove. Shortcut to Size nga e hëna 2 nëntor 2026, ditët e stërvitjes e hënë, e martë, e enjte,
// e premte.
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

const factRows = async () => (await data.store.where('learn_events', 'kind', 'fact')).filter((row) => !row.deleted_at)

describe('"A e dije?" te Sot si story', () => {
  afterEach(async () => {
    cleanup()
    await act(() => language.set('sq'))
  })

  it('rrethi pas "Si ndihesh?"; story me temën, faktin, burimin dhe "Më shumë" që hap shpjegimin dhe lidhjen', async () => {
    await setup()
    const router = await renderToday()
    const ring = await screen.findByRole('button', { name: 'A e dije?, e re' })
    const names = within(screen.getByRole('list', { name: 'Rrathët e ditës' })).getAllByRole('button').map((button) => button.getAttribute('aria-label'))
    // E hëna: "Java jote" e javës së kaluar vjen para "A e dije?" (bordi "Sot · E diela").
    expect(names).toEqual(['Si ndihesh?, e re', 'Java jote, e re', 'A e dije?, e re'])
    await userEvent.click(ring)
    expect(router.state.location.search).toBe('?fleta=fakti')
    const story = await screen.findByRole('dialog', { name: 'A e dije?' })
    const fact = factById('bench-press-1')!
    expect(within(story).getByText('Bench Press')).toBeInTheDocument()
    expect(within(story).getByText(fact.text.sq)).toBeInTheDocument()
    expect(within(story).getByText(`Burimi: ${fact.source.label} · ${fact.source.title}`)).toBeInTheDocument()
    // Fakti shënohet i parë kur story hapet.
    await waitFor(async () => expect((await factRows()).map((row) => [row.date, row.place, row.fact_id])).toEqual([['2026-11-09', 'today', 'bench-press-1']]))
    await userEvent.click(within(story).getByRole('button', { name: 'Më shumë' }))
    expect(within(story).getByText(fact.more!.sq)).toBeInTheDocument()
    expect(within(story).getByRole('link', { name: `Hap burimin: ${fact.source.label}` })).toHaveAttribute('href', fact.source.url)
    await userEvent.click(within(story).getByRole('button', { name: 'Mbyll' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await screen.findByRole('button', { name: 'A e dije?' })).toBeInTheDocument()
  })

  it('ditë pushimi: fakt rikuperimi; me çelësin e fikur rrethi nuk del', async () => {
    await setup(at(11, 11))
    await renderToday()
    await userEvent.click(await screen.findByRole('button', { name: 'A e dije?, e re' }))
    const story = await screen.findByRole('dialog', { name: 'A e dije?' })
    expect(within(story).getByText('Pushimi mes seteve')).toBeInTheDocument()
    expect(within(story).getByText(factById('rest-1')!.text.sq)).toBeInTheDocument()
    cleanup()
    const { setFactsEnabled } = await import('@/data/learn')
    await setFactsEnabled(data.store, false)
    await renderToday()
    expect(await screen.findByRole('button', { name: 'Si ndihesh?, e re' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^A e dije\?/ })).not.toBeInTheDocument()
  })

  it('anglisht', async () => {
    await setup()
    await act(() => language.set('en'))
    await renderToday()
    await userEvent.click(await screen.findByRole('button', { name: 'Did you know?, new' }))
    const story = await screen.findByRole('dialog', { name: 'Did you know?' })
    const fact = factById('bench-press-1')!
    expect(within(story).getByText(fact.text.en)).toBeInTheDocument()
    expect(within(story).getByText(`Source: ${fact.source.label.replace(' dhe kolegët', ' and colleagues')} · ${fact.source.title}`)).toBeInTheDocument()
    await userEvent.click(within(story).getByRole('button', { name: 'Learn more' }))
    expect(within(story).getByText(fact.more!.en)).toBeInTheDocument()
  })
})
