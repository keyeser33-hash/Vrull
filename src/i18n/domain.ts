import type { T } from './index'
import { MUSCLE_GROUPS } from '@/program/muscles'
import { SHORTCUT_TO_SIZE } from '@/program/shortcut-to-size'

// Emrat e domenit sipas gjuhës, për çdo ekran. Emrat e blloqeve dhe të ditëve të Shortcut to Size
// ruhen shqip në bazë; anglishtja i përkthen kur emri është ende ai i programit. Emrat që përdoruesi
// ndryshoi te editori dhe emrat e ushtrimeve mbeten siç janë.

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
export function programWeekLabel(t: T, week: { blockName: string | null; blockWeeks: number; week: number; run: number }): string {
  const block = programBlockName(t, week.blockName)
  const label = week.blockName && week.blockWeeks > 1 ? `${block} · ${t('plan.week', { week: week.week })}` : block
  return week.run > 1 ? `${label} · ${t('plan.run', { run: week.run })}` : label
}
