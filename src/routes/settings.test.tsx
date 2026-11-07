import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import pkg from '../../package.json'
import { appRoutes as routes } from '@/router'

const share = vi.hoisted(() => ({ shareExport: vi.fn(async () => true) }))
vi.mock('@/data/share-export', () => share)

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

  it('tregon gjendjen e sinkronizimit me fjalë', () => {
    renderSettings()
    expect(screen.getByRole('heading', { name: 'Të dhënat' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Ende pa sinkronizim')
  })

  it('eksporton të dhënat me një prekje', async () => {
    renderSettings()
    await userEvent.click(screen.getByRole('button', { name: 'Eksporto të dhënat' }))
    expect(share.shareExport).toHaveBeenCalledOnce()
    expect(await screen.findByRole('button', { name: 'Eksporto të dhënat' })).toBeEnabled()
  })

  it('kur eksporti dështon, e thotë me fjalë', async () => {
    share.shareExport.mockRejectedValueOnce(new Error('disk'))
    renderSettings()
    await userEvent.click(screen.getByRole('button', { name: 'Eksporto të dhënat' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Eksporti nuk u krye. Provo përsëri.')
  })
})
