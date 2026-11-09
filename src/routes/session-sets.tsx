import { Icon } from '@/components/ui/icons'
import { surfaceClass } from '@/components/ui/surface'
import type { SetRecord } from '@/data/training'
import type { Format } from '@/i18n'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import type { PlannedSlot, Target, Technique } from '@/program/types'
import { editable, rangeText, setValue } from './session-format'

// Setet e ushtrimit te seanca (0.23, SPEC §0.3c; bordet "Seanca" dhe "Pushimi · banderola e rekordit"):
// çipat sipër setit (i ruajturi me vlerën, rekordi i dalluar, i tanishmi me vijë, të tjerët me synimin)
// dhe rreshtat e seteve të ruajtura te pushimi me etiketën "rekord". Prekja e një seti të ruajtur hap
// fletën "Ndrysho setin" (`set-edit-sheet.tsx`). Rekordi i çdo seti është ai i e1RM-së në kohën e vet
// (`recordsAtTheTime`), si te historiku, te mbyllja dhe te fleta.

/** Vlera e shkurtër e çipit: "62,5 × 12", "62,5 × 12+4", "60 s". */
function chipValue(set: SetRecord, fmt: Format) {
  if (set.seconds !== null && set.reps === null) return fmt.unit(set.seconds, 's')
  const reps = `${fmt.number(set.reps ?? 0)}${set.segments.map((segment) => `+${fmt.number(segment.reps)}`).join('')}`
  return set.weightKg ? `${fmt.number(set.weightKg)} × ${reps}` : reps
}

/** Synimi i një seti që vjen: "9–11", "12+", "60 s"; përsëritjet e lira me vizë. */
function chipTarget(target: Target, fmt: Format) {
  if (target.kind === 'timed') return fmt.unit(target.seconds, 's')
  if (target.kind === 'reps' && target.min === 0 && target.max === null) return '–'
  return rangeText(target, fmt) ?? '–'
}

function techniqueKey(technique: Technique) {
  if (technique.type === 'rest_pause') return 'session.chip.restPause' as const
  if (technique.type === 'drop_set') return 'session.chip.dropSet' as const
  return null
}

/**
 * Çipat e seteve (bordi "Seanca"): një për çdo set të slotit, deri në katër në rresht. I ruajturi tregon
 * peshën × përsëritjet dhe preket për ta ndryshuar; me rekord në `insight` me kupën; i tanishmi ka vijën
 * 2 px `ember-text` dhe "tani"; ata që vijnë synimin. Seti i fundit me rest-pause ose drop set e thotë.
 */
export function SetChips({
  slot,
  sets,
  current,
  records,
  onEdit,
}: {
  slot: PlannedSlot
  /** Setet e ruajtura të slotit në këtë seancë. */
  sets: SetRecord[]
  /** Seti në ekran (edhe kur pret segmentin). */
  current: number
  records: ReadonlyMap<string, unknown>
  onEdit: (set: SetRecord) => void
}) {
  const texts = useI18n()
  const { t, fmt } = texts
  const technique = techniqueKey(slot.technique)
  const numbers = Array.from({ length: Math.max(slot.sets, current) }, (_, index) => index + 1)
  return (
    <ol aria-label={t('session.chips')} className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(numbers.length, 4)}, minmax(0, 1fr))` }}>
      {numbers.map((number) => {
        const saved = sets.find((set) => set.setNumber === number)
        const record = saved ? records.has(saved.id) : false
        const tag = number === slot.sets && technique ? t(technique) : null
        const chip = 'flex h-14 w-full min-w-0 flex-col items-center justify-center gap-0.5 rounded-md px-1'
        const value = 'max-w-full truncate font-display text-lg leading-tight font-bold whitespace-nowrap tabular-nums'
        const label = 'flex max-w-full items-center gap-1 truncate text-xs leading-tight'
        if (number === current) {
          return (
            <li key={number} aria-current="step" className={cn(chip, 'border-2 border-ember-text')}>
              <span className={cn(label, 'font-semibold')}>
                {fmt.number(number)} · {t('session.chip.now')}
              </span>
              <span className={cn(value, saved ? 'text-foreground' : 'text-muted-foreground')}>{saved ? chipValue(saved, fmt) : chipTarget(slot.target, fmt)}</span>
            </li>
          )
        }
        if (saved) {
          const content = (
            <>
              <span className={cn(label, record ? 'font-semibold text-ember-text' : 'text-muted-foreground')}>
                <Icon name={record ? 'kupa' : 'zgjedhur'} size={12} />
                {fmt.number(number)}
                {record ? ` · ${t('session.chip.record')}` : tag ? ` · ${tag}` : null}
              </span>
              <span className={cn(value, 'text-foreground')}>{chipValue(saved, fmt)}</span>
            </>
          )
          const look = record ? 'border border-insight-border bg-insight' : surfaceClass
          return (
            <li key={number}>
              {editable(saved) ? (
                <button
                  type="button"
                  aria-label={t(record ? 'session.chip.editRecord' : 'session.chip.edit', { set: number, value: setValue(saved, texts, { unit: true }) })}
                  onClick={() => onEdit(saved)}
                  className={cn(chip, look)}
                >
                  {content}
                </button>
              ) : (
                <div className={cn(chip, look)}>{content}</div>
              )}
            </li>
          )
        }
        return (
          <li key={number} className={cn(chip, surfaceClass)}>
            <span className={cn(label, 'text-muted-foreground')}>
              {fmt.number(number)}
              {tag ? ` · ${tag}` : null}
            </span>
            <span className={cn(value, 'text-muted-foreground')}>{chipTarget(slot.target, fmt)}</span>
          </li>
        )
      })}
    </ol>
  )
}

/**
 * Setet e ruajtura të ushtrimit te pushimi (bordi "Pushimi"): më i riu sipër, "Seti 2 · 22,5 × 9", etiketa
 * "rekord" kur seti ishte rekord, dhe "Ndrysho" 44 px që hap fletën e setit. Pushimi nuk ndalet.
 */
export function SavedSets({ sets, records, onEdit }: { sets: SetRecord[]; records: ReadonlyMap<string, unknown>; onEdit: (set: SetRecord) => void }) {
  const texts = useI18n()
  const { t } = texts
  if (sets.length === 0) return null
  return (
    <section aria-label={t('session.saved.title')} className="flex flex-col divide-y divide-border border-y border-border">
      {[...sets].reverse().map((set) => (
        <div key={set.id} className="flex min-h-12 items-center justify-between gap-2">
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-sm leading-[1.35]">
            <span className="text-muted-foreground">{t('session.setLabel', { set: set.setNumber })}</span>
            <span className="tabular-nums">{setValue(set, texts)}</span>
            {records.has(set.id) ? (
              <span className="flex h-[22px] items-center rounded-[6px] border border-insight-border px-[7px] text-xs font-semibold text-ember-text">{t('session.chip.record')}</span>
            ) : null}
          </span>
          {editable(set) ? (
            <button
              type="button"
              aria-label={t('session.saved.editLabel', { set: set.setNumber, value: setValue(set, texts, { unit: true }) })}
              onClick={() => onEdit(set)}
              className="h-touch min-w-touch shrink-0 rounded-sm px-1 text-sm leading-[1.35] font-semibold underline underline-offset-[3px]"
            >
              {t('session.saved.edit')}
            </button>
          ) : null}
        </div>
      ))}
    </section>
  )
}
