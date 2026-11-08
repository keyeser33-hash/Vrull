import { useNavigate, useSearchParams } from 'react-router'
import { Sheet } from '@/components/layout/sheet'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icons'
import { ProgressTrack } from '@/components/ui/progress-bar'
import { surfaceClass } from '@/components/ui/surface'
import { updater, useAppUpdate } from '@/data/app-data'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import type { Release, UpdateState } from '@/update/updater'
import { failureText, megabytes, updateDetail } from './update-format'

// Përditësimi brenda app-it (SPEC §3b, TH-23; bordi "Përditësimi"). Te Sot, një rresht i qetë kur ka
// version të ri; fleta ka çfarë ka të re, "Si shkon" me tre hapat (shkarkimi me shiritin, leja e
// Android-it herën e parë, instalimi) dhe "Përditëso" në fund. Te Cilësimet, rreshti "Versioni"
// hap të njëjtën fletë.

/** Rreshti te Sot: vetëm kur ka një version të ri në pritje; hap fletën (?perditesimi=1). */
export function UpdateNotice() {
  const i18n = useI18n()
  const state = useAppUpdate()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const release = 'release' in state ? state.release : undefined
  return (
    <>
      {release ? (
        <button
          type="button"
          onClick={() => setParams((current) => (current.set('perditesimi', '1'), current))}
          className={cn(surfaceClass, 'flex min-h-14 items-center gap-3 rounded-lg px-4 py-2.5 text-left')}
        >
          <Icon name="shkarko-vrull" size={22} className="shrink-0 text-muted-foreground" />
          <span className="flex flex-1 flex-col">
            <span className="type-body-strong">{i18n.t('update.ready', { version: release.version })}</span>
            <span className="type-caption text-muted-foreground tabular-nums">{updateDetail(state, i18n)}</span>
          </span>
          <Icon name="hap" size={20} className="shrink-0 text-muted-foreground" />
        </button>
      ) : null}
      {params.get('perditesimi') ? <UpdateSheet onClose={() => navigate(-1)} /> : null}
    </>
  )
}

export function UpdateSheet({ onClose }: { onClose: () => void }) {
  const i18n = useI18n()
  const { t } = i18n
  const state = useAppUpdate()
  const release = 'release' in state ? state.release : undefined
  if (!release) {
    return (
      <Sheet title={t('update.title')} onClose={onClose}>
        <NoRelease state={state} />
      </Sheet>
    )
  }
  return (
    <Sheet
      title={t('update.versionTitle', { version: release.version })}
      description={t('update.summary', { current: __APP_VERSION__, size: megabytes(release.bytes, i18n) })}
      onClose={onClose}
      footer={<ReleaseAction state={state} />}
    >
      {release.notes.length > 0 ? (
        <section aria-labelledby="update-whats-new" className="flex flex-col gap-2">
          <h3 id="update-whats-new" className="type-label text-muted-foreground">
            {t('update.whatsNew')}
          </h3>
          <ul aria-labelledby="update-whats-new" className="flex flex-col gap-1.5">
            {release.notes.map((note) => (
              <li key={note} className="flex gap-2.5 type-body-strong font-normal">
                <span aria-hidden className="mt-[9px] size-1.5 shrink-0 rounded-pill bg-foreground" />
                {note}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <Steps state={state} release={release} />
      {state.status === 'failed' ? (
        <p role="alert" className="type-body text-danger">
          {failureText(state.reason, i18n)}
        </p>
      ) : null}
    </Sheet>
  )
}

/** "Si shkon": hapi i tanishëm me rreth `foreground`, të tjerët me rreth `subtle`. */
function Steps({ state, release }: { state: UpdateState; release: Release }) {
  const i18n = useI18n()
  const { t } = i18n
  const progress = state.status === 'downloading' ? state.progress : state.status === 'installing' ? 1 : 0
  const total = megabytes(release.bytes, i18n)
  const done = i18n.fmt.number(Math.round((release.bytes * progress) / 1_048_576))
  const current = state.status === 'permission' ? 2 : state.status === 'installing' ? 3 : 1
  const step = (number: number) => (
    <span
      aria-hidden
      className={cn(
        'flex size-[26px] shrink-0 items-center justify-center rounded-pill border-2 text-[13px] font-bold tabular-nums',
        number === current ? 'border-foreground text-foreground' : 'border-subtle text-muted-foreground',
      )}
    >
      {number}
    </span>
  )
  return (
    <section aria-labelledby="update-how" className="flex flex-col gap-2">
      <h3 id="update-how" className="type-label text-muted-foreground">
        {t('update.howItWorks')}
      </h3>
      <ol className="flex flex-col rounded-lg border border-border bg-background">
        <li className="flex gap-3 border-b border-border px-3.5 py-3">
          {step(1)}
          <span className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="type-body-strong">{t('update.stepDownload')}</span>
            <span
              role="progressbar"
              aria-label={t('update.stepDownload')}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress * 100)}
              aria-valuetext={t('update.of', { done, total })}
            >
              <ProgressTrack ratio={progress} ground="page" className="h-2" />
            </span>
            <span className="flex justify-between gap-2 type-caption text-muted-foreground tabular-nums">
              <span>
                {state.status === 'downloading'
                  ? updateDetail(state, i18n)
                  : progress === 1
                    ? t('update.stepDownloadDone')
                    : t('update.stepDownloadIdle')}
              </span>
              <span className="shrink-0">{t('update.of', { done, total })}</span>
            </span>
          </span>
        </li>
        <li className="flex gap-3 border-b border-border px-3.5 py-3">
          {step(2)}
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="type-body-strong">{t('update.stepPermission')}</span>
            <span className="type-caption text-muted-foreground">{t('update.stepPermissionText')}</span>
          </span>
        </li>
        <li className="flex gap-3 px-3.5 py-3">
          {step(3)}
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="type-body-strong">{t('update.stepInstall')}</span>
            <span className="type-caption text-muted-foreground">{state.status === 'installing' ? t('update.installing') : t('update.stepInstallText')}</span>
          </span>
        </li>
      </ol>
    </section>
  )
}

/** Veprimi në fund të fletës: "Përditëso" (prushi, i vetmi në fletë), ose leja, ose provo përsëri. */
function ReleaseAction({ state }: { state: UpdateState }) {
  const { t } = useI18n()
  const update = () => void updater.update()
  switch (state.status) {
    case 'available':
      return (
        <Button variant="primary" size="xl" onClick={update}>
          <Icon name="shkarko-vrull" size={22} />
          {t('update.update')}
        </Button>
      )
    case 'permission':
      return (
        <div className="grid gap-2">
          <Button variant="primary" size="xl" onClick={() => void updater.allowInstall()}>
            {t('update.allowInstall')}
          </Button>
          <Button variant="outline" size="lg" className="w-full" onClick={update}>
            {t('update.update')}
          </Button>
        </div>
      )
    case 'failed':
      return (
        <Button variant="primary" size="xl" onClick={update}>
          {t('common.retry')}
        </Button>
      )
    default:
      // Shkarkimi dhe instalimi ecin vetë; hapat sipër tregojnë ku janë.
      return null
  }
}

/** Pa version të ri: "Ke versionin e fundit", ose gjendja e kontrollit, me "Kontrollo tani". */
function NoRelease({ state }: { state: UpdateState }) {
  const i18n = useI18n()
  const { t } = i18n
  const check = () => void updater.check({ force: true })
  if (state.status === 'failed') {
    return (
      <>
        <p role="alert" className="type-body text-danger">
          {failureText(state.reason, i18n)}
        </p>
        <Button variant="outline" size="lg" className="w-full" onClick={check}>
          {t('common.retry')}
        </Button>
      </>
    )
  }
  return (
    <>
      <p className="type-body">
        {state.status === 'current'
          ? t('update.current', { version: __APP_VERSION__ })
          : (updateDetail(state, i18n) ?? t('update.youHave', { version: __APP_VERSION__ }))}
      </p>
      <Button variant="outline" size="lg" className="w-full" disabled={state.status === 'checking'} onClick={check}>
        {t('update.checkNow')}
      </Button>
    </>
  )
}
