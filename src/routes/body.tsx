import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { BodyFigure } from '@/components/body/body-figure'
import { FocusChip } from '@/components/body/focus-chip'
import { BackHeader } from '@/components/layout/page'
import { Sheet } from '@/components/layout/sheet'
import { buttonVariants } from '@/components/ui/button-variants'
import { Icon } from '@/components/ui/icons'
import { surfaceClass } from '@/components/ui/surface'
import { store, useLocalQuery } from '@/data/app-data'
import { type BodyGroup, bodyView } from '@/data/body'
import { libraryExercisesFor, WEEKLY_TARGET } from '@/body/body-map'
import { type LibraryExercise, loadLibrary } from '@/program/library'
import { MUSCLE_GROUPS } from '@/program/muscles'
import { muscleName } from '@/i18n/domain'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import { webglAvailable } from '@/lib/webgl'
import {
  type BodyMode,
  focusDetail,
  groupRole,
  keyName,
  LEVEL_STYLE,
  levelLabel,
  modeStyle,
  RECOVERY_ORDER,
  RECOVERY_STYLE,
  setsText,
  sinceText,
  targetText,
  volumeNote,
} from './body-format'

// Trupi (SPEC §11, TH-19; bordet "Trupi", "Natë · Trupi", "Ditë · Trupi"). Modeli 3D tregon
// rikuperimin ose volumin e javës me ngjyrat e Vrullit; pa WebGL, figura 2D përpara dhe mbrapa me të
// njëjtat ngjyra. Prekja e një muskuli e fokuson: çipi sipër me vijën te muskuli, "Më shumë" hap
// fletën e grupit (?muskuli=id). Legjenda është me fjalë dhe lista poshtë ka të njëjtat vlera. Sipër
// djathtas: Shtresat dhe Trupi sipas matjeve.

const BodyModel = lazy(() => import('@/components/body/body-model'))

const groupOf = (keys: string[]) => MUSCLE_GROUPS.find((group) => keys.some((key) => group.keys.includes(key)))

/** Butoni i ikonës te kreu: 44 px, i mbushur mbi sfondin e faqes. */
const headerAction = buttonVariants({ variant: 'secondary', ground: 'page', size: 'icon' })

function BodyHeader() {
  const { t } = useI18n()
  return (
    <BackHeader
      title={t('tab.body')}
      back={t('body.backToProgress')}
      fallback="/progresi"
      actions={
        <>
          <Link to="/progresi/trupi/shtresat" aria-label={t('bodyModel.layers')} className={headerAction}>
            <Icon name="shtresat" size={20} />
          </Link>
          <Link to="/progresi/trupi/matjet" aria-label={t('bodyModel.byMeasurements')} className={headerAction}>
            <Icon name="matja" size={20} />
          </Link>
        </>
      }
    />
  )
}

export function BodyPage() {
  const i18n = useI18n()
  const { t } = i18n
  const [now] = useState(() => new Date())
  const groups = useLocalQuery(() => bodyView(store, now), [])
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const mode: BodyMode = params.get('pamja') === 'volumi' ? 'volumi' : 'rikuperimi'
  const [three] = useState(webglAvailable)
  const [back, setBack] = useState(false)
  // Muskuli i prekur te modeli 3D: grupi theksohet dhe kamera i afrohet.
  // `request` rritet me çdo prekje, që e njëjta zgjedhje pas një rrotullimi ta afrojë përsëri kamerën.
  const [focus, setFocus] = useState<{ id: string; key: string; request: number } | null>(null)
  const byId = useMemo(() => new Map((groups ?? []).map((entry) => [entry.group.id, entry])), [groups])
  const entryOf = useCallback((keys: string[]) => byId.get(groupOf(keys)?.id ?? ''), [byId])
  // Ngjyra e çdo çelësi te modeli 3D; funksion i ri vetëm kur ndryshojnë të dhënat, pamja ose gjuha.
  const paintKey = useCallback(
    (key: string) => {
      const entry = entryOf([key])
      return entry ? modeStyle(i18n, mode, entry).tone : null
    },
    [entryOf, mode, i18n],
  )
  if (!groups) {
    return (
      <div className="flex flex-col gap-2.5">
        <BodyHeader />
        <div aria-hidden className="h-[480px] rounded-xl bg-surface" />
      </div>
    )
  }
  const open = (id: string) => setParams((current) => (current.set('muskuli', id), current))
  const focused = focus ? byId.get(focus.id) : undefined
  const mapLabel = mode === 'volumi' ? t('bodyModel.map.volume') : t('bodyModel.map.recovery')
  const setMode = (next: BodyMode) => setParams((current) => (current.set('pamja', next), current), { replace: true })
  const opened = byId.get(params.get('muskuli') ?? '')
  const sorted = [...groups].sort((a, b) =>
    mode === 'volumi'
      ? b.load - a.load || a.group.name.localeCompare(b.group.name)
      : RECOVERY_ORDER.indexOf(a.recovery) - RECOVERY_ORDER.indexOf(b.recovery) || (a.hours ?? 1e9) - (b.hours ?? 1e9),
  )
  const legend =
    mode === 'volumi'
      ? LEVEL_STYLE.map((style, level) => ({ key: style.swatch, swatch: style.swatch, label: levelLabel(i18n, level as 0 | 1 | 2 | 3) }))
      : RECOVERY_ORDER.map((status) => ({
          key: status,
          swatch: RECOVERY_STYLE[status].swatch,
          label: t('bodyModel.legendItem', { label: t(`bodyModel.recovery.${status}`), range: t(`bodyModel.range.${status}`) }),
        }))

  return (
    <div className="flex flex-col gap-2.5">
      <BodyHeader />

      <div role="radiogroup" aria-label={t('bodyModel.view')} className={cn(surfaceClass, 'grid grid-cols-2 gap-1 rounded-[14px] p-1')}>
        {(
          [
            ['rikuperimi', t('bodyModel.mode.recovery')],
            ['volumi', t('bodyModel.mode.volume')],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={mode === value}
            onClick={() => setMode(value)}
            className={cn(
              'h-11 rounded-sm font-display text-lg font-bold uppercase outline-none focus-visible:outline-2 focus-visible:outline-foreground',
              mode === value ? 'bg-foreground text-background' : 'text-muted-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <section aria-label={mapLabel} className={cn(surfaceClass, 'relative h-[372px] shrink-0 overflow-hidden rounded-xl')}>
        {three ? (
          <>
            <Suspense fallback={null}>
              <BodyModel
                className="h-full"
                paint={paintKey}
                onPick={(key) => {
                  const group = key ? groupOf([key]) : undefined
                  setFocus((current) => (key && group ? { id: group.id, key, request: (current?.request ?? 0) + 1 } : null))
                }}
                focus={focused?.group.keys ?? null}
                focusRequest={focus?.request}
                overlayAt="top"
                leader
                overlay={
                  focused && focus ? (
                    <FocusChip
                      title={keyName(i18n, focus.key)}
                      detail={focusDetail(i18n, mode, focused, focus.key)}
                      swatch={modeStyle(i18n, mode, focused).swatch}
                      onOpen={() => open(focused.group.id)}
                      openLabel={t('bodyModel.chip.more', { name: muscleName(t, focused.group.id) })}
                      onClear={() => setFocus(null)}
                    />
                  ) : null
                }
                back={back}
                onBackChange={setBack}
                label={mapLabel}
              />
            </Suspense>
            <button
              type="button"
              onClick={() => setBack(!back)}
              className="absolute right-2.5 bottom-2.5 flex h-11 items-center gap-1.5 rounded-pill border border-subtle bg-background px-3.5 font-display text-[17px] font-bold text-foreground uppercase outline-none focus-visible:outline-2 focus-visible:outline-foreground"
            >
              <Icon name="rrotullo" size={18} />
              {back ? t('bodyModel.turn.front') : t('bodyModel.turn.back')}
            </button>
          </>
        ) : (
          <BodyFigure
            primary={[]}
            scale={2.3}
            className="h-full justify-center"
            label={mapLabel}
            paint={(keys) => {
              const entry = entryOf(keys)
              return entry ? modeStyle(i18n, mode, entry).fill : null
            }}
            onPick={(keys) => {
              const group = groupOf(keys)
              if (group) open(group.id)
            }}
            pickLabel={(keys) => {
              const entry = entryOf(keys)
              return entry ? `${muscleName(t, entry.group.id)}, ${modeStyle(i18n, mode, entry).text}` : ''
            }}
          />
        )}
      </section>

      <ul aria-label={t('bodyModel.legend')} className="flex flex-wrap gap-x-3 gap-y-1.5 type-caption">
        {legend.map((item) => (
          <li key={item.key} className="flex items-center gap-1.5">
            <span aria-hidden className={cn('size-3 shrink-0 rounded-[3px]', item.swatch)} />
            {item.label}
          </li>
        ))}
      </ul>

      <section aria-label={t('bodyModel.muscles')} className="flex flex-col">
        <ul className="flex flex-col">
          {sorted.map((entry) => {
            const style = modeStyle(i18n, mode, entry)
            const name = muscleName(t, entry.group.id)
            return (
              <li key={entry.group.id}>
                <button
                  type="button"
                  aria-label={`${name}, ${style.value}`}
                  onClick={() => open(entry.group.id)}
                  className="flex min-h-[46px] w-full items-center justify-between gap-2.5 border-b border-border text-left outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground"
                >
                  <span className="min-w-0 truncate type-body-strong">{name}</span>
                  <span className="flex shrink-0 items-baseline gap-2">
                    <span className="type-caption text-muted-foreground">{style.detail}</span>
                    <span className="font-display text-xl font-bold tabular-nums">{style.value}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        <p className="pt-2 type-caption text-muted-foreground">
          {mode === 'volumi'
            ? volumeNote(
                i18n,
                groups.map((entry) => ({ id: entry.group.id, load: entry.load })),
                now,
              )
            : t('bodyModel.recoveryNote')}
        </p>
      </section>

      {opened ? <MuscleSheet entry={opened} onClose={() => navigate(-1)} /> : null}
    </div>
  )
}

function MuscleSheet({ entry, onClose }: { entry: BodyGroup; onClose: () => void }) {
  const i18n = useI18n()
  const { t } = i18n
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
  const row = 'flex min-h-12 items-center justify-between gap-3 border-t border-border first:border-t-0'
  return (
    <Sheet title={muscleName(t, entry.group.id)} onClose={onClose}>
      <p className="type-caption text-muted-foreground italic">{entry.latin}</p>
      <p className="type-body-l">{groupRole(i18n, entry.group.id)}</p>
      <dl className="flex flex-col tabular-nums">
        <div className={row}>
          <dt className="type-body">{t('bodyModel.sheet.recovery')}</dt>
          <dd className="text-right type-caption text-muted-foreground">
            <span className="block font-semibold text-foreground">{t(`bodyModel.recovery.${entry.recovery}`)}</span>
            {sinceText(i18n, entry.hours)}
          </dd>
        </div>
        <div className={row}>
          <dt className="type-body">{t('bodyModel.sheet.week')}</dt>
          <dd className="text-right type-caption text-muted-foreground">
            <span className="block font-semibold text-foreground">{setsText(i18n, entry.load)}</span>
            {t('bodyModel.sheet.target', { status: targetText(i18n, entry.load), min: WEEKLY_TARGET.min, max: WEEKLY_TARGET.max })}
          </dd>
        </div>
      </dl>
      {entry.parts.length > 1 ? (
        <>
          <h3 className="type-label text-muted-foreground">{t('bodyModel.sheet.parts')}</h3>
          <ul className="flex flex-col tabular-nums">
            {entry.parts.map((part) => (
              <li key={part.key} className={cn(row, 'min-h-11')}>
                <span className="type-body">{keyName(i18n, part.key)}</span>
                <span className="type-caption text-muted-foreground">{setsText(i18n, part.load)}</span>
              </li>
            ))}
            {entry.unsplit > 0 ? (
              <li className={cn(row, 'min-h-11')}>
                <span className="type-body">{t('bodyModel.sheet.unsplit')}</span>
                <span className="type-caption text-muted-foreground">{setsText(i18n, entry.unsplit)}</span>
              </li>
            ) : null}
          </ul>
          <p className="type-caption text-muted-foreground">
            {t('bodyModel.sheet.partsNote')}
            {entry.unsplit > 0 ? ` ${t('bodyModel.sheet.unsplitNote')}` : null}
          </p>
        </>
      ) : null}
      <h3 className="type-label text-muted-foreground">{t('bodyModel.sheet.library')}</h3>
      {library === null ? (
        <p className="type-caption text-muted-foreground">{t('bodyModel.sheet.libraryLoading')}</p>
      ) : (
        <ul className="flex flex-col">
          {exercises.map((exercise) => (
            <li key={exercise.id} className={cn(row, 'min-h-11')}>
              <span className="type-body">{exercise.name}</span>
              <span className="type-caption text-muted-foreground">{t(`bodyModel.equipment.${exercise.equipment}`)}</span>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  )
}
