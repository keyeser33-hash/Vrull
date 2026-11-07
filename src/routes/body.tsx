import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { BodyFigure } from '@/components/body/body-figure'
import { Group, Row } from '@/components/layout/list-group'
import { Sheet } from '@/components/layout/sheet'
import { store, useLocalQuery } from '@/data/app-data'
import { type BodyGroup, bodyView } from '@/data/body'
import { libraryExercisesFor, LOAD_LEVELS } from '@/body/body-map'
import { type LibraryExercise, loadLibrary } from '@/program/library'
import { MUSCLE_GROUPS } from '@/program/muscles'
import { buttonVariants } from '@/components/ui/button-variants'
import { cn } from '@/lib/cn'
import { webglAvailable } from '@/lib/webgl'
import { type BodyMode, LEVEL_SWATCH, modeStyle, RECOVERY, RECOVERY_ORDER, setsText, sinceText } from './body-format'
import { EQUIPMENT_LABEL } from './training-format'

// Trupi (SPEC §11, TH-19). Paneli tregon rikuperimin ose volumin e javës mbi figurën 2D përpara dhe
// mbrapa, ose mbi modelin 3D (TH-05) kur WebView-i e vizaton; zgjedhja mbahet në këtë telefon.
// Legjenda është me fjalë dhe lista poshtë ka të njëjtat vlera për çdo grup. Një grup (në listë, në
// figurë ose në model) hapet në fletë (?muskuli=id).

type View = '2d' | '3d'

const BodyModel = lazy(() => import('@/components/body/body-model'))
const VIEW_KEY = 'th-body-view'

function readView(): View {
  try {
    return window.localStorage.getItem(VIEW_KEY) === '3d' && webglAvailable() ? '3d' : '2d'
  } catch {
    return '2d'
  }
}

function saveView(view: View) {
  try {
    window.localStorage.setItem(VIEW_KEY, view)
  } catch {
    // Pa ruajtje (p.sh. modalitet privat) zgjedhja vlen vetëm për këtë vizitë.
  }
}

const groupOf = (keys: string[]) => MUSCLE_GROUPS.find((group) => keys.some((key) => group.keys.includes(key)))

export function BodyPage() {
  const [now] = useState(() => new Date())
  const groups = useLocalQuery(() => bodyView(store, now), [])
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const mode: BodyMode = params.get('pamja') === 'volumi' ? 'volumi' : 'rikuperimi'
  const [view, setView] = useState<View>(readView)
  const [back, setBack] = useState(false)
  const choose = (next: View) => {
    setView(next)
    saveView(next)
  }
  const byId = useMemo(() => new Map((groups ?? []).map((entry) => [entry.group.id, entry])), [groups])
  // Ngjyra e çdo çelësi te modeli 3D; funksion i ri vetëm kur ndryshojnë të dhënat ose pamja.
  const entryOf = useCallback((keys: string[]) => byId.get(groupOf(keys)?.id ?? ''), [byId])
  const paintKey = useCallback(
    (key: string) => {
      const entry = entryOf([key])
      return entry ? modeStyle(mode, entry).tone : null
    },
    [entryOf, mode],
  )
  if (!groups) {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="sr-only">Trupi</h1>
        <div aria-hidden className="h-[480px] rounded-xl bg-skeleton" />
      </div>
    )
  }
  const open = (id: string) => setParams((current) => (current.set('muskuli', id), current))
  const pick = (keys: string[]) => {
    const group = groupOf(keys)
    if (group) open(group.id)
  }
  const mapLabel = mode === 'volumi' ? 'Volumi i javës sipas muskujve' : 'Rikuperimi sipas muskujve'
  const setMode = (next: BodyMode) => setParams((current) => (current.set('pamja', next), current), { replace: true })
  const opened = byId.get(params.get('muskuli') ?? '')
  const sorted = [...groups].sort((a, b) =>
    mode === 'volumi' ? b.load - a.load || a.group.name.localeCompare(b.group.name) : RECOVERY_ORDER.indexOf(a.recovery) - RECOVERY_ORDER.indexOf(b.recovery) || (a.hours ?? 1e9) - (b.hours ?? 1e9),
  )

  return (
    <div className="flex flex-col gap-5">
      <h1 className="sr-only">Trupi</h1>
      <section aria-label="Harta e trupit" className="flex flex-col gap-4 rounded-xl border border-panel-border bg-panel p-4 text-panel-foreground">
        <div role="group" aria-label="Pamja e hartës" className="grid grid-cols-2 gap-1 rounded-full bg-panel-button p-1">
          {(
            [
              ['rikuperimi', 'Rikuperimi'],
              ['volumi', 'Volumi javor'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              onClick={() => setMode(value)}
              className={cn('h-11 rounded-full text-sm font-semibold', mode === value ? 'bg-panel-foreground text-panel' : 'text-panel-foreground')}
            >
              {label}
            </button>
          ))}
        </div>
        {view === '3d' ? (
          <Suspense fallback={<div aria-hidden className="h-[360px]" />}>
            <BodyModel paint={paintKey} onPick={(key) => pick([key])} back={back} onBackChange={setBack} label={mapLabel} />
          </Suspense>
        ) : (
          <BodyFigure
            primary={[]}
            scale={2.4}
            className="self-center"
            label={mapLabel}
            paint={(keys) => {
              const entry = entryOf(keys)
              return entry ? modeStyle(mode, entry).fill : null
            }}
            onPick={pick}
            pickLabel={(keys) => {
              const entry = entryOf(keys)
              return entry ? `${entry.group.name}, ${modeStyle(mode, entry).text}` : ''
            }}
          />
        )}
        <div className={cn('flex items-center gap-2', view === '3d' ? 'justify-between' : 'justify-end')}>
          {view === '3d' ? (
            <button type="button" onClick={() => setBack(!back)} className={buttonVariants({ variant: 'panel' })}>
              {back ? 'Shiko përpara' : 'Shiko mbrapa'}
            </button>
          ) : null}
          {webglAvailable() ? (
            <div role="group" aria-label="Figura ose modeli 3D" className="flex gap-1 rounded-full bg-panel-button p-1">
              {(['2d', '3d'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={view === value}
                  onClick={() => choose(value)}
                  className={cn('h-11 min-w-12 rounded-full px-3 text-sm font-semibold', view === value ? 'bg-panel-foreground text-panel' : 'text-panel-foreground')}
                >
                  {value.toUpperCase()}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <ul aria-label="Legjenda" className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-xs leading-4 text-panel-muted-foreground">
          {mode === 'volumi'
            ? LOAD_LEVELS.map((level) => (
                <li key={level.level} className="flex items-center gap-1.5">
                  <span aria-hidden className={cn('size-2.5 rounded-full', LEVEL_SWATCH[level.level])} />
                  {level.label}
                </li>
              ))
            : RECOVERY_ORDER.map((status) => (
                <li key={status} className="flex items-center gap-1.5">
                  <span aria-hidden className={cn('size-2.5 rounded-full', RECOVERY[status].swatch)} />
                  {RECOVERY[status].label} · {RECOVERY[status].range}
                </li>
              ))}
        </ul>
        <p className="text-center text-xs leading-4 text-panel-muted-foreground">
          {mode === 'volumi' ? 'Setet e kësaj jave: kryesori 1, ndihmësi 0,5.' : 'Sipas orëve nga stërvitja e fundit ku muskuli ishte kryesor.'} {view === '3d' ? 'Zvarrit anash për ta rrotulluar, prek një muskul për më shumë.' : 'Prek një muskul për më shumë.'}
        </p>
      </section>

      <Group title="Muskujt">
        {sorted.map((entry) => (
          <Row
            key={entry.group.id}
            label={entry.group.name}
            value={modeStyle(mode, entry).text}
            detail={mode === 'volumi' ? RECOVERY[entry.recovery].label : sinceText(entry.hours)}
            onClick={() => open(entry.group.id)}
          />
        ))}
      </Group>

      {opened ? <MuscleSheet entry={opened} onClose={() => navigate(-1)} /> : null}
    </div>
  )
}

function MuscleSheet({ entry, onClose }: { entry: BodyGroup; onClose: () => void }) {
  const [library, setLibrary] = useState<LibraryExercise[] | null>(null)
  useEffect(() => {
    let cancelled = false
    void loadLibrary().then((items) => {
      if (!cancelled) setLibrary(items)
    })
    return () => {
      cancelled = true
    }
  }, [])
  const exercises = library ? libraryExercisesFor(library, entry.group) : []
  return (
    <Sheet title={entry.group.name} onClose={onClose}>
      <p className="text-sm leading-5 text-muted-foreground italic">{entry.latin}</p>
      <p className="text-base leading-6">{entry.role}</p>
      <dl className="flex flex-col tabular-nums">
        <div className="flex min-h-12 items-center justify-between gap-3 border-t border-border-subtle first:border-t-0">
          <dt className="text-base leading-6">Rikuperimi</dt>
          <dd className="text-right text-sm leading-5 text-muted-foreground">
            <span className="block font-medium text-foreground">{RECOVERY[entry.recovery].label}</span>
            {sinceText(entry.hours)}
          </dd>
        </div>
        <div className="flex min-h-12 items-center justify-between gap-3 border-t border-border-subtle">
          <dt className="text-base leading-6">Këtë javë</dt>
          <dd className="text-sm leading-5 text-muted-foreground">{setsText(entry.load)}</dd>
        </div>
      </dl>
      <h3 className="text-sm leading-5 font-semibold">Ushtrime nga biblioteka</h3>
      {library === null ? (
        <p className="text-sm leading-5 text-muted-foreground">Po ngarkohet biblioteka</p>
      ) : (
        <ul className="flex flex-col">
          {exercises.map((exercise) => (
            <li key={exercise.id} className="flex min-h-11 items-center justify-between gap-3 border-t border-border-subtle first:border-t-0">
              <span className="text-base leading-6">{exercise.name}</span>
              <span className="text-xs leading-4 text-muted-foreground">{EQUIPMENT_LABEL[exercise.equipment]}</span>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  )
}
