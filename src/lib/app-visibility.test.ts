import { onAppResume, onAppVisibility } from './app-visibility'

// App-i përpara ose në sfond: WebView-ja e Android-it nuk e jep gjithmonë `visibilitychange` kur shtypet
// Home (prova në emulator: regjistrimi i videos vazhdoi në sfond), ndaj vlejnë edhe pause/resume i Capacitor-it.

const native = vi.hoisted(() => ({
  isNative: true,
  listeners: new Map<string, () => void>(),
  removed: [] as string[],
}))

vi.mock('@capacitor/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@capacitor/core')>()),
  Capacitor: { isNativePlatform: () => native.isNative },
}))

vi.mock('@capacitor/app', () => ({
  App: {
    addListener: (event: string, listener: () => void) => {
      native.listeners.set(event, listener)
      return Promise.resolve({ remove: () => Promise.resolve(void native.removed.push(event)) })
    },
  },
}))

let visibility: DocumentVisibilityState = 'visible'

beforeEach(() => {
  native.isNative = true
  native.listeners.clear()
  native.removed = []
  visibility = 'visible'
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility })
})

afterEach(() => {
  Reflect.deleteProperty(document, 'visibilityState')
})

const changeVisibility = (next: DocumentVisibilityState) => {
  visibility = next
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('onAppVisibility', () => {
  it('pause i Capacitor-it e jep app-in në sfond edhe kur faqja thotë ende "visible"; resume e kthen', () => {
    const calls: boolean[] = []
    onAppVisibility((visible) => calls.push(visible))
    native.listeners.get('pause')!()
    native.listeners.get('resume')!()
    expect(calls).toEqual([false, true])
  })

  it('visibilitychange vlen vetëm, dhe dy sinjale për të njëjtin ndryshim thirren një herë', () => {
    const calls: boolean[] = []
    onAppVisibility((visible) => calls.push(visible))
    native.listeners.get('pause')!()
    changeVisibility('hidden')
    changeVisibility('visible')
    native.listeners.get('resume')!()
    expect(calls).toEqual([false, true])
  })

  it('në shfletues: vetëm visibilitychange, pa plugin', () => {
    native.isNative = false
    const calls: boolean[] = []
    onAppVisibility((visible) => calls.push(visible))
    expect(native.listeners.size).toBe(0)
    changeVisibility('hidden')
    changeVisibility('visible')
    expect(calls).toEqual([false, true])
  })

  it('heqja e dëgjuesit ndal të dyja burimet', async () => {
    const calls: boolean[] = []
    const stop = onAppVisibility((visible) => calls.push(visible))
    stop()
    changeVisibility('hidden')
    // Heqja e plugin-it është asinkrone: një pause që vjen ndërkohë nuk thërret më.
    native.listeners.get('pause')!()
    await vi.waitFor(() => expect(native.removed.sort()).toEqual(['pause', 'resume']))
    expect(calls).toEqual([])
  })

  it('onAppResume: një thirrje për një rikthim, edhe kur vijnë të dy sinjalet', () => {
    // Rishikimi i E1: onResume i muzikës thirrej dy herë (visibilitychange dhe resume), music.restart() dy herë.
    const calls: string[] = []
    onAppResume(() => calls.push('resume'))
    native.listeners.get('pause')!()
    changeVisibility('hidden')
    changeVisibility('visible')
    native.listeners.get('resume')!()
    expect(calls).toEqual(['resume'])
  })
})
