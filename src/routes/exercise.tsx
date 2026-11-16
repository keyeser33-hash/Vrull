import { useId, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { MUSCLE_INFO } from '@/body/muscle-info'
import { BodyFigure } from '@/components/body/body-figure'
import { BackButton } from '@/components/layout/page'
import { Sheet } from '@/components/layout/sheet'
import { Button } from '@/components/ui/button'
import { inputClass } from '@/components/ui/field-styles'
import { ExerciseMotion, ExerciseMotionSheet } from '@/components/ui/exercise-motion'
import { ExerciseVideoSheet, MoreVideos, WatchVideoButton } from '@/components/ui/exercise-video'
import { Icon } from '@/components/ui/icons'
import { surfaceClass } from '@/components/ui/surface'
import { store, useLocalQuery } from '@/data/app-data'
import { type ExplainSubject } from '@/data/exercise-explain'
import { type ExerciseDetail, exerciseDetail, exerciseRowFor } from '@/data/exercises'
import { programView, setExerciseVideo, trainingHistory } from '@/data/training'
import type { I18n } from '@/i18n'
import { equipmentName, muscleName, programBlockName } from '@/i18n/domain'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import { useExercisePhoto } from '@/lib/exercise-photo'
import { youtubeId } from '@/lib/youtube'
import { groupsOf } from '@/program/exercise-catalog'
import { guideFor } from '@/program/exercise-guide-data'
import { type ChosenVideo, chosenVideo, curatedVideos } from '@/program/exercise-videos'
import { tempoOf } from '@/program/motion'
import type { HistorySet } from '@/program/loads'
import { e1rmByWeek, exerciseRecords, recentSessions, type SessionSets, type WeekE1rm } from '@/progress/exercise-records'
import { ExplainMore } from './exercise-explain'
import { ExerciseMusclesSheet } from './exercise-muscles'
import { CueList, GuideHistory, GuideSections, SESSION_CUES } from './exercise-guide'
import { FormVideosSection } from './form-video'
import { capitalize, dotted, groupList, weekShort } from './programme-format'
import { ChangeExerciseSheet } from './session-sheets'

// Faqja e ushtrimit (bordet "Ushtrimi", V2-E1-09, dhe "Ushtrimi · Udhëzuesi", V58): lëvizja e ushtrimit
// (dy fotot bardh e zi sipas tempos, SPEC §0.3g) me "Zgjero" dhe "Shiko videon", muskujt me figurën dhe
// modelin 3D (§11), "Rekordet e tua", historia e seteve, videot e formës (V2-E1-13, `form-video.tsx`),
// udhëzuesi i plotë nga `program/guides` (`exercise-guide.tsx`), "Më shumë video", "Pak histori" dhe
// lidhja e YouTube që shtoi përdoruesi (§12), që zë vendin e videos së zgjedhur. Ushtrimi pa udhëzues
// (13 të Shortcut to Size, biblioteka deri te vala e tyre) ka lëvizjen, muskujt dhe videon, pa seksione bosh.
// Hapet edhe për ushtrimet e bibliotekës që s'janë ende në telefon (me ID-në e free-exercise-db).

export function ExercisePage() {
  const i18n = useI18n()
  const { t } = i18n
  const { exerciseId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const detail = useLocalQuery(() => exerciseDetail(store, exerciseId), [exerciseId])
  const history = useLocalQuery(() => trainingHistory(store), [])
  const view = useLocalQuery(() => programView(store), [])

  if (detail === undefined || history === undefined) return <h1 className="sr-only">{t('programme.muscles')}</h1>
  if (detail === null) {
    return (
      <div className="flex flex-col gap-3">
        <header className="flex min-h-14 items-center">
          <BackButton label={t('common.back')} fallback="/programi/biblioteka" />
        </header>
        <p className="type-body text-muted-foreground">{t('programme.notFound')}</p>
      </div>
    )
  }

  const blockId = params.get('blloku')
  const week = Number(params.get('java') ?? 0)
  const dayId = params.get('dita')
  const plan = view && blockId && dayId && week ? view.plan(blockId, week, dayId) : null
  const slot = plan?.slots.find((candidate) => candidate.slotId === params.get('slot'))
  const sheet = params.get('ndrysho')
  const open = (name: string) => setParams((current) => (current.set('ndrysho', name), current))
  const sets = detail.exerciseId ? history.sets : []
  const guide = guideFor(detail)
  const chosen = chosenVideo(detail, detail.videoUrl)
  const more = curatedVideos(detail)?.more ?? []
  const tempo = tempoOf(guide?.tempo)
  const showTempo = !guide || guide.tempo !== null

  return (
    <div className="flex flex-col gap-4">
      <Top
        detail={detail}
        tempo={tempo}
        showTempo={showTempo}
        chosen={chosen}
        onExpand={() => open('levizja')}
        onVideo={() => open('videoja')}
      />
      <div className="-mt-1 flex flex-col gap-0.5">
        <span className="type-caption text-muted-foreground">{eyebrow(detail, i18n)}</span>
        <h1 className="type-display-l">{detail.name}</h1>
      </div>
      <Muscles detail={detail} onRotate={() => open('muskujt')} />
      <Records sets={sets} exerciseId={detail.exerciseId} tracking={detail.tracking} />
      <History sets={sets} exerciseId={detail.exerciseId} />
      <FormVideosSection exerciseId={detail.exerciseId} />
      {guide ? <GuideSections guide={guide} /> : null}
      <MoreVideos videos={more} />
      {guide ? <GuideHistory guide={guide} /> : null}
      <ExplainMore subject={explainSubject(detail, guide, i18n)} />
      <UserVideo detail={detail} onWatch={() => open('videoja')} onEdit={() => open('video')} />
      {plan && slot ? (
        <Button variant="outline" className="w-full" onClick={() => open('ushtrimi')}>
          {t('programme.changeForBlock', { block: programBlockName(t, plan.blockName) })}
        </Button>
      ) : null}

      {sheet === 'muskujt' ? <ExerciseMusclesSheet exercise={detail} onClose={() => navigate(-1)} /> : null}
      {sheet === 'levizja' ? (
        <ExerciseMotionSheet libraryId={detail.libraryId} name={detail.name} tempo={tempo} showTempo={showTempo} onClose={() => navigate(-1)}>
          {guide ? <CueList cues={guide.cues.items.slice(0, SESSION_CUES)} numbered /> : null}
          {chosen ? <WatchVideoButton chosen={chosen} onOpen={() => open('videoja')} className="bg-surface-2" /> : null}
        </ExerciseMotionSheet>
      ) : null}
      {sheet === 'videoja' && chosen ? <ExerciseVideoSheet chosen={chosen} name={detail.name} onClose={() => navigate(-1)} /> : null}
      {sheet === 'video' ? <VideoSheet detail={detail} onClose={() => navigate(-1)} /> : null}
      {sheet === 'ushtrimi' && plan && slot ? (
        <ChangeExerciseSheet
          plan={plan}
          slot={slot}
          exerciseName={detail.name}
          onClose={() => navigate(`/programi/${blockId}/${week}/${dayId}`, { replace: true })}
        />
      ) : null}
    </div>
  )
}

/** Ushtrimi për "Shpjegoje më shumë": emri, muskujt në gjuhën e app-it dhe udhëzuesi; asgjë personale. */
function explainSubject(detail: ExerciseDetail, guide: ReturnType<typeof guideFor>, { t }: I18n): ExplainSubject {
  const primary = groupsOf(detail.primary)
  const secondary = groupsOf(detail.secondary).filter((group) => !primary.includes(group))
  return {
    key: detail.key,
    name: detail.name,
    equipment: equipmentName(t, detail.equipment),
    primary: primary.map((group) => muscleName(t, group)),
    secondary: secondary.map((group) => muscleName(t, group)),
    guide,
  }
}

/** "Gjoksi · shufër · 4 sete te Shortcut to Size". */
function eyebrow(detail: ExerciseDetail, { t, fmt }: I18n) {
  const [group] = groupsOf(detail.primary)
  const text = dotted([
    group ? muscleName(t, group) : null,
    equipmentName(t, detail.equipment).toLocaleLowerCase(fmt.locale),
    detail.programSets ? t('programme.setsIn', { count: detail.programSets.sets, programme: detail.programSets.programName }) : null,
  ])
  return capitalize(text, fmt.locale)
}

/**
 * Lëvizja e ushtrimit në krye, me shigjetën mbrapa sipër saj, "Zgjero" dhe "Shiko videon" poshtë (bordi
 * "Ushtrimi · Udhëzuesi"). Pa foto: vend-mbajtësi "Pa foto" dhe vetëm "Shiko videon".
 */
function Top({
  detail,
  tempo,
  showTempo,
  chosen,
  onExpand,
  onVideo,
}: {
  detail: ExerciseDetail
  tempo: ReturnType<typeof tempoOf>
  showTempo: boolean
  chosen: ChosenVideo | null
  onExpand: () => void
  onVideo: () => void
}) {
  const { t } = useI18n()
  const photo = useExercisePhoto(detail.libraryId)
  const back = (
    <BackButton
      label={t('common.back')}
      fallback="/programi/biblioteka"
      className="absolute top-2.5 left-4 z-10 ml-0 bg-background/70 text-foreground backdrop-blur-sm"
    />
  )
  const watch = chosen ? <WatchVideoButton chosen={chosen} onOpen={onVideo} /> : null
  if (photo.status === 'missing') {
    return (
      <>
        <div className="relative -mx-4 -mt-5">
          <div className="flex h-[120px] items-end justify-center gap-1.5 bg-surface-2 pb-4 text-muted-foreground">
            <Icon name="programi" size={18} />
            <span className="type-caption">{t('exercise.noPhoto')}</span>
          </div>
          {back}
        </div>
        {watch}
      </>
    )
  }
  return (
    <div className="-mx-4 -mt-5">
      <ExerciseMotion
        libraryId={detail.libraryId}
        name={detail.name}
        tempo={tempo}
        showTempo={showTempo}
        onExpand={onExpand}
        action={watch}
        overlay={back}
        stageClassName="aspect-auto h-[220px]"
      />
    </div>
  )
}

function Muscles({ detail, onRotate }: { detail: ExerciseDetail; onRotate: () => void }) {
  const { t } = useI18n()
  const primary = groupsOf(detail.primary)
  const secondary = groupsOf(detail.secondary).filter((group) => !primary.includes(group))
  const names = (groups: string[]) => groupList(t, groups)
  const latin = primary.length === 1 ? MUSCLE_INFO[primary[0]]?.latin : null
  return (
    <section aria-labelledby="exercise-muscles" className={cn(surfaceClass, 'flex flex-col gap-3 rounded-xl p-3.5')}>
      <div className="flex items-center justify-between gap-2">
        <h2 id="exercise-muscles" className="type-title">
          {t('programme.muscles')}
        </h2>
        <Button variant="outline" className="rounded-md px-3.5" onClick={onRotate}>
          <Icon name="rrotullo" size={18} />
          {t('programme.rotate3d')}
        </Button>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-3.5">
        <div className="flex items-center justify-center rounded-md bg-surface-2 p-2">
          <BodyFigure
            primary={detail.primary}
            secondary={detail.secondary}
            scale={1.1}
            label={t('programme.musclesFigure', { name: detail.name, primary: names(primary) })}
            className="[&_figcaption]:hidden"
          />
        </div>
        <ul className="flex flex-col gap-3">
          {primary.length ? (
            <li className="flex gap-2.5">
              <span aria-hidden className="mt-1 size-3 shrink-0 rounded-pill bg-ember" />
              <span className="flex min-w-0 flex-col">
                <span className="type-caption text-muted-foreground">{t('programme.primary')}</span>
                <span className="type-body-strong">{names(primary)}</span>
                {latin ? <span className="text-[13px] leading-[1.35] text-muted-foreground">{latin.toLowerCase()}</span> : null}
              </span>
            </li>
          ) : null}
          {secondary.length ? (
            <li className="flex gap-2.5">
              <span aria-hidden className="mt-1 size-3 shrink-0 rounded-pill border-[1.5px] border-muted-foreground" />
              <span className="flex min-w-0 flex-col">
                <span className="type-caption text-muted-foreground">{t('programme.secondary')}</span>
                <span className="type-body-strong">{names(secondary)}</span>
              </span>
            </li>
          ) : null}
        </ul>
      </div>
    </section>
  )
}

/** "Rekordet e tua" (karta insight): e1RM më e lartë, shtesa që nga java e parë, grafiku, pesha më e madhe. */
function Records({ sets, exerciseId, tracking }: { sets: HistorySet[]; exerciseId: string | null; tracking: ExerciseDetail['tracking'] }) {
  const { t, fmt } = useI18n()
  if (tracking !== 'weight_reps') return null
  const records = exerciseId ? exerciseRecords(sets, exerciseId) : null
  const weeks = exerciseId ? e1rmByWeek(sets, exerciseId) : []
  return (
    <section aria-labelledby="exercise-records" className="flex flex-col gap-2 rounded-lg border border-insight-border bg-insight p-3.5">
      <h2 id="exercise-records" className="type-label text-muted-foreground">
        {t('programme.records')}
      </h2>
      {!records ? (
        <p className="type-body text-muted-foreground">{t('programme.noRecords')}</p>
      ) : (
        <>
          {records.bestE1rmKg !== null ? (
            <div className="flex items-end gap-2">
              <span className="font-display text-[56px] leading-[0.85] font-extrabold tabular-nums">{fmt.number(records.bestE1rmKg, { maxDigits: 1 })}</span>
              <span className="flex flex-col text-sm leading-[1.2] text-muted-foreground">
                <span>kg</span>
                <span>e1RM</span>
              </span>
              {records.gainKg !== null && records.since ? (
                <span className="ml-auto pb-0.5 text-[15px] font-semibold text-data tabular-nums">
                  {t('programme.gainSince', { gain: fmt.number(records.gainKg, { maxDigits: 1 }), week: weekShort(t, records.since) })}
                </span>
              ) : null}
            </div>
          ) : (
            <p className="type-body text-muted-foreground">{t('programme.noE1rm')}</p>
          )}
          {weeks.length > 1 ? <E1rmChart weeks={weeks.slice(-6)} /> : null}
          {records.heaviest ? (
            <div className="flex items-center justify-between gap-3 border-t border-border pt-2.5">
              <span className="type-body">{t('programme.heaviest')}</span>
              <span className="type-body-strong tabular-nums">{`${fmt.unit(records.heaviest.weightKg, 'kg')} × ${fmt.number(records.heaviest.reps)}`}</span>
            </div>
          ) : null}
        </>
      )}
    </section>
  )
}

/** Vija e e1RM-së sipas javës: pikat me vlerën sipër dhe javën poshtë; e fundit me shkronja të forta. */
function E1rmChart({ weeks }: { weeks: WeekE1rm[] }) {
  const { t, fmt } = useI18n()
  const width = 326
  const values = weeks.map((entry) => entry.e1rmKg)
  const [min, max] = [Math.min(...values), Math.max(...values)]
  const x = (index: number) => 30 + (index * (width - 60)) / (weeks.length - 1)
  const y = (value: number) => (max === min ? 40 : 66 - ((value - min) / (max - min)) * 44)
  const value = (entry: WeekE1rm) => fmt.number(entry.e1rmKg, { minDigits: 1, maxDigits: 1 })
  const label = t('programme.chartLabel', { points: weeks.map((entry) => `${weekShort(t, entry)} ${fmt.unit(Math.round(entry.e1rmKg * 10) / 10, 'kg')}`).join(', ') })
  return (
    <svg viewBox={`0 0 ${width} 96`} className="h-auto w-full" role="img" aria-label={label}>
      <path d={`M0 76H${width}M0 46H${width}M0 16H${width}`} className="stroke-border" strokeWidth={1} />
      <path
        d={weeks.map((entry, index) => `${index === 0 ? 'M' : 'L'}${x(index)} ${y(entry.e1rmKg)}`).join('')}
        fill="none"
        className="stroke-ember-text"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {weeks.map((entry, index) => {
        const last = index === weeks.length - 1
        return (
          <g key={`${entry.run}-${entry.blockPosition}-${entry.week}`}>
            <circle cx={x(index)} cy={y(entry.e1rmKg)} r={last ? 5 : 4} className="fill-ember" />
            <text
              x={x(index)}
              y={y(entry.e1rmKg) - 9}
              textAnchor="middle"
              className={cn('font-sans text-[13px] tabular-nums', last ? 'fill-foreground font-bold' : 'fill-muted-foreground')}
            >
              {value(entry)}
            </text>
            <text x={x(index)} y={93} textAnchor="middle" className="fill-muted-foreground font-sans text-xs">
              {weekShort(t, entry)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/** Historia e seteve: tri seancat e fundit, me datën, javën dhe setet e punës. */
function History({ sets, exerciseId }: { sets: HistorySet[]; exerciseId: string | null }) {
  const { t, fmt } = useI18n()
  const sessions = exerciseId ? recentSessions(sets, exerciseId, 3) : []
  if (sessions.length === 0) return null
  return (
    <section aria-labelledby="exercise-history" className="flex flex-col gap-1">
      <h2 id="exercise-history" className="type-title">
        {t('programme.history')}
      </h2>
      <ul className="flex flex-col">
        {sessions.map((session) => (
          <li key={session.sessionId} className="flex min-h-row flex-col justify-center border-b border-border py-2 last:border-b-0">
            <span className="type-body-strong tabular-nums">{setsLine(session, fmt)}</span>
            <span className="type-caption text-muted-foreground">{dotted([capitalize(fmt.date(new Date(session.at)), fmt.locale), weekShortOf(session, t)])}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

const weekShortOf = (session: SessionSets, t: I18n['t']) => weekShort(t, session)

/** "62,5 kg × 12, 10, 9" kur pesha është e njëjtë; përndryshe "60 × 13, 62,5 × 10". */
function setsLine(session: SessionSets, fmt: I18n['fmt']) {
  const weights = new Set(session.sets.map((set) => set.weightKg ?? 0))
  const reps = (value: number | null) => fmt.number(value ?? 0)
  if (weights.size === 1) {
    const [weight] = weights
    const list = session.sets.map((set) => reps(set.reps)).join(', ')
    return weight > 0 ? `${fmt.unit(weight, 'kg')} × ${list}` : `× ${list}`
  }
  return session.sets.map((set) => `${fmt.number(set.weightKg ?? 0)} × ${reps(set.reps)}`).join(', ')
}

/** Lidhja e YouTube e përdoruesit (SPEC §12): shtimi, ndryshimi, dhe luajtja te ekrani i videos. */
function UserVideo({ detail, onWatch, onEdit }: { detail: ExerciseDetail; onWatch: () => void; onEdit: () => void }) {
  const { t } = useI18n()
  const mine = detail.videoUrl ? youtubeId(detail.videoUrl) : null
  const rowClass = 'flex min-h-16 min-w-0 flex-1 items-center gap-3 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground'
  const icon = (
    <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-md bg-surface-2">
      <Icon name="video" size={22} />
    </span>
  )
  if (!mine) {
    return (
      <button type="button" onClick={onEdit} className={cn(surfaceClass, rowClass, 'flex-none px-3 py-2.5')}>
        {icon}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="type-body-strong">{t('programme.videoAdd')}</span>
          <span className="type-caption text-muted-foreground">{t('programme.videoAddNote')}</span>
        </span>
        <Icon name="plus" size={20} className="text-muted-foreground" />
      </button>
    )
  }
  return (
    <section aria-label={t('programme.videoSheet')} className={cn(surfaceClass, 'flex min-h-16 items-center gap-1 rounded-lg py-1.5 pr-1.5 pl-3')}>
      <button type="button" onClick={onWatch} className={rowClass}>
        {icon}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="type-body-strong">{t('programme.watch')}</span>
          <span className="type-caption text-muted-foreground">{t('programme.watchYours')}</span>
        </span>
      </button>
      <Button variant="ghost" size="icon" aria-label={t('programme.videoChange')} onClick={onEdit}>
        <Icon name="laps" size={20} />
      </Button>
    </section>
  )
}

function VideoSheet({ detail, onClose }: { detail: ExerciseDetail; onClose: () => void }) {
  const { t } = useI18n()
  const [url, setUrl] = useState(detail.videoUrl ?? '')
  const [problem, setProblem] = useState(false)
  const [busy, setBusy] = useState(false)
  const inputId = useId()
  async function write(value: string | null) {
    setBusy(true)
    try {
      await setExerciseVideo(store, await exerciseRowFor(store, detail), value)
      onClose()
    } finally {
      setBusy(false)
    }
  }
  function save() {
    const value = url.trim()
    if (value && !youtubeId(value)) return setProblem(true)
    void write(value || null)
  }
  return (
    <Sheet
      title={t('programme.videoSheet')}
      description={detail.name}
      onClose={onClose}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="lg" disabled={!detail.videoUrl || busy} onClick={() => void write(null)}>
            {t('programme.videoRemove')}
          </Button>
          <Button variant="primary" size="lg" disabled={busy} onClick={save}>
            {t('common.save')}
          </Button>
        </div>
      }
    >
      <label htmlFor={inputId} className="type-label text-muted-foreground">
        {t('programme.videoLink')}
      </label>
      <input
        id={inputId}
        type="url"
        inputMode="url"
        autoComplete="off"
        placeholder="https://youtu.be/…"
        value={url}
        onChange={(event) => (setUrl(event.currentTarget.value), setProblem(false))}
        aria-invalid={problem ? true : undefined}
        className={inputClass}
      />
      {problem ? (
        <p role="alert" className="type-caption text-danger">
          {t('programme.videoInvalid')}
        </p>
      ) : null}
    </Sheet>
  )
}
