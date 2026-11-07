import { useEffect, useId, useState } from 'react'
import { Sheet } from '@/components/layout/sheet'
import { Button } from '@/components/ui/button'
import { inputClass } from '@/components/ui/field-styles'
import { store } from '@/data/app-data'
import { replaceExerciseForBlock, type TrainingSnapshot } from '@/data/training'
import { type LibraryExercise, loadLibrary, searchLibrary } from '@/program/library'
import type { SessionProgress } from '@/program/session-progress'
import type { Equipment, PlannedSlot, SessionPlan } from '@/program/types'
import { cn } from '@/lib/cn'
import { setsText } from './training-format'

// Fletët e seancës. Hapen me një parametër në adresë (?lista, ?ndrysho), që butoni mbrapa i
// Android-it t'i mbyllë pa dalë nga stërvitja.

export function ExerciseListSheet({
  snapshot,
  progress,
  onSelect,
  onClose,
  onChange,
  onFinish,
}: {
  snapshot: TrainingSnapshot
  progress: SessionProgress
  onSelect: (slotId: string) => void
  onClose: () => void
  onChange: () => void
  onFinish: () => void
}) {
  const [confirmFinish, setConfirmFinish] = useState(false)
  const unfinished = progress.totalSets - progress.doneSets
  return (
    <Sheet title="Ushtrimet e sotme" onClose={onClose}>
      <ol className="flex flex-col">
        {progress.slots.map((entry, index) => {
          const done = entry.done >= entry.slot.sets
          return (
            <li key={entry.slot.slotId} className="border-t border-border-subtle first:border-t-0">
              <button
                type="button"
                disabled={done}
                onClick={() => {
                  onSelect(entry.slot.slotId)
                  onClose()
                }}
                aria-current={index === progress.current ? 'step' : undefined}
                className={cn('flex min-h-14 w-full items-center gap-3 text-left tabular-nums', done && 'text-muted-foreground')}
              >
                <span className="w-5 text-sm leading-5 text-muted-foreground">{index + 1}</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className={cn('text-base leading-6', index === progress.current && 'font-semibold')}>
                    {snapshot.exercises[entry.slot.exerciseId]?.name}
                  </span>
                  <span className="text-xs leading-4 text-muted-foreground">{setsText(entry.slot.sets, entry.slot.target)}</span>
                </span>
                <span className="text-sm leading-5 text-muted-foreground">{done ? 'Bërë' : `${entry.done} nga ${entry.slot.sets}`}</span>
              </button>
            </li>
          )
        })}
      </ol>
      {progress.current === null ? null : (
        <Button variant="outline" onClick={onChange}>
          Ndrysho ushtrimin për këtë fazë
        </Button>
      )}
      {confirmFinish ? (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
          <p className="text-sm leading-5">
            {unfinished > 0 ? `Mbeten ${unfinished} sete pa bërë. Stërvitja mbyllet me ato që ke regjistruar.` : 'Stërvitja mbyllet.'}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => setConfirmFinish(false)}>
              Anulo
            </Button>
            <Button variant="outline" onClick={onFinish}>
              Mbyll
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="ghost" onClick={() => setConfirmFinish(true)}>
          Mbyll stërvitjen
        </Button>
      )}
    </Sheet>
  )
}

const EQUIPMENT: Record<Equipment, string> = {
  barbell: 'Shufër',
  ez_bar: 'Shufër EZ',
  dumbbell: 'Dumbbell',
  cable: 'Kabëll',
  machine: 'Makineri',
  bodyweight: 'Pesha e trupit',
  kettlebell: 'Kettlebell',
  band: 'Llastik',
  other: 'Tjetër',
}

export function ChangeExerciseSheet({
  plan,
  slot,
  exerciseName,
  onClose,
}: {
  plan: SessionPlan
  slot: PlannedSlot
  exerciseName: string
  onClose: () => void
}) {
  const [library, setLibrary] = useState<LibraryExercise[] | null>(null)
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const searchId = useId()
  useEffect(() => {
    let cancelled = false
    void loadLibrary().then((items) => {
      if (!cancelled) setLibrary(items)
    })
    return () => {
      cancelled = true
    }
  }, [])
  const results = library ? searchLibrary(library, query).slice(0, 40) : []
  return (
    <Sheet title="Ndrysho ushtrimin" onClose={onClose}>
      <p className="text-sm leading-5 text-muted-foreground">
        Zëvendëson {exerciseName} në {plan.blockName}. Fazat e tjera dhe seancat e kaluara nuk ndryshojnë.
      </p>
      <label htmlFor={searchId} className="text-sm leading-5 font-medium">
        Kërko ushtrimin
      </label>
      <input
        id={searchId}
        type="search"
        autoComplete="off"
        value={query}
        onChange={(event) => setQuery(event.currentTarget.value)}
        className={cn(inputClass, 'appearance-none')}
      />
      {library === null ? (
        <p className="text-sm leading-5 text-muted-foreground">Po ngarkohet biblioteka</p>
      ) : results.length === 0 ? (
        <p className="text-sm leading-5 text-muted-foreground">Asnjë ushtrim me këtë emër</p>
      ) : (
        <ul className="flex flex-col">
          {results.map((item) => (
            <li key={item.id} className="border-t border-border-subtle first:border-t-0">
              <button
                type="button"
                disabled={busy}
                className="flex min-h-12 w-full items-center gap-3 text-left"
                onClick={() => {
                  setBusy(true)
                  void replaceExerciseForBlock(store, { plan, slotId: slot.slotId, library: item }).then(onClose)
                }}
              >
                <span className="flex-1 text-base leading-6">{item.name}</span>
                <span className="text-xs leading-4 text-muted-foreground">{EQUIPMENT[item.equipment]}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  )
}
