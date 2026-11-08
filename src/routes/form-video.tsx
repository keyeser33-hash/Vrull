import { useEffect, useId, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Sheet } from '@/components/layout/sheet'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icons'
import { InsightCard } from '@/components/ui/insight-card'
import { surfaceClass } from '@/components/ui/surface'
import { formVideos, store, useLocalQuery } from '@/data/app-data'
import { exerciseVideos, FORM_VIDEO_LIMITS, type FormVideoRef, setComparison, storageUsage, type StorageUsage, type VideoSet, VideoTooLargeError } from '@/data/form-videos'
import type { I18n } from '@/i18n'
import { useI18n } from '@/i18n/use-i18n'
import { localDate } from '@/lib/calendar'
import { cn } from '@/lib/cn'
import { type Camera, type CameraErrorReason, cameraErrorReason, clipTime, type Facing, openCamera, type Take } from '@/lib/form-camera'
import { useOnline } from '@/lib/use-online'
import { dotted } from './programme-format'

// Videot e formës (V2-E1-13; bordi "Seanca · Video", SPEC §12, V27). Nga ikona e kamerës te kreu i
// seancës hapet kamera për ushtrimin dhe setin në ekran: pamja e drejtpërdrejtë, regjistrimi deri në
// 60 s, krahasimi me herën e kaluar dhe "Ruaj te seti N" (prushi). Faqja e ushtrimit ka seksionin e
// vogël "Videot e formës", ku një video luhet dhe fshihet. Videot janë private (V5): ruhen në telefon
// dhe te bucket-i privat, përmes `formVideos` (app-data.ts).

const dayOf = (date: string) => new Date(`${date}T12:00:00`)
const shortDate = (date: string, fmt: I18n['fmt']) => fmt.date(dayOf(date), { weekday: false })
const LIMIT = clipTime(FORM_VIDEO_LIMITS.maxSeconds)

/** "62,5 × 10", "× 12" pa peshë, "45 s" për ushtrimet me kohë. */
function setLine(set: VideoSet | null, fmt: I18n['fmt']) {
  if (!set) return null
  if (set.reps === null) return set.seconds === null ? null : fmt.unit(set.seconds, 's')
  return set.weightKg ? `${fmt.number(set.weightKg)} × ${fmt.number(set.reps)}` : `× ${fmt.number(set.reps)}`
}

/** "8 nëntor · Seti 2" */
function dayAndSet(video: { date: string; setNumber: number | null }, { t, fmt }: I18n) {
  return video.setNumber ? t('videos.daySet', { date: shortDate(video.date, fmt), set: video.setNumber }) : shortDate(video.date, fmt)
}

/** "Fotot dhe videot zënë 812 MB nga 1 GB …", vetëm nga 80% e hapësirës së planit falas (V27). */
function StorageNote({ usage }: { usage: StorageUsage | undefined }) {
  const { t, fmt } = useI18n()
  if (!usage || usage.level === 'ok') return null
  const megabytes = usage.usedBytes / 1_000_000
  const used = megabytes >= 1000 ? fmt.unit(megabytes / 1000, 'GB', { maxDigits: 2 }) : fmt.unit(Math.round(megabytes), 'MB')
  const quota = fmt.unit(usage.quotaBytes / 1_000_000_000, 'GB')
  return (
    <InsightCard icon={null}>{t(usage.level === 'full' ? 'videos.storageFull' : 'videos.storageNear', { used, quota })}</InsightCard>
  )
}

/** Pllaka e një videoje: data sipër, butoni i luajtjes në mes, kohëzgjatja poshtë; pa video, një fjali. */
function VideoTile({
  badge,
  durationS,
  label,
  caption,
  detail,
  empty,
  compact = false,
  onPlay,
}: {
  badge: string
  durationS: number | null
  /** Për lexuesin e ekranit: "8 nëntor · Seti 2, 62,5 × 10". */
  label: string
  caption: string | null
  detail: string | null
  empty?: string
  compact?: boolean
  onPlay?: () => void
}) {
  const { t } = useI18n()
  const height = compact ? 'h-[120px]' : 'h-[174px]'
  return (
    <figure className="m-0 flex min-w-0 flex-col gap-1.5">
      {onPlay ? (
        <button
          type="button"
          aria-label={t('videos.play', { label })}
          onClick={onPlay}
          className={cn(
            height,
            'relative flex items-center justify-center rounded-lg border border-surface-border bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground',
          )}
        >
          <span className="absolute top-2 left-2 max-w-[calc(100%-16px)] truncate rounded-pill bg-background px-2 py-1 text-[13px] leading-4 font-semibold text-foreground">{badge}</span>
          <span aria-hidden className="flex size-12 items-center justify-center rounded-pill bg-background text-foreground">
            <Icon name="luaj" size={22} />
          </span>
          {durationS !== null ? (
            <span className="absolute right-2 bottom-2 rounded-pill bg-background px-2 py-0.5 text-[13px] leading-4 text-muted-foreground tabular-nums">{clipTime(durationS)}</span>
          ) : null}
        </button>
      ) : (
        <div className={cn(height, 'flex items-center justify-center rounded-lg border border-dashed border-border px-3 text-center type-caption text-muted-foreground')}>{empty}</div>
      )}
      {caption ? (
        <figcaption className="flex min-w-0 flex-col">
          <span className="truncate text-sm leading-5 font-semibold">{caption}</span>
          {detail ? <span className="text-sm leading-5 text-muted-foreground tabular-nums">{detail}</span> : null}
        </figcaption>
      ) : null}
    </figure>
  )
}

/**
 * Adresa e bajtëve të videos në telefon (ose e shkarkuar një herë); null kur s'është ngarkuar ende.
 * Varet vetëm nga ID-ja, që një lexim i ri i listës të mos e nisë videon nga fillimi.
 */
function useVideoUrl(video: FormVideoRef | null) {
  const [state, setState] = useState<{ id: string; url: string | null } | null>(null)
  const id = video?.id
  const storagePath = video?.storagePath
  const type = video?.type
  useEffect(() => {
    if (!id || !storagePath || !type) return
    let cancelled = false
    let created: string | null = null
    void formVideos.data({ id, storagePath, type }).then((data) => {
      if (cancelled) return
      created = data ? URL.createObjectURL(new Blob([data], { type })) : null
      setState({ id, url: created })
    })
    return () => {
      cancelled = true
      if (created) URL.revokeObjectURL(created)
    }
  }, [id, storagePath, type])
  return id && state?.id === id ? state.url : undefined
}

/** Luajtja në fletë: regjistrimi i sapobërë (url) ose një video e ruajtur, me "Fshi videon" kur lejohet. */
function VideoPlayerSheet({
  title,
  video,
  url,
  onClose,
  onDelete,
}: {
  title: string
  video: FormVideoRef | null
  url?: string
  onClose: () => void
  onDelete?: () => Promise<void>
}) {
  const { t } = useI18n()
  const online = useOnline()
  const saved = useVideoUrl(video)
  const source = url ?? saved
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  async function remove() {
    if (!onDelete) return
    setBusy(true)
    try {
      await onDelete()
      onClose()
    } finally {
      setBusy(false)
    }
  }
  return (
    <Sheet
      title={t('videos.title')}
      description={title}
      onClose={onClose}
      footer={
        onDelete ? (
          confirming ? (
            <div className="flex flex-col gap-2">
              <p className="type-body text-muted-foreground">{t('videos.deleteQuestion')}</p>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="lg" disabled={busy} onClick={() => setConfirming(false)}>
                  {t('common.cancel')}
                </Button>
                <Button variant="outline" size="lg" disabled={busy} className="text-danger" onClick={() => void remove()}>
                  {t('videos.deleteConfirm')}
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" size="lg" className="w-full text-danger" onClick={() => setConfirming(true)}>
              {t('videos.delete')}
            </Button>
          )
        ) : undefined
      }
    >
      {source ? (
        <video src={source} controls autoPlay playsInline className="max-h-[60dvh] w-full rounded-lg bg-surface-2" />
      ) : source === null ? (
        <p className="type-body text-muted-foreground">{online ? t('videos.waiting') : t('videos.offline')}</p>
      ) : (
        <div aria-busy="true" className="flex aspect-video items-center justify-center rounded-lg bg-surface-2 text-muted-foreground">
          <span className="sr-only">{t('videos.loading')}</span>
          <Icon name="luaj" size={28} />
        </div>
      )}
    </Sheet>
  )
}

/** Hap ose mbyll fletën e luajtjes me `?luaj=`, që butoni mbrapa i Android-it ta mbyllë. */
function usePlayerParam() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  return {
    playing: params.get('luaj'),
    play: (id: string) =>
      setParams((current) => {
        const next = new URLSearchParams(current)
        next.set('luaj', id)
        return next
      }),
    stop: () => navigate(-1),
  }
}

export interface FormVideoTarget {
  exerciseId: string
  exerciseName: string
  sessionId: string
  setNumber: number
}

async function screenData(target: FormVideoTarget) {
  const [comparison, session, usage] = await Promise.all([
    setComparison(store, target),
    store.get('workout_sessions', target.sessionId),
    storageUsage(store),
  ])
  const today = localDate(store.now())
  return { ...comparison, today, date: session ? String(session.date) : today, usage }
}

type TakeWithUrl = Take & { url: string }

/**
 * A është faqja në plan të parë (kamera fiket kur app-i del në sfond), dhe `epoch`, që rritet me çdo
 * ndërrim: një kamerë e hapur para tij nuk vlen më. `onHide` thirret në vetë ngjarjen, para çdo
 * rivizatimi, që regjistrimi të ndalet ndërsa kamera është ende e hapur.
 */
function usePageVisible(onHide: () => void) {
  const [page, setPage] = useState(() => ({ visible: document.visibilityState !== 'hidden', epoch: 0 }))
  const hide = useRef(onHide)
  useEffect(() => {
    hide.current = onHide
  })
  useEffect(() => {
    const update = () => {
      const visible = document.visibilityState !== 'hidden'
      if (!visible) hide.current()
      setPage((current) => ({ visible, epoch: current.epoch + 1 }))
    }
    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [])
  return page
}

/** Ekrani i kamerës nga seanca (bordi "Seanca · Video"), mbi seancën, pa e mbyllur atë. */
export function FormVideoScreen({ target, onClose }: { target: FormVideoTarget; onClose: () => void }) {
  const i18n = useI18n()
  const { t, fmt } = i18n
  const titleId = useId()
  const compareId = useId()
  const data = useLocalQuery(() => screenData(target), [target.exerciseId, target.sessionId, target.setNumber])
  // `finish` i rivizatimit të fundit, për thirrjet jashtë React-it (kufiri i gjatësisë, app-i në sfond).
  const finishLatest = useRef<(atLimit: boolean) => Promise<void>>(async () => {})
  // App-i në sfond: regjistrimi ndalet dhe mbahet, para se kamera të fiket.
  const page = usePageVisible(() => void finishLatest.current(false))
  const player = usePlayerParam()
  const [facing, setFacing] = useState<Facing>('environment')
  const [attempt, setAttempt] = useState(0)
  // Kamera e hapur (ose arsyeja pse nuk u hap) për një hapje: kamera, provimi përsëri, kthimi nga sfondi.
  const opening = `${facing}:${attempt}:${page.epoch}`
  const [opened, setOpened] = useState<{ key: string; camera: Camera | null; problem: CameraErrorReason | null } | null>(null)
  const current = page.visible && opened?.key === opening ? opened : null
  const camera = current?.camera ?? null
  const problem = current?.problem ?? null
  const [recording, setRecording] = useState(false)
  const [take, setTake] = useState<TakeWithUrl | null>(null)
  const [startedAt, setStartedAt] = useState(0)
  const [now, setNow] = useState(0)
  const [limitHit, setLimitHit] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveProblem, setSaveProblem] = useState<'tooBig' | 'failed' | null>(null)
  const preview = useRef<HTMLVideoElement>(null)
  const stopping = useRef(false)

  // Kamera hapet kur hapet ekrani, kur ndërrohet, kur provohet përsëri dhe kur app-i kthehet nga sfondi.
  useEffect(() => {
    if (!page.visible) return
    let cancelled = false
    let live: Camera | null = null
    openCamera(facing).then(
      (next) => {
        if (cancelled) return next.close()
        live = next
        setOpened({ key: opening, camera: next, problem: null })
      },
      (error: unknown) => {
        if (!cancelled) setOpened({ key: opening, camera: null, problem: cameraErrorReason(error) })
      },
    )
    return () => {
      cancelled = true
      live?.close()
    }
  }, [facing, page.visible, opening])

  useEffect(() => {
    if (preview.current) preview.current.srcObject = camera?.stream ?? null
  }, [camera])

  useEffect(() => {
    if (!recording) return
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [recording])

  // Adresa e regjistrimit të mëparshëm lirohet kur vjen një i ri ose kur mbyllet ekrani.
  useEffect(() => (take ? () => URL.revokeObjectURL(take.url) : undefined), [take])

  async function finish(atLimit: boolean) {
    if (!camera || !recording || stopping.current) return
    stopping.current = true
    try {
      const result = await camera.stop()
      setTake({ ...result, url: URL.createObjectURL(result.blob) })
      setLimitHit(atLimit)
    } catch {
      // Regjistrimi u ndërpre (p.sh. kamera u fik); mbetet regjistrimi i mëparshëm.
    } finally {
      stopping.current = false
      setRecording(false)
    }
  }

  useEffect(() => {
    finishLatest.current = finish
  })

  function record() {
    if (!camera) return
    setLimitHit(false)
    setSaveProblem(null)
    camera.record(() => void finishLatest.current(true))
    const start = Date.now()
    setStartedAt(start)
    setNow(start)
    setRecording(true)
  }

  async function save() {
    if (!take || !data) return
    setSaving(true)
    setSaveProblem(null)
    try {
      await formVideos.add({
        exerciseId: target.exerciseId,
        sessionId: target.sessionId,
        setNumber: target.setNumber,
        date: data.date,
        data: await take.blob.arrayBuffer(),
        type: take.type,
        durationS: take.durationS,
        width: take.width,
        height: take.height,
      })
      onClose()
    } catch (error) {
      setSaveProblem(error instanceof VideoTooLargeError ? 'tooBig' : 'failed')
    } finally {
      setSaving(false)
    }
  }

  const elapsed = recording ? Math.min((now - startedAt) / 1000, FORM_VIDEO_LIMITS.maxSeconds) : 0
  const today = data?.today
  const date = data?.date ?? ''
  // Pllaka e majtë: regjistrimi i sapobërë, ose videoja e ruajtur e këtij seti.
  const ours = take ? { id: 'take', durationS: take.durationS } : data?.current ? { id: data.current.id, durationS: data.current.durationS } : null
  const ourCaption = date ? t('videos.daySet', { date: shortDate(date, fmt), set: target.setNumber }) : ''
  const ourDetail = setLine(data?.set ?? null, fmt)
  const previous = data?.previous ?? null
  const playingSaved = player.playing && player.playing !== 'take' ? [data?.current, previous].find((video) => video?.id === player.playing) ?? null : null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex flex-col bg-background pt-[var(--safe-top)] pb-[var(--safe-bottom)] text-foreground"
    >
      <div className="mx-auto flex min-h-0 w-full max-w-[480px] flex-1 flex-col">
        <header className="grid h-14 shrink-0 grid-cols-[44px_minmax(0,1fr)_44px] items-center px-2">
          <Button variant="ghost" size="icon" aria-label={t('videos.close')} className="rounded-pill" onClick={onClose}>
            <Icon name="mbyll-vrull" size={22} />
          </Button>
          <h1 id={titleId} className="type-title truncate text-center">
            {t('videos.title')}
          </h1>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('videos.switch')}
            className="rounded-pill"
            disabled={recording || problem === 'unsupported'}
            onClick={() => setFacing((current) => (current === 'environment' ? 'user' : 'environment'))}
          >
            <Icon name="kamera-kthe" size={22} />
          </Button>
        </header>

        <main className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-4 pt-1 pb-2">
          {/* 340 px si te bordi; ulet deri në 240 px kur mesazhet nuk do të nxinin ndryshe në ekran. */}
          <div className={cn(surfaceClass, 'relative min-h-[240px] shrink grow-0 basis-[340px] overflow-hidden rounded-xl')}>
            <div role="img" aria-label={t('videos.camera')} className="absolute inset-0">
              <video
                ref={preview}
                muted
                autoPlay
                playsInline
                className={cn('size-full object-cover', camera?.facing === 'user' && '-scale-x-100', !camera && 'hidden')}
              />
              {camera ? null : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 pb-14 text-center text-muted-foreground">
                  <Icon name="kamera" size={32} />
                  <span className="type-label">{t('videos.cameraLabel')}</span>
                  <span className="type-caption">{t('videos.cameraHint')}</span>
                </div>
              )}
            </div>
            <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
              <span className="min-w-0 truncate rounded-pill bg-background px-2.5 py-1.5 text-sm leading-[18px] font-semibold">
                {t('videos.exerciseSet', { exercise: target.exerciseName, set: target.setNumber })}
              </span>
              {recording ? (
                <span
                  role="timer"
                  aria-label={t('videos.recordingLabel', { duration: clipTime(elapsed), limit: LIMIT })}
                  className="flex shrink-0 items-center gap-1.5 rounded-pill bg-background px-2.5 py-1.5 text-sm leading-[18px] font-semibold tabular-nums"
                >
                  <span aria-hidden className="size-2 rounded-pill bg-ember" />
                  {t('videos.recording', { duration: clipTime(elapsed), limit: LIMIT })}
                </span>
              ) : ours ? (
                <span className="shrink-0 rounded-pill bg-background px-2.5 py-1.5 text-sm leading-[18px] text-muted-foreground tabular-nums">
                  {t('videos.recorded', { duration: clipTime(ours.durationS) })}
                </span>
              ) : null}
            </div>
            <button
              type="button"
              aria-label={t(recording ? 'videos.stop' : ours ? 'videos.recordAgain' : 'videos.record')}
              disabled={!camera || saving}
              onClick={recording ? () => void finish(false) : record}
              className="absolute bottom-4 left-1/2 flex size-[72px] -translate-x-1/2 items-center justify-center rounded-pill border-4 border-foreground disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
            >
              <span aria-hidden className={cn('bg-foreground transition-all duration-240', recording ? 'size-7 rounded-sm' : 'size-[52px] rounded-pill')} />
            </button>
          </div>

          {problem ? (
            <div role="alert" className="flex flex-col items-start gap-2">
              <p className="type-body">{t(`videos.${problem}`)}</p>
              {problem === 'unsupported' ? null : (
                <Button variant="outline" onClick={() => setAttempt((count) => count + 1)}>
                  {t('common.retry')}
                </Button>
              )}
            </div>
          ) : null}
          {limitHit ? <p className="type-caption text-muted-foreground">{t('videos.limitReached', { limit: LIMIT })}</p> : null}

          {data && (ours || previous) ? (
            <section aria-labelledby={compareId} className="flex flex-col gap-2">
              <h2 id={compareId} className="type-label text-muted-foreground">
                {t('videos.compare')}
              </h2>
              <div className="grid grid-cols-2 gap-2.5">
                <VideoTile
                  badge={date === today ? t('videos.today') : shortDate(date, fmt)}
                  durationS={ours?.durationS ?? null}
                  label={[ourCaption, ourDetail].filter(Boolean).join(', ')}
                  caption={ourCaption}
                  detail={ourDetail}
                  empty={t('videos.noTake')}
                  onPlay={ours ? () => player.play(ours.id) : undefined}
                />
                <VideoTile
                  badge={previous ? shortDate(previous.date, fmt) : ''}
                  durationS={previous?.durationS ?? null}
                  label={previous ? [dayAndSet(previous, i18n), setLine(previous.set, fmt)].filter(Boolean).join(', ') : ''}
                  caption={previous ? dayAndSet(previous, i18n) : null}
                  detail={previous ? setLine(previous.set, fmt) : null}
                  empty={t('videos.noPrevious')}
                  onPlay={previous ? () => player.play(previous.id) : undefined}
                />
              </div>
            </section>
          ) : null}

          <p className="flex items-center gap-2 type-caption text-muted-foreground">
            <Icon name="kyc" size={18} />
            <span>{t('videos.private')}</span>
          </p>
          <StorageNote usage={data?.usage} />
          {saveProblem ? (
            <p role="alert" className="type-body text-danger">
              {saveProblem === 'tooBig' ? t('videos.tooBig', { limit: fmt.unit(FORM_VIDEO_LIMITS.maxBytes / 1024 / 1024, 'MB') }) : t('videos.saveFailed')}
            </p>
          ) : null}
        </main>

        <div className="shrink-0 px-4 pt-2.5 pb-5">
          <Button variant="primary" size="xl" disabled={!take || recording || saving || !data} onClick={() => void save()}>
            {t('videos.save', { set: target.setNumber })}
          </Button>
        </div>
      </div>

      {player.playing === 'take' && take ? <VideoPlayerSheet title={dotted([ourCaption, ourDetail])} video={null} url={take.url} onClose={player.stop} /> : null}
      {playingSaved ? <VideoPlayerSheet title={dotted([dayAndSet(playingSaved, i18n), setLine(playingSaved.set, fmt)])} video={playingSaved} onClose={player.stop} /> : null}
    </div>
  )
}

/** "Videot e formës" te faqja e ushtrimit: më të rejat, luajtja dhe fshirja. */
export function FormVideosSection({ exerciseId }: { exerciseId: string | null }) {
  const i18n = useI18n()
  const { t, fmt } = i18n
  const headingId = useId()
  const section = useLocalQuery(async () => ({ today: localDate(store.now()), videos: exerciseId ? await exerciseVideos(store, exerciseId) : [] }), [exerciseId])
  const videos = section?.videos
  const player = usePlayerParam()
  const [all, setAll] = useState(false)
  if (!videos?.length) return null
  const shown = all ? videos : videos.slice(0, 4)
  const playing = videos.find((video) => video.id === player.playing) ?? null
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h2 id={headingId} className="type-title">
        {t('videos.section')}
      </h2>
      <div className="grid grid-cols-2 gap-2.5">
        {shown.map((video) => (
          <VideoTile
            key={video.id}
            compact
            badge={video.date === section?.today ? t('videos.today') : shortDate(video.date, fmt)}
            durationS={video.durationS}
            label={[dayAndSet(video, i18n), setLine(video.set, fmt)].filter(Boolean).join(', ')}
            caption={dayAndSet(video, i18n)}
            detail={setLine(video.set, fmt)}
            onPlay={() => player.play(video.id)}
          />
        ))}
      </div>
      {videos.length > shown.length ? (
        <Button variant="outline" className="w-full" onClick={() => setAll(true)}>
          {t('videos.showAll', { count: videos.length })}
        </Button>
      ) : null}
      {playing ? (
        <VideoPlayerSheet
          title={dotted([dayAndSet(playing, i18n), setLine(playing.set, fmt)])}
          video={playing}
          onClose={player.stop}
          onDelete={() => formVideos.remove(playing.id)}
        />
      ) : null}
    </section>
  )
}
