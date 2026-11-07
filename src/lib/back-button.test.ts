import { registerBackButton } from './back-button'

type BackListener = (event: { canGoBack: boolean }) => void

const native = vi.hoisted(() => ({
  isNative: true,
  listener: null as BackListener | null,
  addListener: vi.fn(),
  minimizeApp: vi.fn(() => Promise.resolve()),
}))

vi.mock('@capacitor/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@capacitor/core')>()),
  Capacitor: { isNativePlatform: () => native.isNative },
}))

vi.mock('@capacitor/app', () => ({
  App: {
    addListener: (event: string, listener: BackListener) => {
      native.addListener(event)
      native.listener = listener
      return Promise.resolve({ remove: () => Promise.resolve() })
    },
    minimizeApp: native.minimizeApp,
  },
}))

describe('butoni mbrapa i Android-it', () => {
  beforeEach(() => {
    native.isNative = true
    native.listener = null
    native.addListener.mockClear()
    native.minimizeApp.mockClear()
  })

  it('kthehet te faqja e mëparshme kur ka histori', () => {
    const back = vi.fn()
    registerBackButton({ history: { back } } as unknown as Window)
    native.listener?.({ canGoBack: true })
    expect(back).toHaveBeenCalledOnce()
    expect(native.minimizeApp).not.toHaveBeenCalled()
  })

  it('në fillim të historisë e çon app-in në sfond pa e mbyllur', () => {
    const back = vi.fn()
    registerBackButton({ history: { back } } as unknown as Window)
    native.listener?.({ canGoBack: false })
    expect(native.minimizeApp).toHaveBeenCalledOnce()
    expect(back).not.toHaveBeenCalled()
  })

  it('në shfletues nuk regjistron asgjë', () => {
    native.isNative = false
    registerBackButton()
    expect(native.addListener).not.toHaveBeenCalled()
  })
})
