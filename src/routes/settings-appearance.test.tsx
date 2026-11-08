import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { LocalStore } from '@/data/store'
import { language } from '@/i18n/language'
import { background } from '@/lib/background'

// Pamja (bordi "Pamja", V2-E1-05): tema me id-të e v1, sfondi i ri i sinkronizuar dhe gjuha.
const data = vi.hoisted(() => ({ store: null as unknown as LocalStore }))
vi.mock('@/data/app-data', async () => {
  const { createDatabase } = await import('@/data/db')
  const { createLocalStore } = await import('@/data/store')
  data.store = createLocalStore(createDatabase(`appearance-${crypto.randomUUID()}`), { userId: () => '11111111-1111-4111-8111-111111111111' })
  return { store: data.store }
})

async function renderAppearance() {
  const { AppearancePage } = await import('./settings-appearance')
  const router = createMemoryRouter(
    [
      { path: '/cilesimet', element: <h1>Cilësimet</h1> },
      { path: '/cilesimet/pamja', element: <AppearancePage /> },
    ],
    { initialEntries: ['/cilesimet/pamja'] },
  )
  render(<RouterProvider router={router} />)
  return router
}

describe('Pamja', () => {
  beforeAll(async () => {
    await import('@/data/app-data')
    const { completeOnboarding } = await import('@/data/profile')
    await completeOnboarding(data.store, { weightKg: 80, trainingDays: [1, 2, 4, 5], trainingTime: '18:00', wakeTime: '07:00', sleepTime: '23:00' })
  })
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.className = 'dark oled'
  })
  afterEach(() => {
    act(() => language.set('sq'))
    act(() => background.set('solid'))
  })

  it('tema: tri zgjedhje me id-të e v1 dhe parapamje në vetë temën; ndërrohet menjëherë dhe ruhet', async () => {
    const user = userEvent.setup()
    await renderAppearance()
    const themes = screen.getByRole('radiogroup', { name: 'Tema' })
    const radios = within(themes).getAllByRole('radio')
    expect(radios.map((radio) => [radio.getAttribute('aria-label'), radio.getAttribute('value')])).toEqual([
      ['OLED', 'oled'],
      ['Natë', 'dark'],
      ['Ditë', 'light'],
    ])
    expect(within(themes).getByRole('radio', { name: 'OLED' })).toBeChecked()
    expect([...themes.querySelectorAll('[data-theme]')].map((preview) => preview.getAttribute('data-theme'))).toEqual(['oled', 'dark', 'light'])
    await user.click(within(themes).getByRole('radio', { name: 'Ditë' }))
    expect(document.documentElement.className).toBe('')
    expect(window.localStorage.getItem('th-theme')).toBe('light')
    expect(within(themes).getByRole('radio', { name: 'Ditë' })).toBeChecked()
    await user.click(within(themes).getByRole('radio', { name: 'Natë' }))
    expect(document.documentElement.className).toBe('dark')
    expect(window.localStorage.getItem('th-theme')).toBe('dark')
  })

  it('sfondi: "I plotë" ose "Vija shpejtësie", ruhet në telefon dhe te cilësimet e sinkronizuara', async () => {
    const user = userEvent.setup()
    await renderAppearance()
    const backgrounds = screen.getByRole('radiogroup', { name: 'Sfondi' })
    expect(within(backgrounds).getByRole('radio', { name: 'I plotë' })).toBeChecked()
    await user.click(within(backgrounds).getByRole('radio', { name: 'Vija shpejtësie' }))
    // Rreshti shkruhet para ndërrimit në telefon (data/background.ts).
    await waitFor(() => expect(background.get()).toBe('speed_lines'))
    expect(within(backgrounds).getByRole('radio', { name: 'Vija shpejtësie' })).toBeChecked()
    expect(window.localStorage.getItem('th-background')).toBe('speed_lines')
    expect((await data.store.all('user_settings'))[0].background).toBe('speed_lines')
  })

  it('gjuha: ndërrohet menjëherë, pa rinisje, dhe ruhet te cilësimet e sinkronizuara', async () => {
    const user = userEvent.setup()
    await renderAppearance()
    expect(screen.getByRole('button', { name: 'Shqip', pressed: true })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('lang', 'en-GB')
    await user.click(screen.getByRole('button', { name: 'English' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Appearance' })).toBeInTheDocument()
    expect(screen.getByRole('radiogroup', { name: 'Theme' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Speed lines' })).toBeInTheDocument()
    expect(screen.getByText('Exercise names stay in English.')).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('en-GB')
    expect((await data.store.all('user_settings'))[0].language).toBe('en')
    await user.click(screen.getByRole('button', { name: 'Shqip' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Pamja' })).toBeInTheDocument()
  })

  it('"Pamja ndjek gjendjen" mungon deri te gjendja e ditës (Etapa 3); mbrapa te Cilësimet', async () => {
    const user = userEvent.setup()
    const router = await renderAppearance()
    expect(screen.queryByText(/ndjek gjendjen/)).toBeNull()
    expect(screen.queryByRole('switch')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Mbrapa te Cilësimet' }))
    expect(router.state.location.pathname).toBe('/cilesimet')
  })
})
