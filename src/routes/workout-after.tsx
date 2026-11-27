import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { BackHeader } from '@/components/layout/page'
import { Button } from '@/components/ui/button'
import { inputClass } from '@/components/ui/field-styles'
import { Icon } from '@/components/ui/icons'
import { surfaceClass } from '@/components/ui/surface'
import { store, useLocalQuery } from '@/data/app-data'
import { type AfterRow, type AfterSet, saveWorkoutAfter, validAfterSet, workoutAfter, type WorkoutAfter } from '@/data/workout-after'
import { programDayName } from '@/i18n/domain'
import { useI18n } from '@/i18n/use-i18n'
import { localDate, shiftDate } from '@/lib/calendar'
import { cn } from '@/lib/cn'
import { EditorFooter } from './builder-parts'
import { dotted, setsText } from './programme-format'

// "E bëra, po e shënoj" (V74, V75; bordi "4 · Regjistro pas stërvitjes" te kanavaca "Vrull - Propozimi UX"): e gjithë
// stërvitja e radhës në një tabelë, për kë i shënon setet pas palestrës. Çdo ushtrim është një rresht me peshën dhe
// përsëritjet e herës së kaluar dhe me "Bërë" të ndezur; ndryshohet vetëm çfarë ndryshoi. Kur setet janë njësoj,
// një fushë i ndryshon të gjitha; "Setet veç e veç" i hap një nga një. Ruajtja mbyll stërvitjen sot ose dje.

/** Vlerat e një seti siç shkruhen te fushat. */
interface Draft {
  weight: string
  reps: string
}

interface RowState {
  done: boolean
  open: boolean
  sets: Draft[]
}

/** Numër nga fusha: presja dhe pika vlejnë të dyja; bosh ose i pavlefshëm = null. */
function parse(text: string, max: number): number | null {
  const value = Number(text.trim().replace(',', '.'))
  return text.trim() !== '' && Number.isFinite(value) && value >= 0 && value <= max ? value : null
}

const uniform = (sets: readonly Draft[]) => sets.every((set) => set.weight === sets[0].weight && set.reps === sets[0].reps)

export function WorkoutAfterPage() {
  const { t } = useI18n()
  const view = useLocalQuery(() => workoutAfter(store), [])
  if (view === undefined) {
    return (
      <div className="flex flex-col gap-4">
        <BackHeader title={t('after.title')} fallback="/programi" back={t('after.back')} />
        <div aria-hidden className="h-24 rounded-lg bg-surface" />
        <div aria-hidden className="h-24 rounded-lg bg-surface" />
      </div>
    )
  }
  if (view === null) {
    return (
      <div className="flex flex-col gap-4">
        <BackHeader title={t('after.title')} fallback="/programi" back={t('after.back')} />
        <p className="type-body text-muted-foreground">{t('after.none')}</p>
      </div>
    )
  }
  return <AfterForm view={view} />
}

function AfterForm({ view }: { view: WorkoutAfter }) {
  const { t, fmt } = useI18n()
  const navigate = useNavigate()
  const text = (value: number | null) => (value === null ? '' : fmt.number(value))
  const initial = useMemo<RowState[]>(
    () =>
      view.rows.map((row) => {
        const sets = row.sets.map((set) => ({ weight: text(set.weightKg), reps: text(row.exercise.tracking === 'timed' ? set.seconds : set.reps) }))
        return { done: true, open: !uniform(sets), sets }
      }),
    // Vlerat fillestare lexohen një herë: një rilexim i bazës nuk i prish ato që po shkruhen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const [rows, setRows] = useState(initial)
  const [yesterday, setYesterday] = useState(false)
  const [busy, setBusy] = useState(false)

  const values = (row: AfterRow, state: RowState): AfterSet[] =>
    state.sets.map((set) => {
      const amount = parse(set.reps, 999)
      return { weightKg: row.exercise.tracking === 'weight_reps' ? parse(set.weight, 999) : null, reps: row.exercise.tracking === 'timed' ? null : amount, seconds: row.exercise.tracking === 'timed' ? amount : null }
    })
  const invalid = (index: number) => rows[index].done && values(view.rows[index], rows[index]).some((set) => !validAfterSet(set, view.rows[index].exercise.tracking))
  const done = rows.filter((row) => row.done).length
  const changed = rows.filter((row, index) => row.done && JSON.stringify(row.sets) !== JSON.stringify(initial[index].sets)).length
  const missing = rows.filter((_, index) => invalid(index)).length

  const update = (index: number, change: (row: RowState) => RowState) => setRows((current) => current.map((row, at) => (at === index ? change(row) : row)))
  const setField = (index: number, set: number | null, field: keyof Draft, value: string) =>
    update(index, (row) => ({ ...row, sets: row.sets.map((entry, at) => (set === null || at === set ? { ...entry, [field]: value } : entry)) }))

  async function save() {
    if (busy || done === 0 || missing > 0) return
    setBusy(true)
    try {
      const today = localDate(store.now())
      const picked = view.rows.flatMap((row, index) => (rows[index].done ? [{ ...row, sets: values(row, rows[index]) }] : []))
      const sessionId = await saveWorkoutAfter(store, yesterday ? shiftDate(today, -1) : today, picked)
      if (sessionId) navigate(`/seanca/mbyllja/${sessionId}`, { replace: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-3">
      <BackHeader title={t('after.title')} subtitle={dotted([t('programme.workout', { number: view.dayNumber }), programDayName(t, view.dayName)])} fallback="/programi" back={t('after.back')} />
      <p className="type-body text-muted-foreground">{t(view.rows.some((row) => row.source === 'last') ? 'after.intro' : 'after.introFirst')}</p>

      <div role="group" aria-label={t('after.when')} className="grid grid-cols-2 gap-2">
        {[false, true].map((value) => (
          <Button key={String(value)} variant={yesterday === value ? 'secondary' : 'outline'} aria-pressed={yesterday === value} className="normal-case" onClick={() => setYesterday(value)}>
            {t(value ? 'after.yesterday' : 'after.today')}
          </Button>
        ))}
      </div>

      <ul className="flex flex-col gap-2">
        {view.rows.map((row, index) => {
          const state = rows[index]
          const weighted = row.exercise.tracking === 'weight_reps'
          const amountLabel = row.exercise.tracking === 'timed' ? t('after.seconds') : t('after.reps')
          const name = row.exercise.name
          return (
            <li key={row.slot.slotId} className={cn(surfaceClass, 'flex flex-col gap-2 rounded-lg p-3', state.done ? null : 'opacity-60')}>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={state.done}
                  aria-label={t('after.done', { exercise: name })}
                  onClick={() => update(index, (current) => ({ ...current, done: !current.done }))}
                  className={cn(
                    'flex size-touch shrink-0 items-center justify-center rounded-md border-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground',
                    state.done ? 'border-foreground bg-foreground text-background' : 'border-subtle text-transparent',
                  )}
                >
                  <Icon name="zgjedhur" size={22} />
                </button>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="type-body-strong">{name}</span>
                  <span className="type-caption text-muted-foreground tabular-nums">{setsText(fmt, row.slot.sets, row.slot.target)}</span>
                </div>
              </div>
              {state.done ? (
                <>
                  {(state.open ? state.sets.map((_, set) => set) : [null]).map((set) => {
                    const draft = state.sets[set ?? 0]
                    const which = set === null ? name : t('after.setOf', { exercise: name, set: set + 1 })
                    return (
                      <div key={set ?? 'all'} className="flex items-center gap-2">
                        <span className="w-14 shrink-0 type-caption text-muted-foreground tabular-nums">{set === null ? t('after.allSets', { count: state.sets.length }) : t('session.setLabel', { set: String(set + 1) })}</span>
                        {weighted ? (
                          <label className="flex min-w-0 flex-1 items-center gap-1.5">
                            <input
                              inputMode="decimal"
                              aria-label={t('after.weightFor', { exercise: which })}
                              aria-invalid={parse(draft.weight, 999) === null || parse(draft.weight, 999) === 0 || undefined}
                              value={draft.weight}
                              onChange={(event) => setField(index, set, 'weight', event.target.value)}
                              className={cn(inputClass, 'min-w-0 px-2 text-center font-display text-xl font-extrabold')}
                            />
                            <span className="type-caption text-muted-foreground">kg</span>
                          </label>
                        ) : null}
                        <label className="flex min-w-0 flex-1 items-center gap-1.5">
                          <input
                            inputMode="numeric"
                            aria-label={t('after.amountFor', { amount: amountLabel, exercise: which })}
                            aria-invalid={!parse(draft.reps, 999) || undefined}
                            value={draft.reps}
                            onChange={(event) => setField(index, set, 'reps', event.target.value)}
                            className={cn(inputClass, 'min-w-0 px-2 text-center font-display text-xl font-extrabold')}
                          />
                          <span className="type-caption text-muted-foreground">{row.exercise.tracking === 'timed' ? 's' : t('after.repsShort')}</span>
                        </label>
                      </div>
                    )
                  })}
                  {state.sets.length > 1 ? (
                    <button
                      type="button"
                      aria-expanded={state.open}
                      onClick={() => update(index, (current) => ({ ...current, open: !current.open }))}
                      className="min-h-touch self-start rounded-md text-sm font-medium text-muted-foreground underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
                    >
                      {t(state.open ? 'after.together' : 'after.perSet')}
                    </button>
                  ) : null}
                </>
              ) : null}
            </li>
          )
        })}
      </ul>

      <EditorFooter>
        <p aria-live="polite" className="type-caption text-muted-foreground tabular-nums">
          {missing > 0 ? t('after.missing', { count: missing }) : dotted([t('after.count', { done, total: rows.length }), changed > 0 ? t('after.changed', { count: changed }) : null])}
        </p>
        <Button variant="primary" size="xl" className="w-full" disabled={busy || done === 0 || missing > 0} onClick={() => void save()}>
          {t('after.save')}
        </Button>
      </EditorFooter>
    </div>
  )
}
