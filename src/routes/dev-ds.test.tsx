import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { DesignSystemPage } from './dev-ds'

function renderPage() {
  const router = createMemoryRouter([{ path: '/dev/ds', element: <DesignSystemPage /> }], { initialEntries: ['/dev/ds'] })
  return render(<RouterProvider router={router} />)
}

const theme = (name: string) => screen.getByRole('region', { name })

describe('faqja e brendshme e sistemit Vrull', () => {
  it('tregon komponentët në OLED, Natë dhe Ditë, secila me temën e vet', () => {
    renderPage()
    const sections = ['OLED', 'Natë', 'Ditë'].map(theme)
    expect(sections.map((section) => section.getAttribute('data-theme'))).toEqual(['oled', 'dark', 'light'])
    for (const section of sections) {
      const inside = within(section)
      expect(inside.getByRole('button', { name: 'Ruaj setin' })).toHaveClass('bg-ember', 'h-button-l')
      expect(inside.getByRole('group', { name: 'Seti 1: 62,5 kg, 9 përsëritje' })).toBeInTheDocument()
      expect(inside.getByRole('group', { name: 'Sa të kishin mbetur (RIR)' })).toBeInTheDocument()
      expect(inside.getByRole('group', { name: 'Proteina 96 nga 180 gramë' })).toBeInTheDocument()
      expect(inside.getByRole('list', { name: 'Java' })).toBeInTheDocument()
      expect(inside.getByRole('region', { name: 'A e dije?' })).toBeInTheDocument()
      expect(inside.getAllByRole('form', { name: 'Shto shpejt' })).toHaveLength(2)
      expect(inside.getByRole('navigation', { name: 'Navigimi' })).toBeInTheDocument()
      expect(inside.getByRole('link', { name: 'Sot' })).toHaveAttribute('aria-current', 'page')
    }
  })

  it('çdo temë ka gjendjen e vet: stepper-i i njërës nuk ndryshon tjetrën', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(within(theme('Ditë')).getByRole('button', { name: 'Rrit peshën me 2,5 kg' }))
    expect(within(theme('Ditë')).getByRole('group', { name: 'Seti 1: 65 kg, 9 përsëritje' })).toBeInTheDocument()
    expect(within(theme('OLED')).getByRole('group', { name: 'Seti 1: 62,5 kg, 9 përsëritje' })).toBeInTheDocument()
  })

  it('çdo gjë që preket ka të paktën 44 px', () => {
    const { container } = renderPage()
    // Pa layout në jsdom, kontrollohen klasat e madhësisë; prova në shfletues (scripts/ds-screens.mjs) mat pikselët.
    const touch = /(?:^|\s)(?:h|size|min-h)-(?:touch|button|button-l|row|12)(?:\s|$)/
    // Emri i ListRow-it e shtrin prekjen te i gjithë rreshti (::after mbi <li> 56 px).
    const stretched = (element: Element) => element.className.includes('after:inset-0') && touch.test(element.closest('li')?.className ?? '')
    const small = [...container.querySelectorAll('button, a, input')].filter((element) => !touch.test(element.className) && !stretched(element))
    expect(small.map((element) => element.outerHTML.slice(0, 120))).toEqual([])
  })

  it('teksti është në sentence case: shkronjat e mëdha vijnë nga stilet', () => {
    renderPage()
    expect(within(theme('OLED')).getByRole('button', { name: 'Fillo stërvitjen' })).toHaveClass('uppercase')
    expect(screen.queryByText(/^[A-ZËÇ ]{6,}$/)).toBeNull()
  })
})
