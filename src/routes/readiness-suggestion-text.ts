import type { I18n } from '@/i18n'
import { muscleName, nameInSentence } from '@/i18n/domain'
import type { LighterCost, Reason, StrengthKey } from '@/readiness/lighter-session'
import { capitalize } from './history-format'
import { CHIP_LABEL } from './readiness-format'

// Fjalët e kartës së sugjerimit (V50, V2-E3-06): pse ofrohet, dhe çfarë kushton seanca më e lehtë. Logjika e
// zgjedhjes së pjesëve: readiness/lighter-session.ts; këtu vetëm teksti në gjuhën e app-it.

const joinNames = ({ t }: I18n, names: string[]) => (names.length > 1 ? `${names[0]} ${t('lighter.and')} ${names[1]}` : (names[0] ?? ''))

/** "gjoksi", "gjoksi dhe shpatullat". */
function groupList(i18n: I18n, groups: string[] | undefined): string {
  return joinNames(i18n, (groups ?? []).map((group) => nameInSentence(muscleName(i18n.t, group), i18n.lang)))
}

/** Çipat e dhimbjeve: "këmbët", "gjoksi dhe krahët" (të njëjtat emra si çipat e fletës). */
function chipList(i18n: I18n, chips: Reason['chips']): string {
  return joinNames(i18n, (chips ?? []).map((chip) => nameInSentence(i18n.t(CHIP_LABEL[chip]), i18n.lang)))
}

/** Fjala e saktë për një pjesë: "gjumi i shkurtër", "dhimbjet te gjoksi". */
function reasonText(i18n: I18n, reason: Reason): string {
  const { t } = i18n
  switch (reason.key) {
    case 'recoveryPoor':
    case 'recoveryPartial':
      return t(`lighter.reason.${reason.key}`, { groups: groupList(i18n, reason.groups) })
    case 'soreGroups':
      return t('lighter.reason.soreGroups', { groups: chipList(i18n, reason.chips) })
    case 'soreMany':
      return t('lighter.reason.soreMany', { count: reason.count ?? 0 })
    default:
      return t(`lighter.reason.${reason.key}`)
  }
}

/** "Gjumi i shkurtër dhe dhimbjet te gjoksi." */
export function whyText(i18n: I18n, reasons: Reason[]): string {
  const [first, second] = reasons.map((reason) => reasonText(i18n, reason))
  if (!first) return ''
  return second ? i18n.t('lighter.why', { first: capitalize(first, i18n.lang), second }) : `${capitalize(first, i18n.lang)}.`
}

/** Pjesa e peshës ose e RIR-it: "pesha −10%", "RIR +1", "RIR +1 ose pesha −10%". */
function effectText({ t }: I18n, cost: LighterCost): string | null {
  return cost.effect ? t(`lighter.cost.${cost.effect}`) : null
}

/** Rreshti i vogël te butoni: "−1 set nga ushtrimi i 3-të, pesha −10%". */
export function costText(i18n: I18n, cost: LighterCost): string {
  return [cost.sets ? i18n.t('lighter.cost.sets') : null, effectText(i18n, cost)].filter(Boolean).join(', ')
}

/** Shiriti i seancës: "−1 set, pesha −10%". */
export function barCostText(i18n: I18n, cost: LighterCost): string {
  return [cost.sets ? i18n.t('lighter.bar.sets') : null, effectText(i18n, cost)].filter(Boolean).join(', ')
}


/** "Gatishmëria 88% · gjumë i mirë, pa dhimbje": rreshti i kartës së stërvitjes në ditë të lartë (V50). */
export function strengthLine({ t, fmt }: I18n, percent: number, strengths: StrengthKey[]): string {
  const [first, second] = strengths.map((key) => t(`readiness.strength.${key}`))
  const value = fmt.number(percent)
  if (!first) return t('readiness.strength.line', { percent: value })
  return second ? t('readiness.strength.line2', { percent: value, first, second }) : t('readiness.strength.line1', { percent: value, first })
}
