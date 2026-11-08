import { type FormEvent, useId, useState } from 'react'
import { useNavigate } from 'react-router'
import { BackHeader } from '@/components/layout/page'
import { Button } from '@/components/ui/button'
import { ExercisePhoto } from '@/components/ui/exercise-photo'
import { Icon } from '@/components/ui/icons'
import { surfaceClass } from '@/components/ui/surface'
import { store, useLocalQuery } from '@/data/app-data'
import { createExercise, exerciseCatalog } from '@/data/exercises'
import { equipmentName, muscleName } from '@/i18n/domain'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import { youtubeId } from '@/lib/youtube'
import { nameStatus, volumeShare } from '@/program/exercise-catalog'
import { weightStep } from '@/program/loads'
import type { Equipment, Tracking } from '@/program/types'
import { Chip } from './programme-parts'
import { musclesLine } from './programme-format'

// "Krijo ushtrim" (bordi "KrijoUshtrim", V2-E1-09): ushtrimi i përdoruesit me emrin në anglisht,
// pajisjen, muskujt kryesorë dhe ndihmës sipas grupeve (si ushtrimet e bibliotekës që dinë vetëm
// grupin), mënyrën e regjistrimit dhe videon. Del te biblioteka si "I yti", zgjidhet te editori dhe
// numërohet te volumi javor: kryesori 1 set, ndihmësi 0,5 (SPEC §11). Foto e ushtrimit të përdoruesit
// nuk ruhet ende: ushtrimi del me "Pa foto".

// Si te bordi; kettlebell-i dhe të tjerat hyjnë te "Tjetër".
const EQUIPMENT: Equipment[] = ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight', 'band', 'other']
// Nga koka te këmbët, si te bordi.
const GROUPS = ['qafa', 'trapezi', 'shpatullat', 'gjoksi', 'shpina', 'mesi', 'bicepsi', 'tricepsi', 'parakrahet', 'barku', 'vithet', 'kuadricepsi', 'kofshet-e-pasme', 'aduktoret', 'pulpat']
const TRACKING: Tracking[] = ['weight_reps', 'timed', 'bodyweight_reps']

type Role = 'primary' | 'secondary'

export function CreateExercisePage() {
  const { t, fmt } = useI18n()
  const navigate = useNavigate()
  const catalog = useLocalQuery(() => exerciseCatalog(store), [])
  const steps = useLocalQuery(async () => ((await store.all('user_settings'))[0]?.weight_steps as Partial<Record<Equipment, number>> | undefined) ?? {}, [])
  const [name, setName] = useState('')
  const [equipment, setEquipment] = useState<Equipment>('barbell')
  const [tracking, setTracking] = useState<Tracking>('weight_reps')
  const [roles, setRoles] = useState<Record<string, Role>>({})
  const [video, setVideo] = useState('')
  const [tried, setTried] = useState(false)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const ids = { name: useId(), nameHint: useId(), muscles: useId(), video: useId(), preview: useId() }

  const status = catalog ? nameStatus(name, catalog.taken) : 'empty'
  const primary = GROUPS.filter((group) => roles[group] === 'primary')
  const secondary = GROUPS.filter((group) => roles[group] === 'secondary')
  const videoBad = video.trim() !== '' && !youtubeId(video.trim())
  const cleanName = name.trim().replace(/\s+/g, ' ')

  const cycle = (group: string) =>
    setRoles((current) => {
      const next = { ...current }
      if (!current[group]) next[group] = 'primary'
      else if (current[group] === 'primary') next[group] = 'secondary'
      else delete next[group]
      return next
    })

  async function save(event: FormEvent) {
    event.preventDefault()
    setTried(true)
    if (status !== 'new' || primary.length === 0 || videoBad) return
    setBusy(true)
    setFailed(false)
    try {
      const id = await createExercise(store, {
        name: cleanName,
        equipment,
        tracking,
        primaryGroups: primary,
        secondaryGroups: secondary,
        videoUrl: video.trim() || null,
      })
      navigate(`/ushtrimi/${id}`, { replace: true })
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  const example: Record<Tracking, string> = {
    weight_reps: `${fmt.number(40)} × ${fmt.number(12)}`,
    timed: fmt.unit(60, 's'),
    bodyweight_reps: fmt.number(15),
  }
  const previewDetail = musclesLine(t, primary, secondary)

  return (
    <form aria-label={t('programme.createTitle')} noValidate onSubmit={(event) => void save(event)} className="flex flex-col gap-3.5">
      <BackHeader title={t('programme.createTitle')} back={t('programme.backToLibrary')} fallback="/programi/biblioteka" />

      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.name} className="type-label text-muted-foreground">
          {t('programme.name')}
        </label>
        <input
          id={ids.name}
          type="text"
          lang="en"
          autoComplete="off"
          autoCapitalize="words"
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
          aria-describedby={ids.nameHint}
          aria-invalid={status === 'taken' || (tried && status === 'empty') ? true : undefined}
          className={cn(
            'h-16 w-full rounded-md border bg-surface px-3.5 text-lg font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground',
            status === 'new' ? 'border-foreground' : 'border-border',
            'aria-invalid:border-2 aria-invalid:border-danger',
          )}
        />
        <span id={ids.nameHint} className="flex items-center gap-1.5 type-caption text-muted-foreground">
          {status === 'new' ? (
            <>
              <Icon name="zgjedhur" size={16} className="text-success" />
              <span>
                <span className="font-semibold text-success">{t('programme.nameNew')}</span> · {t('programme.nameRule')}
              </span>
            </>
          ) : status === 'taken' ? (
            <span className="font-semibold text-danger">{t('programme.nameTaken')}</span>
          ) : (
            <span className={cn(tried && 'text-danger')}>{t('programme.nameEmpty')}</span>
          )}
        </span>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 type-label text-muted-foreground">{t('programme.filterEquipment')}</legend>
        <div role="radiogroup" aria-label={t('programme.filterEquipment')} className="flex flex-wrap gap-1.5">
          {EQUIPMENT.map((option) => (
            <Chip
              key={option}
              role="radio"
              aria-checked={equipment === option}
              selected={equipment === option}
              className="px-3"
              onClick={() => {
                setEquipment(option)
                if (option === 'bodyweight' && tracking === 'weight_reps') setTracking('bodyweight_reps')
              }}
            >
              {equipmentName(t, option)}
            </Chip>
          ))}
        </div>
        {tracking === 'weight_reps' ? (
          <span className="type-caption text-muted-foreground">{t('programme.stepHint', { step: weightStep(equipment, steps ?? {}) })}</span>
        ) : null}
      </fieldset>

      <fieldset aria-describedby={ids.muscles} className="flex flex-col gap-2">
        <legend className="mb-1 type-label text-muted-foreground">{t('programme.muscles')}</legend>
        <div id={ids.muscles} className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-sm">
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="size-4 rounded-pill bg-foreground" />
            <span>
              <b className="font-semibold">{t('programme.primary')}</b> <span className="text-muted-foreground">· {t('programme.primaryShare')}</span>
            </span>
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="size-4 rounded-pill border-[1.5px] border-foreground" />
            <span>
              <b className="font-semibold">{t('programme.secondary')}</b> <span className="text-muted-foreground">· {t('programme.secondaryShare')}</span>
            </span>
          </span>
          <span className="w-full text-muted-foreground">{t('programme.musclesRule')}</span>
        </div>
        <div role="group" aria-label={t('programme.musclesGroups')} className="flex flex-wrap gap-1.5">
          {GROUPS.map((group) => {
            const role = roles[group]
            const label = muscleName(t, group)
            return (
              <button
                key={group}
                type="button"
                onClick={() => cycle(group)}
                aria-label={t(role === 'primary' ? 'programme.chipPrimary' : role === 'secondary' ? 'programme.chipSecondary' : 'programme.chipNone', { group: label })}
                className={cn(
                  'flex h-touch items-center gap-1.5 rounded-pill border text-sm whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground',
                  role === 'primary' && 'border-foreground bg-foreground pr-2 pl-3 font-semibold text-background',
                  role === 'secondary' && 'border-[1.5px] border-foreground bg-background pr-2 pl-3 font-semibold text-foreground',
                  !role && 'border-border bg-surface px-3 font-medium text-foreground',
                )}
              >
                {label}
                {role === 'primary' ? (
                  <span aria-hidden className="flex size-[22px] items-center justify-center rounded-pill bg-background font-display text-[15px] font-bold text-foreground">
                    1
                  </span>
                ) : role === 'secondary' ? (
                  <span aria-hidden className="font-display text-[17px] font-bold text-muted-foreground">
                    ½
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
        <div role="status" className={cn(surfaceClass, 'flex flex-col gap-1 rounded-lg px-3.5 py-2.5')}>
          {primary.length ? (
            <>
              <span className="type-caption text-muted-foreground">
                {cleanName ? t('programme.volumePreview', { name: cleanName }) : t('programme.volumePreviewUnnamed')}
              </span>
              <span className="flex flex-wrap gap-x-4 gap-y-1 text-[15px]">
                {volumeShare(primary, secondary).map((entry) => (
                  <span key={entry.group}>
                    {muscleName(t, entry.group)}{' '}
                    <b className="font-display text-xl font-bold tabular-nums">+{fmt.number(entry.sets)}</b>
                  </span>
                ))}
              </span>
            </>
          ) : (
            <span className={cn('type-caption', tried ? 'font-semibold text-danger' : 'text-muted-foreground')}>{t('programme.volumeEmpty')}</span>
          )}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 type-label text-muted-foreground">{t('programme.tracking')}</legend>
        <div role="radiogroup" aria-label={t('programme.trackingLabel')} className="grid grid-cols-3 gap-1.5">
          {TRACKING.map((option) => {
            const checked = tracking === option
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={checked}
                onClick={() => setTracking(option)}
                className={cn(
                  'flex h-15 flex-col items-center justify-center gap-0.5 rounded-md border px-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground',
                  checked ? 'border-foreground bg-foreground text-background' : 'border-border bg-surface text-foreground',
                )}
              >
                <span className={cn('text-sm leading-[1.15]', checked ? 'font-bold' : 'font-semibold')}>{t(`programme.tracking.${option}`)}</span>
                <span aria-hidden className={cn('font-display text-xl leading-none font-bold tabular-nums', !checked && 'text-muted-foreground')}>
                  {example[option]}
                </span>
              </button>
            )
          })}
        </div>
        <span className="type-caption text-muted-foreground">{t(`programme.trackingHint.${tracking}`)}</span>
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.video} className="type-label text-muted-foreground">
          {t('programme.videoOptional')}
        </label>
        <div className="relative">
          <Icon name="video" size={20} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            id={ids.video}
            type="url"
            inputMode="url"
            autoComplete="off"
            placeholder="https://youtu.be/…"
            value={video}
            onChange={(event) => setVideo(event.currentTarget.value)}
            aria-invalid={tried && videoBad ? true : undefined}
            className="h-button w-full rounded-md border border-border bg-surface pr-3.5 pl-11 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground aria-invalid:border-2 aria-invalid:border-danger"
          />
        </div>
        {tried && videoBad ? (
          <p role="alert" className="type-caption text-danger">
            {t('programme.videoInvalid')}
          </p>
        ) : null}
      </div>

      <section aria-labelledby={ids.preview} className="flex flex-col gap-1.5">
        <h2 id={ids.preview} className="type-label text-muted-foreground">
          {t('programme.preview')}
        </h2>
        <div className={cn(surfaceClass, 'flex min-h-16 items-center gap-3 rounded-lg px-3 py-2')}>
          <ExercisePhoto libraryId={null} ground="card" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="type-body-strong">{cleanName || t('programme.name')}</span>
            {previewDetail ? <span className="truncate type-caption text-muted-foreground">{previewDetail}</span> : null}
          </span>
          <span className="shrink-0 rounded-pill bg-surface-2 px-2.5 py-1 text-[13px] font-semibold">{t('programme.own')}</span>
        </div>
      </section>

      <div className="sticky bottom-0 -mx-4 -mb-[calc(var(--safe-bottom)+24px)] flex flex-col gap-2 border-t border-border bg-background px-4 pt-2.5 pb-[calc(var(--safe-bottom)+20px)]">
        {failed ? (
          <p role="alert" className="type-caption text-danger">
            {t('programme.saveFailed')}
          </p>
        ) : null}
        <Button type="submit" variant="primary" size="xl" disabled={busy || catalog === undefined}>
          {t('programme.save')}
        </Button>
      </div>
    </form>
  )
}
