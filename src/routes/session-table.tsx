import type { ReactNode } from 'react'
import { Icon } from '@/components/ui/icons'
import type { SetRecord } from '@/data/training'
import type { Format } from '@/i18n'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import type { SetRow } from '@/program/set-table'
import type { Target, Tracking } from '@/program/types'
import { editable, previousText, setValue, targetShort } from './session-format'

// Tabela e seteve të seancës (SPEC §0.3g, V58; bordet "Seanca · seti 1", "· seti 3", "Ndrysho",
// "Pushimi · Zhbëj"): një rresht për çdo set, me "Herën e kaluar", kg, përsëritjet dhe ✓. Rreshti aktiv
// është karta e madhe që jep prindi (stepper-i); te pushimi është një rresht i theksuar me "tani". Setet e
// ruajtura janë rreshta të ulët që preken për t'u ndryshuar (rekordi me kupën, në `insight`); setet që vijnë
// tregojnë synimin. Rreshtat vijnë nga `program/set-table.ts`.

/** Përsëritjet e një seti të ruajtur me segmentet: "6+5". */
const repsWithSegments = (set: SetRecord, fmt: Format) => `${fmt.number(set.reps ?? 0)}${set.segments.map((segment) => `+${fmt.number(segment.reps)}`).join('')}`

const COLUMNS = {
  weighted: 'grid-cols-[46px_minmax(0,1fr)_58px_minmax(52px,64px)_32px]',
  timed: 'grid-cols-[46px_minmax(0,1fr)_minmax(64px,80px)_32px]',
}

export function SetTable({
  rows,
  tracking,
  target,
  records,
  dropTo,
  restPauseSeconds,
  active,
  compact = false,
  onEdit,
  className,
}: {
  rows: SetRow<SetRecord>[]
  tracking: Tracking
  target: Target
  /** Setet që ishin rekord në kohën e tyre (`sessionSetRecords`). */
  records: ReadonlyMap<string, unknown>
  /** Pesha e drop set-it, kur dihet ("Pastaj 52,5 kg, pa pushim"). */
  dropTo: number | null
  restPauseSeconds: number | null
  /** Karta e rreshtit aktiv (stepper-i); pa të rreshti aktiv del si rresht i theksuar me "tani". */
  active?: ReactNode
  /** Te pushimi: rreshta më të ngjeshur brenda kartës. */
  compact?: boolean
  onEdit?: (set: SetRecord) => void
  className?: string
}) {
  const { t } = useI18n()
  const timed = tracking === 'timed'
  const columns = timed ? COLUMNS.timed : COLUMNS.weighted
  return (
    <section aria-label={t('session.table.title')} className={cn('flex flex-col', className)}>
      <div aria-hidden className={cn('grid items-center gap-x-2 px-2 pb-1.5 text-xs leading-tight font-semibold text-muted-foreground', columns)}>
        <span>{t('session.table.set')}</span>
        <span className="truncate">{t('session.table.previous')}</span>
        {timed ? null : <span>{t('session.table.kg')}</span>}
        <span className="truncate">{timed ? t('session.table.seconds') : t('session.table.reps')}</span>
        <span className="flex justify-center">
          <Icon name="zgjedhur" size={14} />
        </span>
      </div>
      <ol className={cn('flex flex-col', compact ? 'gap-0.5' : 'gap-1')}>
        {rows.map((row) =>
          row.state === 'active' && active ? (
            <li key={row.setNumber} aria-current="step">
              {active}
            </li>
          ) : (
            <TableRow
              key={row.setNumber}
              row={row}
              tracking={tracking}
              target={target}
              columns={columns}
              record={row.saved ? records.has(row.saved.id) : false}
              note={row.state === 'saved' ? null : techniqueNote(row, dropTo, restPauseSeconds)}
              compact={compact}
              onEdit={onEdit}
            />
          ),
        )}
      </ol>
    </section>
  )
}

/** "Pastaj 52,5 kg, pa pushim" nën setin e fundit me drop set, ose rest-pause me pushimin e vet. */
function techniqueNote(row: SetRow<SetRecord>, dropTo: number | null, restPauseSeconds: number | null) {
  if (row.technique === 'drop_set') return { kind: 'drop' as const, dropTo }
  if (row.technique === 'rest_pause') return { kind: 'restPause' as const, seconds: restPauseSeconds ?? 15 }
  return null
}

function TableRow({
  row,
  tracking,
  target,
  columns,
  record,
  note,
  compact,
  onEdit,
}: {
  row: SetRow<SetRecord>
  tracking: Tracking
  target: Target
  columns: string
  record: boolean
  note: ReturnType<typeof techniqueNote>
  compact: boolean
  onEdit?: (set: SetRecord) => void
}) {
  const texts = useI18n()
  const { t, fmt } = texts
  const { saved, state } = row
  const timed = tracking === 'timed'
  const now = state === 'active'
  const previous = previousText(row.previous, tracking, fmt)
  const tag = record ? t('session.chip.record') : now ? t('session.chip.now') : techniqueTag(row, t)
  const big = 'font-display text-xl leading-none font-bold tabular-nums'
  const muted = !saved || now
  const weight = row.weightKg ? fmt.number(row.weightKg) : '–'
  let reps: string
  if (saved && !now) reps = timed ? fmt.unit(saved.seconds ?? 0, 's') : repsWithSegments(saved, fmt)
  else reps = targetShort(target, fmt)

  const grid = (
    <span aria-hidden className={cn('grid w-full items-center gap-x-2 text-left', columns)}>
      <span className="flex min-w-0 flex-col">
        <span className={cn('flex items-center gap-1', record ? 'text-ember-text' : muted ? 'text-muted-foreground' : 'text-foreground')}>
          {record ? <Icon name="kupa" size={14} /> : null}
          <span className={cn(big, now ? 'text-foreground' : null)}>{fmt.number(row.setNumber)}</span>
        </span>
        {tag ? <span className={cn('truncate text-[11px] leading-tight', record ? 'font-semibold text-ember-text' : 'text-muted-foreground')}>{tag}</span> : null}
      </span>
      <span className="truncate text-[13px] leading-[1.35] text-muted-foreground tabular-nums">{previous ?? '–'}</span>
      {timed ? null : <span className={cn(big, muted ? 'text-muted-foreground' : 'text-foreground')}>{weight}</span>}
      <span className={cn(big, 'truncate', muted ? 'text-muted-foreground' : 'text-foreground')}>{reps}</span>
      <span className="flex justify-center">
        {saved && !now ? (
          <span className="flex size-7 items-center justify-center rounded-pill bg-foreground text-background">
            <Icon name="zgjedhur" size={16} />
          </span>
        ) : (
          <span className={cn('size-7 rounded-pill border-2', now ? 'border-muted-foreground' : 'border-subtle')} />
        )}
      </span>
    </span>
  )
  const noteText = note
    ? note.kind === 'drop'
      ? note.dropTo
        ? t('session.table.dropTo', { weight: fmt.unit(note.dropTo, 'kg') })
        : t('session.table.dropSet')
      : t('session.table.restPause', { seconds: note.seconds })
    : null
  const look = cn(
    'flex w-full flex-col justify-center gap-1 rounded-md px-2',
    compact ? 'min-h-11 py-1.5' : 'min-h-12 py-2',
    record && !now ? 'border border-insight-border bg-insight' : null,
    now ? 'border-2 border-ember-text' : null,
  )
  const body = (
    <>
      {grid}
      {noteText ? <span className="pl-[54px] type-caption text-muted-foreground tabular-nums">{noteText}</span> : null}
    </>
  )

  if (saved && !now && onEdit && editable(saved)) {
    return (
      <li>
        <button
          type="button"
          aria-label={t(record ? 'session.chip.editRecord' : 'session.chip.edit', { set: row.setNumber, value: setValue(saved, texts, { unit: true }) })}
          onClick={() => onEdit(saved)}
          className={cn(look, 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground')}
        >
          {body}
        </button>
      </li>
    )
  }
  const spoken = saved && !now ? `${t('session.setLabel', { set: row.setNumber })}: ${setValue(saved, texts)}` : t('session.table.upcoming', { set: row.setNumber, target: row.weightKg && !timed ? `${weight} × ${targetShort(target, fmt)}` : targetShort(target, fmt) })
  return (
    <li className={look}>
      <span className="sr-only">{spoken}</span>
      {body}
    </li>
  )
}

function techniqueTag(row: SetRow<SetRecord>, t: ReturnType<typeof useI18n>['t']) {
  if (row.technique === 'drop_set') return t('session.chip.dropSet')
  if (row.technique === 'rest_pause') return t('session.chip.restPause')
  if (row.technique === 'to_failure') return t('session.table.toFailure')
  return null
}
