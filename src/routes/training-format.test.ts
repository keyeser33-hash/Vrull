import { clock } from './training-format'

describe('tekstet e stërvitjes', () => {
  it('ora e timer-it dhe e seancës', () => {
    expect(clock(90)).toBe('1:30')
    expect(clock(5)).toBe('0:05')
    expect(clock(18 * 60 + 42)).toBe('18:42')
    expect(clock(3723)).toBe('1:02:03')
  })
})
