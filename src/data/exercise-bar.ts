import { BAR_KG, isBarKg } from '@/program/plates'
import type { LocalStore } from './store'

// Shufra e një ushtrimi (bordi "Seanca · tastiera"): 20, 15, 10 kg ose pa shufër, e ruajtur vetëm në
// telefon për ushtrimin (`writeDevice`, pa sinkronizim); pa zgjedhje është shufra olimpike 20 kg.

const key = (exerciseId: string) => `bar:${exerciseId}`

export async function exerciseBar(store: LocalStore, exerciseId: string): Promise<number> {
  const value = await store.readDevice(key(exerciseId))
  return isBarKg(value) ? value : BAR_KG
}

export async function saveExerciseBar(store: LocalStore, exerciseId: string, barKg: number): Promise<void> {
  if (!isBarKg(barKg)) throw new Error('Shufra nuk është ndër zgjedhjet.')
  await store.writeDevice(key(exerciseId), barKg)
}
