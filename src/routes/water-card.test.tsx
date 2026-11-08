import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { LocalStore } from '@/data/store'
import { language } from '@/i18n'

// Uji te Sot (V2-E2-07): 88 kg, e hënë (ditë stërvitjeje): objektivi 3,5 L = 14 gota.
const data = vi.hoisted(() => ({ store: null as unknown as LocalStore }))
vi.mock('@/data/app-data', async () => {
  const { createDatabase } = await import('@/data/db')
  const { createLocalStore } = await import('@/data/store')
  const store = createLocalStore(createDatabase(`water-ui-${crypto.randomUUID()}`), { userId: () => '11111111-1111-4111-8111-111111111111' })
  data.store = store
  return { store, useLocalQuery: (await import('@/test/local-query')).useLocalQueryFor(store) }
})

describe('Uji te Sot', () => {
  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-12-07T10:00:00'))
    await import('@/data/app-data')
    const { completeOnboarding } = await import('@/data/profile')
    await completeOnboarding(data.store, { weightKg: 88, trainingDays: [1, 2, 4, 5], trainingTime: '21:00', wakeTime: '08:20', sleepTime: '01:00' })
  })
  afterAll(() => vi.useRealTimers())
  afterEach(() => language.set('sq'))

  async function renderCard(date: string, training: boolean) {
    const { WaterCard } = await import('./water-card')
    render(<WaterCard date={date} training={training} />)
  }

  it('një prekje shton një gotë; "Kthe mbrapsht" e heq', async () => {
    const user = userEvent.setup()
    await renderCard('2026-12-07', true)
    expect(await screen.findByText('0,0 nga 3,5 L')).toBeInTheDocument()
    expect(screen.getByRole('list', { name: '0 gota nga 14' })).toBeInTheDocument()
    expect(screen.getByText('Ditë stërvitjeje: +0,5 L')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Shto një gotë ujë, 250 ml' }))
    expect(await screen.findByText('0,25 nga 3,5 L')).toBeInTheDocument()
    expect(screen.getByRole('list', { name: '1 gotë nga 14' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('U shtua një gotë · 0,25 L')

    await user.click(screen.getByRole('button', { name: 'Kthe mbrapsht' }))
    expect(await screen.findByText('0,0 nga 3,5 L')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('në anglisht, ditë pushimi', async () => {
    language.set('en')
    await renderCard('2026-12-09', false)
    expect(await screen.findByText('0.0 of 3.0 L')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add a glass of water, 250 ml' })).toHaveTextContent('Glass, 250 ml')
    expect(screen.queryByText(/Training day/)).not.toBeInTheDocument()
  })
})
