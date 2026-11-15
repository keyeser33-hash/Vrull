// Ndihmësit e përbashkët të leximit të burimeve (të njëjtët që përdor usda.mjs, pa e ndryshuar atë).
import { kcalWithinTolerance } from './check.mjs'

export const round1 = (value) => Math.round(value * 10) / 10

/** Shënon rreshtin me `kcal_flag` kur kcal del jashtë 15 % të 4·P + 4·K + 9·Y (roja e shfaq si shënim, rreshti hyn). */
export function flagKcal(row) {
  if (!kcalWithinTolerance(row)) row.kcal_flag = true
  return row
}

/** Emri në gjuhën e burimit vetëm kur ndryshon nga emri anglisht (përndryshe null, që rreshti të mos e dyfishojë). */
export const nameSource = (nameSource, nameEn) => (nameSource && nameSource !== nameEn ? nameSource : null)
