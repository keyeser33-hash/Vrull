import { applyTheme, DEFAULT_THEME, readTheme, saveTheme } from './theme'

describe('tema', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.className = ''
  })

  it('parazgjedhja është OLED', () => {
    expect(DEFAULT_THEME).toBe('oled')
    expect(readTheme()).toBe('oled')
  })

  it('OLED mban edhe klasën dark', () => {
    applyTheme('oled')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.classList.contains('oled')).toBe(true)
  })

  it('dark heq oled, light heq të dyja', () => {
    applyTheme('oled')
    applyTheme('dark')
    expect(document.documentElement.className).toBe('dark')
    applyTheme('light')
    expect(document.documentElement.className).toBe('')
  })

  it('ruan zgjedhjen dhe e lexon përsëri', () => {
    saveTheme('light')
    expect(readTheme()).toBe('light')
  })

  it('injoron vlera të panjohura', () => {
    window.localStorage.setItem('th-theme', 'blu')
    expect(readTheme()).toBe('oled')
  })

  it('punon edhe kur ruajtja hedh gabim', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bllokuar')
    })
    expect(readTheme()).toBe('oled')
    spy.mockRestore()
  })
})
