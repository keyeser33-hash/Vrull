import { createLanguageStore, type Language } from '@/i18n/language'
import { shareLanguageWithAndroid } from './native-language'

// V2-E1-17: Android-i e merr gjuhën e app-it për njoftimin "Vrull u përditësua", që del pa app-in.

describe('gjuha te Android-i', () => {
  beforeEach(() => window.localStorage.clear())

  it('e dërgon në nisje dhe në çdo ndërrim, deri sa ndalet', async () => {
    const store = createLanguageStore()
    const sent: Language[] = []
    const stop = shareLanguageWithAndroid(store, async (lang) => void sent.push(lang))
    expect(sent).toEqual(['sq'])
    store.set('en')
    store.set('sq')
    expect(sent).toEqual(['sq', 'en', 'sq'])
    stop()
    store.set('en')
    expect(sent).toEqual(['sq', 'en', 'sq'])
  })

  it('një dështim i plugin-it nuk prish app-in', async () => {
    const store = createLanguageStore()
    const send = vi.fn(async () => {
      throw new Error('pa plugin')
    })
    const stop = shareLanguageWithAndroid(store, send)
    store.set('en')
    await Promise.resolve()
    expect(send).toHaveBeenCalledTimes(2)
    stop()
    store.set('sq')
  })
})
