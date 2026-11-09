import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { BackHeader } from '@/components/layout/page'
import { Sheet } from '@/components/layout/sheet'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button-variants'
import { Icon } from '@/components/ui/icons'
import { photos, useLocalQuery } from '@/data/app-data'
import { localDate } from '@/lib/calendar'
import { type Pose, POSES, type PhotoDay, type PhotoRef } from '@/data/photos'
import type { Format } from '@/i18n'
import { useI18n } from '@/i18n/use-i18n'
import { compressPhoto } from '@/lib/image'
import { cn } from '@/lib/cn'

// Fotot e progresit (SPEC §8, TH-12; në Vrull me V2-E1-16b): para, anash, mbrapa. Pozat bosh hapin
// kamerën; një foto e bërë hapet në fletë (?foto=id) me "Bëj foto të re sot" dhe "Fshi foton".
// Kompresimi bëhet në telefon. Tekstet: 'photos.*'. Mbi foto, emri i pozës është në `on-ink` mbi
// `scrim`, që të lexohet mbi çdo foto dhe në çdo temë.

/** "8 nëntor" / "8 November"; me ditën e javës te titujt e ditëve. */
const dayText = (fmt: Format, date: string, weekday = false) => fmt.date(new Date(`${date}T12:00:00`), { weekday })

function usePhotoUrl(photo: PhotoRef | undefined) {
  const [state, setState] = useState<{ id: string; url: string | null } | null>(null)
  useEffect(() => {
    if (!photo) return
    let cancelled = false
    let created: string | null = null
    void photos.data(photo).then((data) => {
      if (cancelled) return
      created = data ? URL.createObjectURL(new Blob([data], { type: 'image/jpeg' })) : null
      setState({ id: photo.id, url: created })
    })
    return () => {
      cancelled = true
      if (created) URL.revokeObjectURL(created)
    }
  }, [photo])
  return photo && state?.id === photo.id ? state.url : undefined
}

function Thumb({ photo, className }: { photo: PhotoRef; className?: string }) {
  const { t } = useI18n()
  const url = usePhotoUrl(photo)
  if (url === undefined) return <span aria-hidden className={cn('block bg-surface-2', className)} />
  if (url === null) return <span className={cn('flex items-center justify-center p-2 text-center type-caption text-muted-foreground', className)}>{t('photos.waiting')}</span>
  return <img src={url} alt="" className={cn('object-cover', className)} />
}

/** Butoni që hap kamerën (ose galerinë) dhe ruan foton e kompresuar për sot. */
function CaptureButton({ pose, className, children, onSaved }: { pose: Pose; className?: string; children: React.ReactNode; onSaved?: () => void }) {
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  return (
    <>
      <label className={cn('cursor-pointer', busy && 'pointer-events-none opacity-60', className)}>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0]
            event.currentTarget.value = ''
            if (!file) return
            setBusy(true)
            setFailed(false)
            void compressPhoto(file)
              .then((compressed) => photos.add({ date: localDate(new Date()), pose, ...compressed }))
              .then(() => onSaved?.())
              .catch(() => setFailed(true))
              .finally(() => setBusy(false))
          }}
        />
        {busy ? <span className="type-caption">{t('photos.saving')}</span> : children}
      </label>
      {failed ? (
        <p role="alert" className="type-caption text-danger">
          {t('photos.saveFailed')}
        </p>
      ) : null}
    </>
  )
}

/**
 * Fotot e fundit për çdo pozë, me shtimin e fotos së sotme, në krye të faqes së fotove (që nga 0.23
 * Progresi ka vetëm rreshtin e fotove, bordi "Progresi"). Prekja e një fotoje e hap faqja, në fletë.
 */
function PhotoSection() {
  const { t, fmt } = useI18n()
  const timeline = useLocalQuery(() => photos.timeline(), [])
  const [, setParams] = useSearchParams()
  if (!timeline) return null
  const latest = Object.fromEntries(POSES.map((pose) => [pose, timeline.find((day) => day.photos[pose])?.photos[pose]])) as Partial<Record<Pose, PhotoRef>>
  return (
    <section aria-labelledby="photos-title" className="flex flex-col gap-2">
      <div className="flex min-h-11 items-center justify-between gap-3">
        <h2 id="photos-title" className="type-label text-muted-foreground">
          {t('photos.title')}
        </h2>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {POSES.map((pose) => {
          const photo = latest[pose]
          const label = t(`photos.pose.${pose}`)
          return photo ? (
            <button
              key={pose}
              type="button"
              aria-label={`${label}, ${dayText(fmt, photo.date)}`}
              onClick={() => setParams({ foto: photo.id })}
              className="relative aspect-[3/4] overflow-hidden rounded-lg bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
            >
              <Thumb photo={photo} className="size-full" />
              <span className="absolute inset-x-0 bottom-0 bg-scrim px-2 py-1 text-left text-xs leading-4 font-semibold text-on-ink">{label}</span>
            </button>
          ) : (
            <CaptureButton
              key={pose}
              pose={pose}
              className="flex aspect-[3/4] flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-subtle type-caption text-muted-foreground hover:bg-surface"
            >
              <Icon name="shto" size={22} />
              <span>{label}</span>
            </CaptureButton>
          )
        })}
      </div>
      <p className="type-caption text-muted-foreground">
        {timeline.length > 0 ? `${t('photos.latest', { date: dayText(fmt, timeline[0].date) })} ` : ''}
        {t('photos.hint')}
      </p>
    </section>
  )
}

export function PhotosPage() {
  const { t, fmt } = useI18n()
  const timeline = useLocalQuery(() => photos.timeline(), [])
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  if (!timeline) return <h1 className="sr-only">{t('photos.title')}</h1>
  const opened = timeline.flatMap((day) => Object.values(day.photos)).find((photo) => photo?.id === params.get('foto'))
  return (
    <div className="flex flex-col gap-5">
      <BackHeader title={t('photos.title')} back={t('body.backToProgress')} fallback="/progresi" />
      <PhotoSection />
      {timeline.length === 0 ? <p className="type-body text-muted-foreground">{t('photos.none')}</p> : null}
      {timeline.map((day: PhotoDay) => (
        <section key={day.date} aria-label={dayText(fmt, day.date, true)} className="flex flex-col gap-2">
          <h2 className="type-body-strong first-letter:uppercase">{dayText(fmt, day.date, true)}</h2>
          <div className="grid grid-cols-3 gap-2">
            {POSES.map((pose) => {
              const photo = day.photos[pose]
              return photo ? (
                <button
                  key={pose}
                  type="button"
                  aria-label={`${t(`photos.pose.${pose}`)}, ${dayText(fmt, day.date)}`}
                  onClick={() => setParams({ foto: photo.id })}
                  className="aspect-[3/4] overflow-hidden rounded-lg bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
                >
                  <Thumb photo={photo} className="size-full" />
                </button>
              ) : (
                <span key={pose} className="flex aspect-[3/4] items-center justify-center rounded-lg border border-dashed border-subtle p-2 text-center type-caption text-muted-foreground">
                  {t(`photos.missing.${pose}`)}
                </span>
              )
            })}
          </div>
        </section>
      ))}
      {opened ? <PhotoViewer photo={opened} onClose={() => navigate(-1)} /> : null}
    </div>
  )
}

function PhotoViewer({ photo, onClose }: { photo: PhotoRef; onClose: () => void }) {
  const { t, fmt } = useI18n()
  const [confirm, setConfirm] = useState(false)
  return (
    <Sheet title={`${t(`photos.pose.${photo.pose}`)} · ${dayText(fmt, photo.date)}`} onClose={onClose}>
      <div className="flex justify-center overflow-hidden rounded-lg bg-surface-2">
        <Thumb photo={photo} className="max-h-[56dvh] w-full object-contain" />
      </div>
      <CaptureButton pose={photo.pose} onSaved={onClose} className={buttonVariants({ variant: 'outline', size: 'lg' })}>
        {t('photos.retake')}
      </CaptureButton>
      {confirm ? (
        <div role="alert" className="flex flex-col gap-2 rounded-md border border-danger p-3">
          <p className="type-body">{t('photos.deleteText')}</p>
          <Button variant="secondary" size="lg" className="text-danger" onClick={() => void photos.remove(photo.id).then(onClose)}>
            {t('photos.confirmDelete')}
          </Button>
        </div>
      ) : (
        <Button variant="ghost" size="lg" className="text-danger" onClick={() => setConfirm(true)}>
          {t('photos.delete')}
        </Button>
      )}
    </Sheet>
  )
}
