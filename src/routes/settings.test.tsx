import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import pkg from '../../package.json'
import { routes } from '@/router'

function renderSettings() {
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/cilesimet'] })} />)
}

describe('cilësimet', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.className = 'dark oled'
  })

  it('tregon OLED të zgjedhur si parazgjedhje', () => {
    renderSettings()
    expect(screen.getByRole('radio', { name: 'OLED' })).toBeChecked()
  })

  it('ndërron temën dhe e ruan', async () => {
    renderSettings()
    await userEvent.click(screen.getByRole('radio', { name: 'E çelët' }))
    expect(document.documentElement.className).toBe('')
    expect(window.localStorage.getItem('th-theme')).toBe('light')

    await userEvent.click(screen.getByRole('radio', { name: 'E errët' }))
    expect(document.documentElement.className).toBe('dark')
  })

  it('tregon versionin nga package.json', () => {
    renderSettings()
    expect(screen.getByText(`Training Hub ${pkg.version}`)).toBeInTheDocument()
  })
})
