import { SystemBarsStyle } from '@capacitor/core'
import { i18nFor } from '@/i18n'
import { applyPanelTop, applyTheme, DEFAULT_THEME, readTheme, saveTheme, THEMES } from './theme'

// SystemBars është proxy i Capacitor-it, prandaj zëvendësohet i tëri.
const native = vi.hoisted(() => ({
  isNative: false,
  calls: [] as string[],
  setStyle: vi.fn((_options: { style: string }) => Promise.resolve()),
  setColor: vi.fn((_options: { color: string }) => Promise.resolve()),
}))

vi.mock('@capacitor/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@capacitor/core')>()),
  Capacitor: { isNativePlatform: () => native.isNative },
  SystemBars: {
    setStyle: (options: { style: string }) => {
      native.calls.push('setStyle')
      return native.setStyle(options)
    },
  },
  registerPlugin: () => ({
    setColor: (options: { color: string }) => {
      native.calls.push('setColor')
      return native.setColor(options)
    },
  }),
}))

describe('shiritat e sistemit në Android', () => {
  beforeEach(() => {
    native.setStyle.mockClear()
    native.setColor.mockClear()
    native.calls = []
  })
  afterEach(() => {
    native.isNative = false
    document.documentElement.style.removeProperty('--background')
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

  it('ekranet me kartë sipër (hyrja): dritarja me ngjyrën `surface`, ikonat sipas temës', async () => {
    native.isNative = true
    document.documentElement.style.setProperty('--surface', '#FFFFFF')
    applyTheme('light')
    native.setStyle.mockClear()
    native.setColor.mockClear()
    applyPanelTop(true)
    await vi.waitFor(() => expect(native.setColor).toHaveBeenCalledWith({ color: '#FFFFFF' }))
    // Në Vrull `surface` ndjek temën: në Ditë është e bardhë, ndaj ora dhe bateria mbeten të errëta.
    expect(native.setStyle).toHaveBeenCalledWith({ style: SystemBarsStyle.Light })

    document.documentElement.style.setProperty('--surface', '#121214')
    applyTheme('oled')
    native.setStyle.mockClear()
    applyPanelTop(true)
    await vi.waitFor(() => expect(native.setColor).toHaveBeenCalledWith({ color: '#121214' }))
    expect(native.setStyle).toHaveBeenCalledWith({ style: SystemBarsStyle.Dark })
    document.documentElement.style.removeProperty('--surface')
  })

  it('në shfletues nuk thërret plugin-in', () => {
    applyTheme('light')
    expect(native.setStyle).not.toHaveBeenCalled()
  })

  it('dritarja pas shiritave merr sfondin e temës, pas stilit të ikonave', async () => {
    native.isNative = true
    // Në jsdom CSS-i nuk ngarkohet; tokeni vendoset me dorë si te globals.css.
    document.documentElement.style.setProperty('--background', '#FAFAFA')
    applyTheme('light')
    await vi.waitFor(() => expect(native.setColor).toHaveBeenCalledWith({ color: '#FAFAFA' }))
    // SystemBars.setStyle e kthen dritaren në ngjyrën e nisjes, prandaj ngjyra vendoset pas tij.
    expect(native.calls).toEqual(['setStyle', 'setColor'])
  })

  it('ngjyrat e shkurtra (#000 pas minifikimit) dërgohen me gjashtë shifra', async () => {
    native.isNative = true
    document.documentElement.style.setProperty('--background', '#000')
    applyTheme('oled')
    await vi.waitFor(() => expect(native.setColor).toHaveBeenCalledWith({ color: '#000000' }))
  })

  it('pa token sfondi nuk dërgon ngjyrë', async () => {
    native.isNative = true
    applyTheme('dark')
    await vi.waitFor(() => expect(native.setStyle).toHaveBeenCalled())
    await Promise.resolve()
    expect(native.setColor).not.toHaveBeenCalled()
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

  it('emrat e temave të Vrullit; vlerat e ruajtura të v1 mbeten të vlefshme', () => {
    expect(THEMES.map((theme) => i18nFor('sq').t(`settings.theme.${theme}`))).toEqual(['OLED', 'Natë', 'Ditë'])
    expect(THEMES.map((theme) => i18nFor('en').t(`settings.theme.${theme}`))).toEqual(['OLED', 'Night', 'Day'])
    window.localStorage.setItem('th-theme', 'dark')
    expect(readTheme()).toBe('dark')
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
