import type { Tone } from '@/body/model-math'
import { loadLevel, WEEKLY_TARGET } from '@/body/body-map'
import type { BodyGroup } from '@/data/body'
import type { I18n } from '@/i18n'
import { muscleName } from '@/i18n/domain'
import { weekRange } from '@/lib/calendar'
import type { RecoveryStatus } from '@/program/recovery'

// Tekstet dhe ngjyrat e Trupit (SPEC §11; bordet "Trupi", Natë, Ditë). Figura 2D përdor klasat
// `fill-…`, legjenda `bg-…`, modeli 3D të njëjtin token me të njëjtin opacitet (`tone`), që të tria
// të lexohen njësoj. Volumi me tokenat `volume-1…3` të temës; "Pa sete" me `subtle` (DESIGN.md).
// `glow` (V53) është vetëm i modelit 3D: sa ndriçon muskuli, pa ndryshuar ngjyrën e legjendës.

export interface ToneStyle {
  fill: string
  swatch: string
  tone: Tone
}

export const RECOVERY_STYLE: Record<RecoveryStatus, ToneStyle> = {
  i_lodhur: { fill: 'fill-ember', swatch: 'bg-ember', tone: { token: '--ember', alpha: 1, glow: 1 } },
  pothuajse_gati: { fill: 'fill-ember/45', swatch: 'bg-ember/45', tone: { token: '--ember', alpha: 0.45, glow: 0.4 } },
  // "Gati" mbetet i qetë, që të dallohen muskujt që duan pushim.
  gati: { fill: 'fill-muted-foreground/35', swatch: 'bg-muted-foreground/35', tone: { token: '--muted-foreground', alpha: 0.35 } },
}

export const RECOVERY_ORDER: RecoveryStatus[] = ['i_lodhur', 'pothuajse_gati', 'gati']

export const LEVEL_STYLE: ToneStyle[] = [
  { fill: 'fill-subtle', swatch: 'bg-subtle', tone: { token: '--subtle', alpha: 1 } },
  { fill: 'fill-volume-1', swatch: 'bg-volume-1', tone: { token: '--volume-1', alpha: 1, glow: 0.12 } },
  { fill: 'fill-volume-2', swatch: 'bg-volume-2', tone: { token: '--volume-2', alpha: 1, glow: 0.45 } },
  { fill: 'fill-volume-3', swatch: 'bg-volume-3', tone: { token: '--volume-3', alpha: 1, glow: 1 } },
]

export type BodyMode = 'rikuperimi' | 'volumi'

/** Setet e javës: "0,5 sete", "1 set", "12 sete"; zero është "Pa sete". */
export const setsText = ({ t }: I18n, load: number) => t('bodyModel.sets', { count: load })

/** Ku bie volumi i javës kundrejt objektivit; pa sete është nën objektiv. */
export function targetText({ t }: I18n, load: number) {
  const level = loadLevel(load)
  return level === 3 ? t('bodyModel.target.above') : level === 2 ? t('bodyModel.target.within') : t('bodyModel.target.below')
}

/** Legjenda e volumit: "Pa sete", "Nën 10", "10–20 · objektivi", "Mbi 20". */
export function levelLabel({ t }: I18n, level: 0 | 1 | 2 | 3) {
  const { min, max } = WEEKLY_TARGET
  return [t('bodyModel.level.none'), t('bodyModel.level.below', { min }), t('bodyModel.level.within', { min, max }), t('bodyModel.level.above', { max })][level]
}

const daysOf = (hours: number) => Math.round(hours / 24)

/** Koha nga stërvitja e fundit, e shkurtër, për rreshtin e listës: "Para 3 ditësh". */
export function agoText({ t }: I18n, hours: number | null) {
  if (hours === null) return t('bodyModel.ago.none')
  if (hours < 24) return t('bodyModel.ago.hours', { count: Math.max(1, hours) })
  return t('bodyModel.ago.days', { count: daysOf(hours) })
}

/** E njëjta, e plotë, për fletën: "Stërvitja e fundit para 3 ditësh". */
export function sinceText({ t }: I18n, hours: number | null) {
  if (hours === null) return t('bodyModel.since.none')
  if (hours < 24) return t('bodyModel.since.hours', { count: Math.max(1, hours) })
  return t('bodyModel.since.days', { count: daysOf(hours) })
}

type ModeEntry = Pick<BodyGroup, 'recovery' | 'level' | 'load' | 'hours'>

/**
 * Si shfaqet një grup në pamjen e zgjedhur: klasat dhe toni, vlera me fjalë (figura, modeli) dhe
 * rreshti i listës (`value` djathtas, `detail` para saj).
 */
export function modeStyle(i18n: I18n, mode: BodyMode, entry: ModeEntry): ToneStyle & { text: string; value: string; detail: string } {
  const { t, lang } = i18n
  if (mode === 'volumi') {
    const detail = targetText(i18n, entry.load)
    const value = setsText(i18n, entry.load)
    const text = entry.level === 0 ? value : t('bodyModel.setsStatus', { sets: value, status: detail.toLocaleLowerCase(lang) })
    return { ...LEVEL_STYLE[entry.level], text, value, detail }
  }
  const label = t(`bodyModel.recovery.${entry.recovery}`)
  return { ...RECOVERY_STYLE[entry.recovery], text: label, value: label, detail: agoText(i18n, entry.hours) }
}

/** Karta e muskulit (V53), rreshti i parë: "I lodhur · para 20 orësh". */
export function cardRecovery(i18n: I18n, entry: Pick<BodyGroup, 'recovery' | 'hours'>) {
  const { t, lang } = i18n
  return t('bodyModel.card.recovery', { status: t(`bodyModel.recovery.${entry.recovery}`), ago: agoText(i18n, entry.hours).toLocaleLowerCase(lang) })
}

/** Karta e muskulit, rreshti i dytë: "Këtë javë 14,5 sete · në objektiv" (setet dhe objektivi janë të grupit). */
export function cardWeek(i18n: I18n, entry: Pick<BodyGroup, 'load'>) {
  const { t, lang } = i18n
  return t('bodyModel.card.week', { sets: t('bodyModel.setsInline', { count: entry.load }), status: targetText(i18n, entry.load).toLocaleLowerCase(lang) })
}

/**
 * Karta e muskulit, rreshti që hap fletën: ushtrimi i parë i programit për grupin dhe sa të tjerë ka
 * ("Bench Press" + "dhe 3 të tjera"; veç, që një emër i gjatë të shkurtohet pa e humbur numrin).
 * null kur programi nuk e punon grupin këtë javë.
 */
export function programSummary({ t }: I18n, names: string[]) {
  if (names.length === 0) return null
  return { first: names[0], others: names.length > 1 ? t('bodyModel.card.others', { count: names.length - 1 }) : null }
}

/** "2–8 nëntor"; java mes dy muajve: "26 tetor – 1 nëntor". */
export function weekText({ fmt }: I18n, now: Date) {
  const [start] = weekRange(now)
  const monday = new Date(`${start}T12:00:00`)
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6, 12)
  const last = fmt.date(sunday, { weekday: false })
  return monday.getMonth() === sunday.getMonth() ? `${fmt.number(monday.getDate())}–${last}` : `${fmt.date(monday, { weekday: false })} – ${last}`
}

/** Një shifër pas presjes, si i mat peshorja dhe shiriti: "34,0", "80,4". */
export const oneDecimal = ({ fmt }: I18n, value: number) => fmt.number(value, { minDigits: 1, maxDigits: 1 })

/** Ndryshimi me shenjë: "+0,4", "−0,5", "0,0". */
export const signedDecimal = (i18n: I18n, delta: number) => `${delta > 0 ? '+' : delta < 0 ? '−' : ''}${oneDecimal(i18n, Math.abs(delta))}`

/** Bashkon emrat: "vithet dhe kofshët e pasme", "A, B dhe C". */
export function joinNames({ t }: I18n, names: string[]) {
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} ${t('bodyModel.and')} ${names.at(-1)}`
}

/**
 * Shënimi nën listën e volumit (bordi "Trupi"): java, sa grupe janë mbi, në dhe nën objektiv, dy
 * grupet nën objektiv më afër tij si shembull, dhe burimi i objektivit.
 */
export function volumeNote(i18n: I18n, groups: { id: string; load: number }[], now: Date) {
  const { t, lang } = i18n
  const levels = groups.map((group) => loadLevel(group.load))
  const below = groups.filter((group) => loadLevel(group.load) < 2).sort((a, b) => b.load - a.load)
  const names = below.slice(0, 2).map((group) => muscleName(t, group.id).toLocaleLowerCase(lang))
  const note = t('bodyModel.volumeNote', {
    range: weekText(i18n, now),
    count: groups.length,
    above: levels.filter((level) => level === 3).length,
    within: levels.filter((level) => level === 2).length,
    below: below.length,
    examples: names.length ? t('bodyModel.volumeExamples', { names: joinNames(i18n, names) }) : '',
  })
  return `${note} ${t('bodyModel.targetSource', { min: WEEKLY_TARGET.min, max: WEEKLY_TARGET.max })}`
}

type KeyName = Extract<Parameters<I18n['t']>[0], `bodyModel.key.${string}`>
type RoleKey = Extract<Parameters<I18n['t']>[0], `bodyModel.role.${string}`>

/** Çfarë bën grupi, me një fjali (SPEC §11, "Prek muskulin"). */
export const groupRole = ({ t }: I18n, id: string) => t(`bodyModel.role.${id}` as RoleKey)

/** Emri i një çelësi të modelit (Shtojca D) sipas gjuhës; çelësi vetë kur s'ka emër. */
export function keyName({ t }: I18n, key: string) {
  const text = t(`bodyModel.key.${key}` as KeyName)
  return text === `bodyModel.key.${key}` ? key : text
}
