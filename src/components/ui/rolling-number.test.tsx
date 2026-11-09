import { act, render, screen } from '@testing-library/react'
import { i18nFor, language } from '@/i18n'
import { RollingNumber } from './rolling-number'

// Numri që rrotullohet (E2-23): teksti është ai i `fmt`, vetëm shifrat që ndryshojnë marrin kolonën që
// rrotullohet (shifra e vjetër vetëm te `data-from`, jo tekst), 40 ms njëra pas tjetrës nga e majta.
// Lëvizja e reduktuar jeton te globals.css (src/styles/motion.test.ts).

const sq = i18nFor('sq').fmt
const rolled = (root: Element) =>
  [...root.querySelectorAll<HTMLElement>('.roll-digit')].map((digit) => [digit.textContent, digit.dataset.from, digit.style.getPropertyValue('--roll-i'), digit.dataset.dir])

describe('RollingNumber', () => {
  afterEach(() => language.set('sq'))

  it('teksti është ai i fmt; para ndryshimit të parë asgjë nuk rrotullohet', () => {
    const { container } = render(<RollingNumber value={1380} className="type-display-xl" />)
    const root = container.firstElementChild!
    expect(root.textContent).toBe(sq.number(1380))
    expect(root).toHaveClass('type-display-xl', 'tabular-nums')
    expect(root.querySelector('.roll-digit')).toBeNull()
  })

  it('vetëm shifrat që ndryshuan rrotullohen, 40 ms njëra pas tjetrës; të njëjtat rrinë', () => {
    const { container, rerender } = render(<RollingNumber value={1640} />)
    rerender(<RollingNumber value={2110} />)
    const root = container.firstElementChild!
    expect(root.textContent).toBe(sq.number(2110))
    expect(rolled(root)).toEqual([
      ['2', '1', '0', 'up'],
      ['1', '6', '1', 'up'],
      ['1', '4', '2', 'up'],
    ])
    // Një ndryshim tjetër rindërton kolonat: krahasohet me vlerën e mëparshme, jo me të parën.
    rerender(<RollingNumber value={2115} />)
    expect(root.textContent).toBe(sq.number(2115))
    expect(rolled(root)).toEqual([['5', '0', '0', 'up']])
  })

  it('zbritja rrotullohet poshtë; shifrat e reja hyjnë nga bosh, krahasuar nga e djathta', () => {
    const { container, rerender } = render(<RollingNumber value={1020} />)
    rerender(<RollingNumber value={980} />)
    const root = container.firstElementChild!
    expect(root.textContent).toBe('980')
    expect(rolled(root)).toEqual([
      ['9', '0', '0', 'down'],
      ['8', '2', '1', 'down'],
    ])
    rerender(<RollingNumber value={1020} />)
    expect(root.textContent).toBe(sq.number(1020))
    expect(rolled(root)).toEqual([
      ['1', '', '0', 'up'],
      ['0', '9', '1', 'up'],
      ['2', '8', '2', 'up'],
    ])
  })

  it('lexuesi i ekranit merr vetëm vlerën e fundit: shifrat e vjetra nuk janë tekst', () => {
    const { rerender } = render(
      <button type="button">
        <RollingNumber value={495} />
      </button>,
    )
    rerender(
      <button type="button">
        <RollingNumber value={874} />
      </button>,
    )
    const button = screen.getByRole('button', { name: '874' })
    expect(button.textContent).toBe('874')
    expect(button.querySelectorAll('[aria-hidden]')).toHaveLength(0)
  })

  it('në anglisht me presjen e mijësheve; ndërrimi i gjuhës nuk rrotullon shifrat e njëjta', () => {
    const format = (value: number) => i18nFor(language.get()).fmt.number(value)
    const { container } = render(<RollingNumber value={3037} />)
    const root = container.firstElementChild!
    act(() => language.set('en'))
    expect(root.textContent).toBe('3,037')
    expect(root.querySelector('.roll-digit')).toBeNull()
    const custom = render(<RollingNumber value={62.5} format={(value) => `${format(value)} kg`} />)
    expect(custom.container.firstElementChild!.textContent).toBe('62.5 kg')
  })
})
