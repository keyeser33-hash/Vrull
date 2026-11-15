import type { Format } from './format'
import type { T } from './index'
import { JIM_FOODS, type JimFoodKey, type Portion } from '@/nutrition/jim'
import { PDF_FOODS, pdfKey } from '@/nutrition/pdf-swaps'
import type { MealKey } from '@/nutrition/meals'
import { type DoseUnit, type Evidence, supplementByName } from '@/nutrition/supplements'
import { MUSCLE_GROUPS } from '@/program/muscles'
import { SHORTCUT_TO_SIZE } from '@/program/shortcut-to-size'
import type { Equipment, ProgramWeek } from '@/program/types'
import type { DayTheme } from '@/progress/history'

// Emrat e domenit sipas gjuhës, për çdo ekran. Emrat e blloqeve dhe të ditëve të Shortcut to Size
// ruhen shqip në bazë; anglishtja i përkthen kur emri është ende ai i programit. Emrat që përdoruesi
// ndryshoi te editori dhe emrat e ushtrimeve mbeten siç janë. Njësoj ushqimet e shabllonit të Jimit
// dhe suplementet e planit; emrat e Open Food Facts, USDA dhe të përdoruesit mbeten siç vijnë.

const STS_DAYS: string[] = SHORTCUT_TO_SIZE.program.days.map((day) => day.name)
const STS_BLOCKS: string[] = SHORTCUT_TO_SIZE.program.blocks.map((block) => block.name)
const GROUP_IDS = new Set(MUSCLE_GROUPS.map((group) => group.id))

type MuscleKey = Extract<Parameters<T>[0], `muscle.${string}`>

/** "Gjoksi" / "Chest" nga id-ja e grupit (`src/program/muscles.ts`); id e panjohur mbetet siç është. */
export function muscleName(t: T, groupId: string): string {
  return GROUP_IDS.has(groupId) ? t(`muscle.${groupId}` as MuscleKey) : groupId
}

/** "Gjoks, triceps, pulpa" / "Chest, triceps, calves"; një emër i përdoruesit mbetet siç është. */
export function programDayName(t: T, name: string | null): string {
  if (!name) return ''
  const index = STS_DAYS.indexOf(name)
  return index >= 0 ? t(`plan.stsDay.${index + 1}` as 'plan.stsDay.1') : name
}

/** "Java 0", "Faza 1" / "Week 0", "Phase 1"; pa bllok, "Pa program". */
export function programBlockName(t: T, name: string | null): string {
  if (!name) return t('plan.none')
  if (!STS_BLOCKS.includes(name)) return name
  const week = /^Java (\d+)$/.exec(name)
  if (week) return t('plan.week', { week: Number(week[1]) })
  const phase = /^Faza (\d+)$/.exec(name)
  return phase ? t('plan.phase', { n: Number(phase[1]) }) : name
}

/** "Faza 1 · Java 2", "Java 0"; xhiro e dytë e thotë ("· Xhiro 2"). */
export function programWeekLabel(t: T, week: Omit<ProgramWeek, 'blockName'> & { blockName: string | null }): string {
  const block = programBlockName(t, week.blockName)
  const label = week.blockName && week.blockWeeks > 1 ? `${block} · ${t('plan.week', { week: week.week })}` : block
  return week.run > 1 ? `${label} · ${t('plan.run', { run: week.run })}` : label
}

/** "Dita e gjoksit" / "Chest day": tema e ditës nga muskuli kryesor i ushtrimit të parë (`dayTheme`). */
export function dayThemeName(t: T, theme: DayTheme): string {
  return t(`plan.theme.${theme}`)
}

/** "Shufër" / "Barbell". */
export function equipmentName(t: T, equipment: Equipment): string {
  return t(`equipment.${equipment}`)
}

/** "Snack paradite" / "Morning snack". */
export function mealName(t: T, meal: MealKey): string {
  return t(`food.meal.${meal}`)
}

/**
 * Emri i një ushqimi: ai i shabllonit të Jimit (`jim:<çelësi>`, ruhet shqip) në gjuhën e app-it kur
 * emri është ende ai i planit; çdo emër tjetër siç është. Pa ushqim (i fshirë): "Ushqim" / "Food".
 */
export function foodName(t: T, food: { name: string | null; sourceId: string | null }): string {
  if (food.name === null) return t('food.unknownFood')
  const key = food.sourceId?.startsWith('jim:') ? food.sourceId.slice(4) : null
  if (key && key in JIM_FOODS && JIM_FOODS[key as JimFoodKey].name === food.name) return t(`food.jim.${key as JimFoodKey}`)
  const pdf = food.sourceId ? pdfKey(food.sourceId) : null
  if (pdf && PDF_FOODS[pdf].name === food.name) return t(`food.pdf.${pdf}`)
  return food.name
}

/** "2 feta" / "2 slices", "½ pjepër"; gramët "227 g" me hapësirë që nuk thyhet. */
export function portionText(t: T, fmt: Format, portion: Portion): string {
  if (portion.unit === 'gram') return fmt.unit(portion.count, 'g')
  return t(`food.portion.${portion.unit}`, { count: portion.count })
}

/** Një emër brenda fjalisë ("me pluhur proteine, ZMA"): me shkronjë të vogël, përveç shkurtimeve (BCAA, ZMA). */
const MISSED_NO = {
  1: 'today.missed.no.1',
  2: 'today.missed.no.2',
  3: 'today.missed.no.3',
  4: 'today.missed.no.4',
  5: 'today.missed.no.5',
  6: 'today.missed.no.6',
  7: 'today.missed.no.7',
} as const

/** "Jo, të enjten" (dita ISO e stërvitjes së radhës), ose "Jo, më vonë" pa të (V38). */
export function missedNo(t: T, weekday: number | null): string {
  const key = weekday === null ? undefined : MISSED_NO[weekday as keyof typeof MISSED_NO]
  return key ? t(key) : t('today.missed.no')
}

export function nameInSentence(name: string, lang: string): string {
  // Shkurtimet ("ZMA") dhe emrat e markave me shkronjë të madhe në mes ("Clif Bar") mbeten siç janë.
  return /^[\p{Lu}\d-]{2,}$/u.test(name) || /\s\p{Lu}/u.test(name) ? name : name.toLocaleLowerCase(lang)
}

/** "Kreatinë" / "Creatine" për suplementet e planit; një emër tjetër siç është. */
export function supplementName(t: T, name: string): string {
  const known = supplementByName(name)
  return known ? t(`food.supplementName.${known.key}`) : name
}

/**
 * Doza në gjuhën e app-it: ajo e planit ("1.5–5 g"), ajo që përdoruesi shkroi si tekst, ose (V39, suplementet
 * e tij) sasia me njësinë ("1 lugë").
 */
export function supplementDose(t: T, name: string, doseText: string, dose?: { amount: number; unit: DoseUnit; fmt: Format }): string {
  const known = supplementByName(name)
  if (known && known.doseText === doseText) return t(`food.supplementDose.${known.key}`)
  // Pluhuri i planit: "1–2 scoop" i vjetër = përmbledhja; "2 scoop" te një vakt = sasia me shumës.
  if (known?.key === 'protein' && doseText === '1–2 scoop') return t('food.supplementDose.protein')
  const scoops = known?.key === 'protein' ? /^(\d+) scoop$/.exec(doseText) : null
  if (scoops) return t('food.portion.scoop', { count: Number(scoops[1]) })
  if (doseText || !dose) return doseText
  return t('food.supplement.doseText', { amount: dose.fmt.number(dose.amount, { maxDigits: 2 }), unit: t(`food.supplement.unit.${dose.unit}`) })
}

/** Evidenca me fjalë si te tabela e §10; për një suplement tjetër, etiketa e shkurtër. */
export function supplementEvidence(t: T, name: string, evidence: Evidence): string {
  const known = supplementByName(name)
  return known ? t(`food.supplementEvidence.${known.key}`) : t(`food.evidence.${evidence}`)
}
