import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { language } from '@/i18n/language'
import { background } from '@/lib/background'
import { appRoutes as routes } from '@/router'

// Korniza e Vrullit (V2-E1-05): pesë tab-et, butoni i profilit te kreu, pa tab-bar te cilësimet dhe
// editorët, sfondi dhe gjendja pa internet. Ekranet e vërteta me bazën lokale bosh.
function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const view = render(<RouterProvider router={router} />)
  return { router, ...view }
}

const nav = () => screen.queryByRole('navigation', { name: language.get() === 'en' ? 'Main' : 'Kryesore' })

function setOnline(online: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => online })
  act(() => {
    window.dispatchEvent(new Event(online ? 'online' : 'offline'))
  })
}

describe('korniza', () => {
  afterEach(() => {
    act(() => language.set('sq'))
    act(() => background.set('solid'))
    setOnline(true)
  })

  it('pesë tab-et me fjalë, në radhën e specifikimit', () => {
    renderAt('/')
    const labels = within(nav()!).getAllByRole('link').map((link) => link.textContent)
    expect(labels).toEqual(['Sot', 'Programi', 'Ushqimi', 'Progresi', 'Miqtë'])
  })

  it('në anglisht ndërrohen menjëherë, me termat e SPEC §0.3a', () => {
    renderAt('/')
    act(() => language.set('en'))
    const labels = within(nav()!).getAllByRole('link').map((link) => link.textContent)
    expect(labels).toEqual(['Today', 'Programme', 'Food', 'Progress', 'Friends'])
  })

  it.each([
    ['/', 'Sot'],
    ['/programi', 'Programi'],
    ['/ushtrimi/abc', 'Programi'],
    ['/programet', 'Programi'],
    ['/ushqimi', 'Ushqimi'],
    ['/progresi', 'Progresi'],
    ['/progresi/trupi', 'Progresi'],
    ['/progresi/weight_kg', 'Progresi'],
    ['/miqte', 'Miqtë'],
  ])('%s: vetëm tab-i %s është aktiv', (path, tab) => {
    renderAt(path)
    const current = within(nav()!).getAllByRole('link', { current: 'page' })
    expect(current).toHaveLength(1)
    expect(current[0]).toHaveTextContent(tab)
  })

  it.each(['/cilesimet', '/cilesimet/pamja', '/cilesimet/rikujtuesit', '/programi/editori/p1', '/ushqimi/shto/lunch', '/progresi/matja'])(
    '%s: pa tab-bar (cilësimet dhe editorët)',
    (path) => {
      renderAt(path)
      expect(nav()).toBeNull()
    },
  )

  it('Trupi ka kaluar brenda Progresit: /trupi çon te /progresi/trupi', async () => {
    const { router } = renderAt('/trupi')
    // Ekrani ngarkohet kur hapet (router.tsx): adresa ndërrohet kur Trupi është gati.
    expect(await screen.findByRole('heading', { level: 1, name: 'Progresi' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/progresi/trupi')
  })

  it('kalon nga një tab te tjetri', async () => {
    renderAt('/')
    await userEvent.click(within(nav()!).getByRole('link', { name: 'Miqtë' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Miqtë' })).toBeInTheDocument()
  })

  it.each(['/', '/programi', '/ushqimi', '/progresi', '/miqte'])('%s: një h1 i vetëm dhe butoni "Profili dhe cilësimet" (44 px) te kreu', async (path) => {
    const { unmount } = renderAt(path)
    const profile = await screen.findByRole('link', { name: 'Profili dhe cilësimet' })
    expect(profile).toHaveAttribute('href', '/cilesimet')
    expect(profile.className).toMatch(/size-touch/)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    unmount()
  })

  it('pa internet: rripi sipër e thotë me fjalë, dhe ikën kur kthehet rrjeti', () => {
    renderAt('/progresi')
    expect(screen.queryByText('Pa internet')).toBeNull()
    setOnline(false)
    expect(screen.getByRole('status', { name: 'Pa internet' })).toHaveTextContent('Pa internet · Ndryshimet ruhen në telefon')
    setOnline(true)
    expect(screen.queryByText('Pa internet')).toBeNull()
  })

  it('sfondi "Vija shpejtësie" vizatohet pas përmbajtjes; "I plotë" jo', () => {
    const { container } = renderAt('/')
    expect(container.querySelector('[data-background="speed_lines"]')).toBeNull()
    act(() => background.set('speed_lines'))
    const layer = container.querySelector('[data-background="speed_lines"]')
    expect(layer).toHaveAttribute('aria-hidden', 'true')
    expect(layer?.className).toMatch(/bg-speed-lines/)
  })
})
