import { createDatabase } from './db'
import { exerciseBar, saveExerciseBar } from './exercise-bar'
import { createLocalStore } from './store'

// Shufra e ushtrimit ruhet në telefon për secilin ushtrim; pa zgjedhje, 20 kg.
const store = () => createLocalStore(createDatabase(`bar-${crypto.randomUUID()}`), { userId: () => '11111111-1111-4111-8111-111111111111', now: () => new Date(2026, 10, 16) })

describe('shufra e ushtrimit', () => {
  it('pa zgjedhje është 20 kg; ruhet për ushtrimin dhe jo për të tjerët', async () => {
    const local = store()
    expect(await exerciseBar(local, 'bench')).toBe(20)
    await saveExerciseBar(local, 'bench', 15)
    expect(await exerciseBar(local, 'bench')).toBe(15)
    expect(await exerciseBar(local, 'squat')).toBe(20)
    await saveExerciseBar(local, 'bench', 0)
    expect(await exerciseBar(local, 'bench')).toBe(0)
  })

  it('një shufër jashtë zgjedhjeve refuzohet dhe një vlerë e prishur kthen 20 kg', async () => {
    const local = store()
    await expect(saveExerciseBar(local, 'bench', 12)).rejects.toThrow()
    await local.writeDevice('bar:bench', 'x')
    expect(await exerciseBar(local, 'bench')).toBe(20)
  })
})
