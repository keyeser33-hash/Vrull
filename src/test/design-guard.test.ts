// @vitest-environment node
import { findViolations } from '../../scripts/check-design.mjs'

describe('rregullat e Omal UI v2', () => {
  it('asnjë ngjyrë e shkruar dhe asnjë tekst amber jashtë globals.css', () => {
    expect(findViolations()).toEqual([])
  })
})
