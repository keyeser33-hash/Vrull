import { render, screen } from '@testing-library/react'
import { Expand } from './expand'

// Rreshti → detaji (DESIGN.md › Lëvizja): hapet në vend në 250 ms ease-out, vetëm me `motion-safe:`; e
// mbyllur nuk lexohet dhe nuk merr fokusin.

const panel = () => screen.getByRole('button', { name: 'Brenda', hidden: true }).closest('.grid')!

describe('Expand', () => {
  it('e mbyllur: jashtë pemës së aksesueshmërisë dhe radhës së Tab-it, rreshti 0fr', () => {
    render(
      <Expand open={false}>
        <button type="button">Brenda</button>
      </Expand>,
    )
    expect(screen.queryByRole('button', { name: 'Brenda' })).toBeNull()
    expect(panel()).toHaveAttribute('inert')
    expect(panel()).toHaveAttribute('aria-hidden', 'true')
    expect(panel()).toHaveClass('invisible', 'grid-rows-[0fr]')
  })

  it('e hapur: 1fr, e lexueshme; tranzicioni 250 ms ease-out vetëm pa lëvizje të reduktuar', () => {
    render(
      <Expand open>
        <button type="button">Brenda</button>
      </Expand>,
    )
    expect(screen.getByRole('button', { name: 'Brenda' })).toBeInTheDocument()
    expect(panel()).not.toHaveAttribute('inert')
    expect(panel()).not.toHaveAttribute('aria-hidden')
    expect(panel()).toHaveClass('visible', 'grid-rows-[1fr]')
    const classes = panel().className.split(' ')
    expect(classes).toEqual(expect.arrayContaining(['motion-safe:transition-[grid-template-rows,visibility]', 'motion-safe:duration-250', 'motion-safe:ease-out']))
    expect(classes.filter((name) => /^(transition|duration|ease)/.test(name))).toEqual([])
  })
})
