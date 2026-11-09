import { isTiredDay, keepsEmber, setDayAttribute } from './day-mode'

describe('pamja e ditës te <html>', () => {
  afterEach(() => setDayAttribute('normal'))

  it('tired dhe energetic vendosin data-day; normal e heq', () => {
    setDayAttribute('tired')
    expect(document.documentElement.getAttribute('data-day')).toBe('tired')
    expect(isTiredDay()).toBe(true)
    setDayAttribute('energetic')
    expect(document.documentElement.getAttribute('data-day')).toBe('energetic')
    expect(isTiredDay()).toBe(false)
    setDayAttribute('normal')
    expect(document.documentElement.hasAttribute('data-day')).toBe(false)
  })

  it('historiku mban prushin, pjesa tjetër e Progresit jo', () => {
    expect(keepsEmber('/progresi/historiku')).toBe(true)
    expect(keepsEmber('/progresi/historiku/abc')).toBe(true)
    expect(keepsEmber('/progresi')).toBe(false)
    expect(keepsEmber('/progresi/historiku-i-ri')).toBe(false)
    expect(keepsEmber('/')).toBe(false)
  })
})
