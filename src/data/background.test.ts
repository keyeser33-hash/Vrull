import { createBackgroundStore } from '@/lib/background'
import { adoptSavedBackground, chooseBackground, savedBackground } from './background'
import { createDatabase } from './db'
import { completeOnboarding } from './profile'
import { createLocalStore } from './store'
import { PENDING } from './tables'

// Sfondi ruhet te user_settings.background dhe sinkronizohet si gjuha (V2-E1-05).
const USER = '11111111-1111-4111-8111-111111111111'

function setup() {
  const db = createDatabase(`background-${crypto.randomUUID()}`)
  const store = createLocalStore(db, { userId: () => USER })
  return { db, store }
}

const onboard = (store: ReturnType<typeof setup>['store']) =>
  completeOnboarding(store, { weightKg: 80, trainingDays: [1, 2, 4, 5], trainingTime: '18:00', wakeTime: '07:00', sleepTime: '23:00' })

describe('sfondi te cilësimet e sinkronizuara', () => {
  beforeEach(() => window.localStorage.clear())

  it('pa rresht cilësimesh sfondi vlen vetëm në telefon', async () => {
    const { store } = setup()
    const phone = createBackgroundStore()
    await chooseBackground(store, 'speed_lines', phone)
    expect(phone.get()).toBe('speed_lines')
    expect(await savedBackground(store)).toBeNull()
    expect(await store.all('user_settings')).toHaveLength(0)
  })

  it('zgjedhja ruhet te rreshti dhe pret dërgimin', async () => {
    const { db, store } = setup()
    await onboard(store)
    const phone = createBackgroundStore()
    await chooseBackground(store, 'speed_lines', phone)
    expect(phone.get()).toBe('speed_lines')
    expect(await savedBackground(store)).toBe('speed_lines')
    const [row] = await db.user_settings.toArray()
    expect(row.background).toBe('speed_lines')
    expect(row._dirty).toBe(PENDING)
  })

  it('sfondi i ruajtur fiton pas sinkronizimit (p.sh. nga një telefon tjetër)', async () => {
    const { db, store } = setup()
    await onboard(store)
    const [row] = await db.user_settings.toArray()
    await db.user_settings.put({ ...row, background: 'speed_lines' })
    const phone = createBackgroundStore()
    expect(phone.get()).toBe('solid')
    await adoptSavedBackground(store, phone)
    expect(phone.get()).toBe('speed_lines')
  })

  it('një rresht pa sfond (v1) merr sfondin e telefonit', async () => {
    const { db, store } = setup()
    await onboard(store)
    const [row] = await db.user_settings.toArray()
    expect(row).not.toHaveProperty('background')
    const phone = createBackgroundStore()
    await adoptSavedBackground(store, phone)
    expect(phone.get()).toBe('solid')
    expect(await savedBackground(store)).toBe('solid')
  })

  it('një vlerë e panjohur te rreshti zëvendësohet me sfondin e telefonit', async () => {
    const { db, store } = setup()
    await onboard(store)
    const [row] = await db.user_settings.toArray()
    await db.user_settings.put({ ...row, background: 'dark' })
    const phone = createBackgroundStore()
    phone.set('speed_lines')
    await adoptSavedBackground(store, phone)
    expect(phone.get()).toBe('speed_lines')
    expect(await savedBackground(store)).toBe('speed_lines')
  })

  it('një zgjedhje gjatë leximit nuk kthehet pas nga leximi i vjetër', async () => {
    const { db, store } = setup()
    await onboard(store)
    const [row] = await db.user_settings.toArray()
    await db.user_settings.put({ ...row, background: 'solid' })
    const phone = createBackgroundStore()
    const adopting = adoptSavedBackground(store, phone)
    phone.set('speed_lines')
    await adopting
    expect(phone.get()).toBe('speed_lines')
  })
})
