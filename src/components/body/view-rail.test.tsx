import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { language } from '@/i18n'
import { ViewRail } from './view-rail'

describe('shina e këndeve të modelit 3D', () => {
  afterEach(() => language.set('sq'))

  it('katër kënde me radhën e bordit; i zgjedhuri thuhet, prekja kërkon këndin', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<ViewRail selected="front" onSelect={onSelect} />)
    const rail = screen.getByRole('radiogroup', { name: 'Këndi i pamjes' })
    const angles = screen.getAllByRole('radio')
    expect(rail).toContainElement(angles[0])
    // "3/4" lexohet me fjalë nga lexuesi i ekranit.
    expect(angles.map((angle) => angle.getAttribute('aria-label') ?? angle.textContent)).toEqual(['Para', 'Tre të katërtat', 'Anash', 'Mbrapa'])
    expect(angles.map((angle) => angle.textContent)).toEqual(['Para', '3/4', 'Anash', 'Mbrapa'])
    expect(angles.map((angle) => angle.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false', 'false'])
    await user.click(screen.getByRole('radio', { name: 'Mbrapa' }))
    expect(onSelect).toHaveBeenCalledWith('back')
    await user.click(screen.getByRole('radio', { name: 'Tre të katërtat' }))
    expect(onSelect).toHaveBeenLastCalledWith('threeQuarter')
  })

  it('mes dy këndeve (pas një zvarritjeje ose fokusi) asnjë nuk është i zgjedhur; anglisht', () => {
    language.set('en')
    render(<ViewRail selected={null} onSelect={() => {}} />)
    expect(screen.getByRole('radiogroup', { name: 'Viewing angle' })).toBeInTheDocument()
    const angles = screen.getAllByRole('radio')
    expect(angles.map((angle) => angle.textContent)).toEqual(['Front', '3/4', 'Side', 'Back'])
    expect(angles.every((angle) => angle.getAttribute('aria-checked') === 'false')).toBe(true)
    expect(screen.getByRole('radio', { name: 'Three-quarter view' })).toBeInTheDocument()
  })
})
