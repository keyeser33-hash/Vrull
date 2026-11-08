import type { TemplateNames } from '@/data/program-editor'
import type { I18n } from '@/i18n'
import { useI18n } from '@/i18n/use-i18n'
import type { Scope } from '@/program/rules'
import { SHORTCUT_TO_SIZE } from '@/program/shortcut-to-size'
import { type ProgramTemplate, type TemplateId, templateSummary } from '@/program/templates'
import type { Prescription, RepRange } from '@/program/types'
import { clock } from './training-format'

// Tekstet e ndërtuesit (V2-E1-10) në të dyja gjuhët: receta e një sloti, nivelet e editorit dhe
// butoni "Ruaj për…". Emrat e blloqeve vijnë të përkthyer nga thirrësi (`programBlockName`).

type T = I18n['t']
type Fmt = I18n['fmt']

/** "6–8", "8+", "20–30+" (deri në dështim nëse mund më shumë). */
export function repsRange(fmt: Fmt, range: RepRange): string {
  if (range.max === null) return `${fmt.number(range.min)}+`
  return `${fmt.number(range.min)}–${fmt.number(range.max)}${range.beyond ? '+' : ''}`
}

/** Vlera e recetës te butoni dhe te lista: "6–8", "12–15 → 3–5", "60 s", "85% × 5+ → 95% × 1". */
export function prescriptionValue(t: T, fmt: Fmt, prescription: Prescription | null | undefined): string {
  if (!prescription) return t('builder.slot.kind.none')
  switch (prescription.type) {
    case 'rir':
    case 'rpe':
      return repsRange(fmt, prescription.reps)
    case 'rep_ladder': {
      const first = repsRange(fmt, prescription.ladder[0])
      const last = repsRange(fmt, prescription.ladder[prescription.ladder.length - 1])
      return prescription.ladder.length > 1 ? `${first} → ${last}` : first
    }
    case 'timed':
      return fmt.unit(prescription.seconds, 's')
    case 'percent_1rm': {
      const step = (week: (typeof prescription.weeks)[number]) => `${fmt.number(week.percent)}% × ${fmt.number(week.reps)}${week.amrap ? '+' : ''}`
      const { weeks } = prescription
      return weeks.length > 1 ? `${step(weeks[0])} → ${step(weeks[weeks.length - 1])}` : step(weeks[0])
    }
    case 'linear':
      return `${fmt.number(prescription.reps)} · +${fmt.unit(prescription.incrementKg, 'kg')}`
  }
}

/** Emri i rreshtit të recetës: "Përsëritjet" për intervalin, përndryshe lloji ("Koha"). */
export function prescriptionLabel(t: T, prescription: Prescription | null | undefined): string {
  if (!prescription || prescription.type === 'rir') return t('builder.slot.reps')
  return t(`builder.slot.kind.${prescription.type}`)
}

/** "RIR 2", "RIR 2–3". */
export function rirText(t: T, fmt: Fmt, rir: { min: number; max: number }): string {
  const value = rir.min === rir.max ? fmt.number(rir.min) : `${fmt.number(rir.min)}–${fmt.number(rir.max)}`
  return t('builder.summary.rir', { rir: value })
}

/** Rreshti i një ushtrimi te dita (bordi "Dita"): "4 × 6–8 · RIR 2 · pushim 2:30". */
export function slotSummary(t: T, fmt: Fmt, slot: { sets: number; restSeconds: number; prescription: Prescription | null | undefined }): string {
  const { sets, restSeconds, prescription } = slot
  const parts = [prescription ? `${fmt.number(sets)} × ${prescriptionValue(t, fmt, prescription)}` : t('builder.count.sets', { count: sets })]
  if (prescription?.type === 'rir') parts.push(rirText(t, fmt, prescription.rir))
  if (prescription?.type === 'rpe') parts.push(t('builder.summary.rpe', { rpe: prescription.rpe }))
  parts.push(t('builder.summary.rest', { time: clock(restSeconds) }))
  return parts.join(' · ')
}

type BlockNames = Record<string, string>

/** Niveli brenda fjalisë: "programi", "blloku Forca", "java 2", "Forca · java 2". */
export function levelName(t: T, scope: Scope, blocks: BlockNames): string {
  const block = scope.blockId ? (blocks[scope.blockId] ?? '') : null
  if (block !== null && scope.week !== null) return t('builder.level.blockWeek', { block, week: scope.week })
  if (block !== null) return t('builder.level.block', { block })
  if (scope.week !== null) return t('builder.level.week', { week: scope.week })
  return t('builder.level.programme')
}

/** Niveli si titull: "Programi", "Forca", "Java 2 e çdo blloku", "Forca · Java 2". */
export function levelTitle(t: T, scope: Scope, blocks: BlockNames): string {
  const block = scope.blockId ? (blocks[scope.blockId] ?? '') : null
  if (block !== null && scope.week !== null) return t('builder.levelTitle.blockWeek', { block, week: scope.week })
  if (block !== null) return t('builder.levelTitle.block', { block })
  if (scope.week !== null) return t('builder.levelTitle.week', { week: scope.week })
  return t('builder.levelTitle.programme')
}

/** Veprimi kryesor i slotit: "Ruaj për bllokun Forca". */
export function saveLabel(t: T, scope: Scope, blocks: BlockNames): string {
  const block = scope.blockId ? (blocks[scope.blockId] ?? '') : null
  if (block !== null && scope.week !== null) return t('builder.slot.save.blockWeek', { block, week: scope.week })
  if (block !== null) return t('builder.slot.save.block', { block })
  if (scope.week !== null) return t('builder.slot.save.week', { week: scope.week })
  return t('builder.slot.save.programme')
}

/** Emrat e shablloneve në gjuhën e përdoruesit, për kopjen (`createFromTemplate`). */
export function useTemplateNames(): TemplateNames {
  const { t } = useI18n()
  return {
    program: {
      shortcut_to_size: SHORTCUT_TO_SIZE.name,
      full_body_3: t('builder.template.name.full_body_3'),
      upper_lower_4: t('builder.template.name.upper_lower_4'),
    },
    block: { base: t('builder.template.block.base'), strength: t('builder.template.block.strength') },
    day: {
      upperA: t('builder.template.day.upperA'),
      lowerA: t('builder.template.day.lowerA'),
      upperB: t('builder.template.day.upperB'),
      lowerB: t('builder.template.day.lowerB'),
      fullA: t('builder.template.day.fullA'),
      fullB: t('builder.template.day.fullB'),
      fullC: t('builder.template.day.fullC'),
    },
  }
}

/** "13 javë · 4 ditë · Jim Stoppani", "8 javë · 4 ditë · sipër dhe poshtë". */
export function useTemplateText() {
  const { t } = useI18n()
  const names = useTemplateNames()
  return {
    name: (id: TemplateId) => names.program[id],
    meta: (template: ProgramTemplate) => {
      const { weeks, days } = templateSummary(template)
      const about = template.author ?? (template.id === 'shortcut_to_size' ? null : t(`builder.template.about.${template.id}`))
      return [t('builder.count.weeks', { count: weeks }), t('builder.count.days', { count: days }), about].filter(Boolean).join(' · ')
    },
  }
}
