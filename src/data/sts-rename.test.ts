import { createDatabase } from './db'
import { completeOnboarding } from './profile'
import { createLocalStore } from './store'
import { upgradeShortcutToSize } from './training'

// Faza 3, Stërvitja 1, slot-i 6 (V62, PDF faqet 9–11): "Cable Triceps Extension". Programet që u
// krijuan para ndryshimit mbajnë emrin e vjetër; ai ndryshon me një ndryshim të të dhënave në
// telefon, vetëm kur ushtrimi i vjetër nuk ka asnjë set të regjistruar.
const USER = '11111111-1111-4111-8111-111111111111'
const OLD = 'One-Arm Overhead Cable Triceps Extension'
const NEW = 'Cable Triceps Extension'
const NOW = new Date(2026, 11, 7, 18, 0)

async function phoneWithOldName() {
  const store = createLocalStore(createDatabase(`sts-rename-${crypto.randomUUID()}`), { userId: () => USER, now: () => NOW })
  await completeOnboarding(store, { weightKg: 80, trainingDays: [1, 2, 4, 5], trainingTime: '18:00', wakeTime: '07:00', sleepTime: '23:00' }, () => NOW)
  const row = (await store.all('exercises')).find((item) => item.name === NEW)!
  await store.put('exercises', { id: row.id, name: OLD })
  return { store, exerciseId: row.id }
}

const names = async (store: Awaited<ReturnType<typeof phoneWithOldName>>['store']) => (await store.all('exercises')).map((row) => String(row.name))

describe('Cable Triceps Extension', () => {
  it('programi i ri e ka emrin e PDF-së', async () => {
    const store = createLocalStore(createDatabase(`sts-new-${crypto.randomUUID()}`), { userId: () => USER, now: () => NOW })
    await completeOnboarding(store, { weightKg: 80, trainingDays: [1, 2, 4, 5], trainingTime: '18:00', wakeTime: '07:00', sleepTime: '23:00' }, () => NOW)
    expect(await names(store)).toContain(NEW)
    expect(await names(store)).not.toContain(OLD)
  })

  it('ushtrimi i vjetër pa asnjë set merr emrin e ri, me të njëjtën id', async () => {
    const { store, exerciseId } = await phoneWithOldName()
    await upgradeShortcutToSize(store)
    const rows = (await store.all('exercises')).filter((row) => [OLD, NEW].includes(String(row.name)))
    expect(rows.map((row) => [row.id, row.name])).toEqual([[exerciseId, NEW]])
  })

  it('me një set të regjistruar mbetet me emrin e vjetër', async () => {
    const { store, exerciseId } = await phoneWithOldName()
    await store.put('set_logs', { session_id: crypto.randomUUID(), exercise_id: exerciseId, set_number: 1, weight_kg: 20, reps: 10, logged_at: NOW.toISOString() })
    await upgradeShortcutToSize(store)
    expect(await names(store)).toContain(OLD)
    expect(await names(store)).not.toContain(NEW)
  })

  it('një ushtrim i përdoruesit me të njëjtin emër, jashtë programit, nuk preket', async () => {
    const { store, exerciseId } = await phoneWithOldName()
    // Ushtrimi i programit shkon te emri i ri; ky i përdoruesit mban emrin e vjetër dhe mbetet.
    await upgradeShortcutToSize(store)
    const mine = await store.put('exercises', { name: OLD, equipment: 'cable', tracking: 'weight_reps', primary_muscles: ['triceps_brachii'], secondary_muscles: [] })
    await upgradeShortcutToSize(store)
    expect((await store.get('exercises', mine.id))?.name).toBe(OLD)
    expect((await store.get('exercises', exerciseId))?.name).toBe(NEW)
  })

  it('një ushtrim tjetër me emrin e ri ekziston tashmë: asgjë nuk dyfishohet', async () => {
    const { store, exerciseId } = await phoneWithOldName()
    await store.put('exercises', { name: NEW, equipment: 'cable', tracking: 'weight_reps', primary_muscles: ['triceps_brachii'], secondary_muscles: [] })
    await upgradeShortcutToSize(store)
    expect((await store.get('exercises', exerciseId))?.name).toBe(OLD)
  })
})
