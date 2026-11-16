import { useState } from 'react'
import { LibraryPicker } from '@/components/forms/library-picker'
import { Sheet } from '@/components/layout/sheet'
import { Button } from '@/components/ui/button'
import { ExercisePhoto } from '@/components/ui/exercise-photo'
import { Icon } from '@/components/ui/icons'
import { store } from '@/data/app-data'
import { replaceExerciseForBlock, type SetRecord, type TrainingSnapshot } from '@/data/training'
import { programBlockName } from '@/i18n/domain'
import { useI18n } from '@/i18n/use-i18n'
import type { HistorySet } from '@/program/loads'
import { sessionBests } from '@/progress/records'
import type { SessionProgress, SlotProgress } from '@/program/session-progress'
import type { PlannedSlot, SessionPlan } from '@/program/types'
import { cn } from '@/lib/cn'
import { rangeText, setsDetail, setValue, targetText } from './session-format'

// Fletët e seancës (bordet "Ushtrimet" dhe, nga 0.41, "Seanca · lista" me miniaturat). Hapen me një
// parametër në adresë (?lista, ?ndrysho, ?shkruaj), që butoni mbrapa i Android-it t'i mbyllë pa dalë nga
// stërvitja. Çdo ushtrim i listës hapet, edhe i bëri, që setet e tij të shihen dhe të ndryshohen (V58).

/** Kufiri i butonave me kontur mbi fletë: `subtle` (dekor), si te bordi; `border` mbi `surface` del pothuajse i padukshëm. */
const SHEET_OUTLINE = 'border-subtle'

export function ExerciseListSheet({
  snapshot,
  progress,
  sets,
  history,
  sessionId,
  elapsed,
  busy,
  onSelect,
  onClose,
  onChange,
  onFinish,
}: {
  snapshot: TrainingSnapshot
  progress: SessionProgress
  /** Setet e seancës, sipas kohës. */
  sets: SetRecord[]
  history: HistorySet[]
  sessionId: string
  /** "24:10" */
  elapsed: string
  busy: boolean
  onSelect: (slotId: string) => void
  onClose: () => void
  onChange: () => void
  onFinish: () => void
}) {
  const { t } = useI18n()
  const [confirm, setConfirm] = useState(false)
  const remaining = progress.totalSets - progress.doneSets
  const records = new Map(sessionBests(history, sessionId).map((record) => [record.exerciseId, record]))

  // "Mbyll stërvitjen" mbetet me kontur derisa të ruhen të gjitha setet, pastaj bëhet veprimi kryesor (§0.3a).
  const footer =
    confirm && remaining > 0 ? (
      <div className="flex flex-col gap-2.5">
        <p className="type-body">{t('session.list.confirm', { count: remaining })}</p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="lg" className={SHEET_OUTLINE} onClick={() => setConfirm(false)}>
            {t('common.cancel')}
          </Button>
          <Button variant="outline" size="lg" className={SHEET_OUTLINE} disabled={busy} onClick={onFinish}>
            {t('session.list.confirmFinish')}
          </Button>
        </div>
      </div>
    ) : (
      <div className="flex flex-col gap-2.5">
        <p className="type-caption text-muted-foreground">{remaining > 0 ? t('session.list.hint', { count: remaining }) : t('session.list.hintDone')}</p>
        <Button
          variant={remaining > 0 ? 'outline' : 'primary'}
          size="lg"
          className={cn('w-full', remaining > 0 && SHEET_OUTLINE)}
          disabled={busy}
          onClick={() => (remaining > 0 ? setConfirm(true) : onFinish())}
        >
          {t('session.finish')}
        </Button>
      </div>
    )

  return (
    <Sheet title={t('session.list.title')} description={t('session.list.summary', { done: progress.doneSets, total: progress.totalSets, elapsed })} onClose={onClose} footer={footer}>
      <ol className="flex flex-col gap-1.5">
        {progress.slots.map((entry, index) => {
          const name = snapshot.exercises[entry.slot.exerciseId]?.name ?? ''
          const slotSets = sets.filter((set) => set.slotId === entry.slot.slotId)
          const libraryId = snapshot.exercises[entry.slot.exerciseId]?.libraryId ?? null
          const select = () => {
            onSelect(entry.slot.slotId)
            onClose()
          }
          if (entry.done >= entry.slot.sets) {
            return (
              <DoneRow
                key={entry.slot.slotId}
                index={index}
                name={name}
                libraryId={libraryId}
                entry={entry}
                sets={slotSets}
                recordKg={records.get(entry.slot.exerciseId)?.e1rmKg ?? null}
                onSelect={select}
              />
            )
          }
          if (index === progress.current) {
            return (
              <CurrentRow
                key={entry.slot.slotId}
                index={index}
                name={name}
                libraryId={libraryId}
                entry={entry}
                last={slotSets.at(-1) ?? null}
                onSelect={onClose}
                onChange={onChange}
              />
            )
          }
          return (
            <PendingRow key={entry.slot.slotId} index={index} name={name} libraryId={libraryId} entry={entry} onSelect={select} />
          )
        })}
      </ol>
    </Sheet>
  )
}

/** "4/4" për syrin, "4 nga 4 sete" për lexuesin e ekranit. */
function SetCount({ entry }: { entry: SlotProgress }) {
  const { t, fmt } = useI18n()
  return (
    <span className="shrink-0 font-display text-lg font-bold text-muted-foreground tabular-nums">
      <span aria-hidden>
        {fmt.number(entry.done)}/{fmt.number(entry.slot.sets)}
      </span>
      <span className="sr-only">{t('session.list.countSpoken', { done: entry.done, sets: entry.slot.sets })}</span>
    </span>
  )
}

/** Miniatura e ushtrimit (bardh e zi, 44 px), me shenjën e të bërit kur setet mbaruan. */
function Thumb({ libraryId, done }: { libraryId: string | null; done: boolean }) {
  const { t } = useI18n()
  return (
    <span className="relative shrink-0">
      <ExercisePhoto libraryId={libraryId} size="square" ground="card" />
      {done ? (
        <span role="img" aria-label={t('session.list.done')} className="absolute -right-1.5 -bottom-1.5 flex size-5 items-center justify-center rounded-pill border-2 border-surface bg-foreground text-background">
          <Icon name="zgjedhur" size={12} />
        </span>
      ) : null}
    </span>
  )
}

function DoneRow({
  index,
  name,
  libraryId,
  entry,
  sets,
  recordKg,
  onSelect,
}: {
  index: number
  name: string
  libraryId: string | null
  entry: SlotProgress
  sets: SetRecord[]
  recordKg: number | null
  onSelect: () => void
}) {
  const texts = useI18n()
  const { t, fmt } = texts
  return (
    <li>
      <button type="button" onClick={onSelect} className="flex min-h-row w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left">
        <span aria-hidden className="w-4 shrink-0 text-center text-sm text-muted-foreground tabular-nums">
          {fmt.number(index + 1)}
        </span>
        <Thumb libraryId={libraryId} done />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="type-body-strong">{name}</span>
        <span className="type-caption text-muted-foreground tabular-nums">{setsDetail(sets, texts)}</span>
        {recordKg ? (
          <span className="flex items-center gap-1.5 type-caption tabular-nums">
            <Icon name="kupa" size={16} className="text-ember-text" />
            {t('session.list.record', { e1rm: fmt.unit(recordKg, 'kg', { maxDigits: 1 }) })}
          </span>
        ) : null}
      </span>
      <SetCount entry={entry} />
      <Icon name="chevron-djathtas" size={18} className="shrink-0 text-muted-foreground" />
      </button>
    </li>
  )
}

function CurrentRow({
  index,
  name,
  libraryId,
  entry,
  last,
  onSelect,
  onChange,
}: {
  index: number
  name: string
  libraryId: string | null
  entry: SlotProgress
  last: SetRecord | null
  onSelect: () => void
  onChange: () => void
}) {
  const texts = useI18n()
  const { t, fmt } = texts
  const range = rangeText(entry.slot.target, fmt) ?? targetText(entry.slot.target, texts)
  return (
    <li className="flex flex-col gap-1 rounded-lg border border-ember-text bg-surface-2 pt-1 pb-3">
      <button type="button" aria-current="step" onClick={onSelect} className="flex min-h-row items-center gap-3 rounded-lg px-3 py-1.5 text-left">
        <span aria-hidden className="w-4 shrink-0 text-center text-sm font-bold text-ember-text tabular-nums">
          {fmt.number(index + 1)}
        </span>
        <Thumb libraryId={libraryId} done={false} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="type-body-strong">{name}</span>
          <span className="text-sm leading-[1.35] font-semibold tabular-nums">{t('session.list.now', { set: entry.done + 1, sets: entry.slot.sets, range })}</span>
          {last ? <span className="type-caption text-muted-foreground tabular-nums">{t('session.list.lastSet', { set: last.setNumber, value: setValue(last, texts, { unit: true }) })}</span> : null}
        </span>
        <SetCount entry={entry} />
      </button>
      <div className="pr-3 pl-[88px]">
        <Button variant="outline" className={SHEET_OUTLINE} onClick={onChange}>
          <Icon name="nderro" size={18} />
          {t('session.list.change')}
        </Button>
      </div>
    </li>
  )
}

function PendingRow({ index, name, libraryId, entry, onSelect }: { index: number; name: string; libraryId: string | null; entry: SlotProgress; onSelect: () => void }) {
  const texts = useI18n()
  const { t, fmt } = texts
  const range = rangeText(entry.slot.target, fmt) ?? targetText(entry.slot.target, texts)
  return (
    <li>
      <button type="button" onClick={onSelect} className="flex min-h-row w-full items-center gap-3 rounded-lg px-3 py-1.5 text-left">
        <span aria-hidden className="w-4 shrink-0 text-center text-sm text-muted-foreground tabular-nums">
          {fmt.number(index + 1)}
        </span>
        <Thumb libraryId={libraryId} done={false} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="type-body-strong">{name}</span>
          <span className="type-caption text-muted-foreground tabular-nums">
            {t('session.sets', { count: entry.slot.sets })} · {range}
          </span>
        </span>
        {entry.done > 0 ? <SetCount entry={entry} /> : null}
      </button>
    </li>
  )
}

/** "Ndrysho ushtrimin për këtë fazë" (§6): nga seanca, pa dalë nga stërvitja; edhe nga Programi. */
export function ChangeExerciseSheet({ plan, slot, exerciseName, onClose }: { plan: SessionPlan; slot: PlannedSlot; exerciseName: string; onClose: () => void }) {
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  return (
    <Sheet title={t('session.change.title')} onClose={onClose}>
      <p className="type-body text-muted-foreground">{t('session.change.text', { exercise: exerciseName, block: programBlockName(t, plan.blockName) })}</p>
      <LibraryPicker
        busy={busy}
        onPick={(item) => {
          setBusy(true)
          void replaceExerciseForBlock(store, { plan, slotId: slot.slotId, library: item }).then(onClose)
        }}
      />
    </Sheet>
  )
}
