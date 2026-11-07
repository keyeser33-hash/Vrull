import { addMinutes, parseTimeInput } from './time'

describe('oraret 24 orësh', () => {
  it('shton dhe heq minuta, duke kaluar mesnatën', () => {
    expect(addMinutes('18:00', 15)).toBe('18:15')
    expect(addMinutes('18:00', -15)).toBe('17:45')
    expect(addMinutes('23:45', 15)).toBe('00:00')
    expect(addMinutes('00:00', -15)).toBe('23:45')
    expect(addMinutes('07:50', 15)).toBe('08:05')
  })

  it('kupton orën e shkruar me tastierë', () => {
    expect(parseTimeInput('18:30')).toBe('18:30')
    expect(parseTimeInput('7')).toBe('07:00')
    expect(parseTimeInput('7:5')).toBe('07:05')
    expect(parseTimeInput('1830')).toBe('18:30')
    expect(parseTimeInput(' 6.45 ')).toBe('06:45')
    expect(parseTimeInput('24:00')).toBeNull()
    expect(parseTimeInput('18:60')).toBeNull()
    expect(parseTimeInput('ora')).toBeNull()
    expect(parseTimeInput('')).toBeNull()
  })
})
