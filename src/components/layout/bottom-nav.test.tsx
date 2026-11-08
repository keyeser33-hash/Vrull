import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { language } from '@/i18n/language'
import { appRoutes as routes } from '@/router'

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

describe('navigimi poshtë', () => {
  it('ka pesë vende me fjalë, në radhën e specifikimit', () => {
    renderAt('/')
    const nav = screen.getByRole('navigation', { name: 'Kryesore' })
    const labels = within(nav)
      .getAllByRole('link')
      .map((link) => link.textContent)
    expect(labels).toEqual(['Sot', 'Programi', 'Ushqimi', 'Progresi', 'Trupi'])
  })

  it('në anglisht ndërrohen menjëherë, me termat e SPEC §0.3a', () => {
    renderAt('/')
    act(() => language.set('en'))
    const nav = screen.getByRole('navigation', { name: 'Main' })
    const labels = within(nav)
      .getAllByRole('link')
      .map((link) => link.textContent)
    expect(labels).toEqual(['Today', 'Programme', 'Food', 'Progress', 'Body'])
    act(() => language.set('sq'))
    expect(within(nav).getAllByRole('link')[1]).toHaveTextContent('Programi')
  })

  it('shënon vetëm vendin aktiv me aria-current', () => {
    renderAt('/ushqimi')
    const nav = screen.getByRole('navigation', { name: 'Kryesore' })
    const current = within(nav).getAllByRole('link', { current: 'page' })
    expect(current).toHaveLength(1)
    expect(current[0]).toHaveTextContent('Ushqimi')
  })

  it('kalon nga një ekran te tjetri', async () => {
    renderAt('/')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Sot')
    await userEvent.click(screen.getByRole('link', { name: 'Trupi' }))
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Trupi')
  })

  it('çdo ekran ka një h1 të vetëm', () => {
    for (const path of ['/', '/programi', '/ushqimi', '/progresi', '/trupi', '/cilesimet']) {
      const { unmount } = render(
        <RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />,
      )
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
      unmount()
    }
  })
})
