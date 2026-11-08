import { createLanguageStore } from '@/i18n/language'
import { createDatabase } from './db'
import { adoptSavedLanguage, chooseLanguage, savedLanguage } from './language'
import { completeOnboarding } from './profile'
import { createLocalStore } from './store'
import { PENDING } from './tables'

// Gjuha ruhet te user_settings dhe sinkronizohet si cilësimet e tjera (SPEC V22).
const USER = '11111111-1111-4111-8111-111111111111'

function setup() {
  const db = createDatabase(`language-${crypto.randomUUID()}`)
  const store = createLocalStore(db, { userId: () => USER })
  return { db, store }
}

const onboard = (store: ReturnType<typeof setup>['store']) =>
  completeOnboarding(store, { weightKg: 80, trainingDays: [1, 2, 4, 5], trainingTime: '18:00', wakeTime: '07:00', sleepTime: '23:00' })

describe('gjuha te cilësimet e sinkronizuara', () => {
  beforeEach(() => window.localStorage.clear())

  it('para hapave të parë (pa rresht cilësimesh) gjuha vlen vetëm në telefon', async () => {
    const { store } = setup()
    const phone = createLanguageStore()
    await chooseLanguage(store, 'en', phone)
    expect(phone.get()).toBe('en')
    expect(await savedLanguage(store)).toBeNull()
    expect(await store.all('user_settings')).toHaveLength(0)
  })

  it('zgjedhja ruhet te rreshti dhe pret dërgimin', async () => {
    const { db, store } = setup()
    await onboard(store)
    const phone = createLanguageStore()
    await chooseLanguage(store, 'en', phone)
    expect(phone.get()).toBe('en')
    expect(await savedLanguage(store)).toBe('en')
    const [row] = await db.user_settings.toArray()
    expect(row.language).toBe('en')
    expect(row._dirty).toBe(PENDING)
  })

  it('gjuha e ruajtur fiton pas sinkronizimit (p.sh. nga një telefon tjetër)', async () => {
    const { db, store } = setup()
    await onboard(store)
    const [row] = await db.user_settings.toArray()
    await db.user_settings.put({ ...row, language: 'en' })
    const phone = createLanguageStore()
    expect(phone.get()).toBe('sq')
    await adoptSavedLanguage(store, phone)
    expect(phone.get()).toBe('en')
  })

  it('një rresht pa gjuhë (v1 ose hapat e parë) merr gjuhën e telefonit', async () => {
    const { store } = setup()
    await onboard(store)
    const phone = createLanguageStore()
    phone.set('en')
    await adoptSavedLanguage(store, phone)
    expect(phone.get()).toBe('en')
    expect(await savedLanguage(store)).toBe('en')
  })

  it('një vlerë e panjohur te rreshti zëvendësohet me gjuhën e telefonit', async () => {
    const { db, store } = setup()
    await onboard(store)
    const [row] = await db.user_settings.toArray()
    await db.user_settings.put({ ...row, language: 'de' })
    const phone = createLanguageStore()
    await adoptSavedLanguage(store, phone)
    expect(phone.get()).toBe('sq')
    expect(await savedLanguage(store)).toBe('sq')
  })

  it('një zgjedhje gjatë leximit nuk kthehet pas nga leximi i vjetër', async () => {
    const { db, store } = setup()
    await onboard(store)
    const [row] = await db.user_settings.toArray()
    await db.user_settings.put({ ...row, language: 'sq' })
    const phone = createLanguageStore()
    const adopting = adoptSavedLanguage(store, phone)
    phone.set('en')
    await adopting
    expect(phone.get()).toBe('en')
  })
})
