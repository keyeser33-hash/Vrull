import type { DayType } from './targets'

// Uji (V36, SPEC §9): një gotë = 250 ml; objektivi 35 ml/kg, i rrumbullakosur në 0,25 L, +0,5 L në
// ditët e stërvitjes. Moti vjen me Etapën 3.

export const GLASS_ML = 250
export const WATER_ML_PER_KG = 35
export const TRAINING_EXTRA_ML = 500

export function waterTargetMl(weightKg: number, dayType: DayType): number {
  const base = Math.round((weightKg * WATER_ML_PER_KG) / GLASS_ML) * GLASS_ML
  return base + (dayType === 'training' ? TRAINING_EXTRA_ML : 0)
}
