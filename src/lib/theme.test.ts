import { SystemBarsStyle } from '@capacitor/core'
import { applyTheme, DEFAULT_THEME, readTheme, saveTheme } from './theme'

// SystemBars është proxy i Capacitor-it, prandaj zëvendësohet i tëri.
const native = vi.hoisted(() => ({
  isNative: false,
  setStyle: vi.fn((_options: { style: string }) => Promise.resolve()),
}))

vi.mock('@capacitor/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@capacitor/core')>()),
  Capacitor: { isNativePlatform: () => native.isNative },
  SystemBars: { setStyle: native.setStyle },
}))

describe('shiritat e sistemit në Android', () => {
  beforeEach(() => native.setStyle.mockClear())
  afterEach(() => {
    native.isNative = false
  })

  it('ikonat e çelëta për OLED dhe të errët, të errëta për temën e çelët', () => {
    native.isNative = true
    applyTheme('oled')
    applyTheme('dark')
    applyTheme('light')

    expect(native.setStyle.mock.calls.map(([options]) => options.style)).toEqual([
      SystemBarsStyle.Dark,
      SystemBarsStyle.Dark,
      SystemBarsStyle.Light,
    ])
  })

  it('në shfletues nuk thërret plugin-in', () => {
    applyTheme('light')
    expect(native.setStyle).not.toHaveBeenCalled()
  })

  it('një gabim i plugin-it nuk e prish temën', async () => {
    native.isNative = true
    native.setStyle.mockRejectedValueOnce(new Error('pa plugin'))
    applyTheme('light')
    await Promise.resolve()
    expect(document.documentElement.className).toBe('')
  })
})

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
