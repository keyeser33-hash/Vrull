import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { BodyFigure } from '@/components/body/body-figure'
import { Group, Row } from '@/components/layout/list-group'
import { Sheet } from '@/components/layout/sheet'
import { store, useLocalQuery } from '@/data/app-data'
import { type BodyGroup, bodyView } from '@/data/body'
import { libraryExercisesFor, LOAD_LEVELS } from '@/body/body-map'
import { type LibraryExercise, loadLibrary } from '@/program/library'
import { MUSCLE_GROUPS } from '@/program/muscles'
import type { RecoveryStatus } from '@/program/recovery'
import { cn } from '@/lib/cn'
import { EQUIPMENT_LABEL, kg } from './training-format'

// Trupi (SPEC §11, TH-19), në figurën 2D të §18 derisa modeli 3D të kalojë objektivin. Paneli
// tregon rikuperimin ose volumin e javës mbi figurë, me legjendë me fjalë; lista poshtë ka të njëjtat
// vlera për çdo grup. Një grup (në listë ose në figurë) hapet në fletë (?muskuli=id).

type Mode = 'rikuperimi' | 'volumi'

const RECOVERY: Record<RecoveryStatus, { label: string; range: string; fill: string; swatch: string }> = {
  i_lodhur: { label: 'I lodhur', range: 'nën 48 orë', fill: 'fill-brand', swatch: 'bg-brand' },
  pothuajse_gati: { label: 'Pothuajse gati', range: '48–72 orë', fill: 'fill-brand/45', swatch: 'bg-brand/45' },
  // "Gati" mbetet i qetë, që të dallohen muskujt që duan pushim.
  gati: { label: 'Gati', range: 'mbi 72 orë', fill: 'fill-panel-muted-foreground/35', swatch: 'bg-panel-muted-foreground/35' },
}

const LEVEL_FILL = [null, 'fill-brand/30', 'fill-brand/60', 'fill-brand'] as const
const LEVEL_SWATCH = ['bg-panel-border', 'bg-brand/30', 'bg-brand/60', 'bg-brand'] as const

const groupOf = (keys: string[]) => MUSCLE_GROUPS.find((group) => keys.some((key) => group.keys.includes(key)))
const setsText = (load: number) => (load === 1 ? '1 set' : `${kg(load)} sete`)
const sinceText = (hours: number | null) => {
  if (hours === null) return 'Pa stërvitje të regjistruar'
  if (hours < 24) return `Stërvitja e fundit para ${Math.max(1, hours)} orësh`
  const days = Math.round(hours / 24)
  return `Stërvitja e fundit para ${days === 1 ? '1 dite' : `${days} ditësh`}`
}
const RECOVERY_ORDER: RecoveryStatus[] = ['i_lodhur', 'pothuajse_gati', 'gati']

export function BodyPage() {
  const [now] = useState(() => new Date())
  const groups = useLocalQuery(() => bodyView(store, now), [])
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const mode: Mode = params.get('pamja') === 'volumi' ? 'volumi' : 'rikuperimi'
  if (!groups) {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="sr-only">Trupi</h1>
        <div aria-hidden className="h-[480px] rounded-xl bg-skeleton" />
      </div>
    )
  }
  const byId = new Map(groups.map((entry) => [entry.group.id, entry]))
  const open = (id: string) => setParams((current) => (current.set('muskuli', id), current))
  const setMode = (next: Mode) => setParams((current) => (current.set('pamja', next), current), { replace: true })
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
        <BodyFigure
          primary={[]}
          scale={2.4}
          className="self-center"
          label={mode === 'volumi' ? 'Volumi i javës sipas muskujve' : 'Rikuperimi sipas muskujve'}
          paint={(keys) => {
            const entry = byId.get(groupOf(keys)?.id ?? '')
            if (!entry) return null
            return mode === 'volumi' ? LEVEL_FILL[entry.level] : RECOVERY[entry.recovery].fill
          }}
          onPick={(keys) => {
            const group = groupOf(keys)
            if (group) open(group.id)
          }}
          pickLabel={(keys) => {
            const entry = byId.get(groupOf(keys)?.id ?? '')
            if (!entry) return ''
            return `${entry.group.name}, ${mode === 'volumi' ? setsText(entry.load) : RECOVERY[entry.recovery].label}`
          }}
        />
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
          {mode === 'volumi' ? 'Setet e kësaj jave: kryesori 1, ndihmësi 0,5.' : 'Sipas orëve nga stërvitja e fundit ku muskuli ishte kryesor.'} Prek një muskul për më shumë.
        </p>
      </section>

      <Group title="Muskujt">
        {sorted.map((entry) => (
          <Row
            key={entry.group.id}
            label={entry.group.name}
            value={mode === 'volumi' ? setsText(entry.load) : RECOVERY[entry.recovery].label}
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
