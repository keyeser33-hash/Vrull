import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { BackButton } from '@/components/layout/page'
import { Sheet } from '@/components/layout/sheet'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button-variants'
import { Icon } from '@/components/ui/icons'
import { photos, useLocalQuery } from '@/data/app-data'
import { localDate } from '@/lib/calendar'
import { type Pose, POSES, type PhotoDay, type PhotoRef } from '@/data/photos'
import { compressPhoto } from '@/lib/image'
import { cn } from '@/lib/cn'
import { dateLabel } from './training-format'

// Fotot e progresit (SPEC §8, TH-12): para, anash, mbrapa. Pozat bosh hapin kamerën; një foto e
// bërë hapet në fletë (?foto=id) me "Bëj foto të re" dhe "Fshi". Kompresimi bëhet në telefon.

const dayText = (date: string) => dateLabel(new Date(`${date}T12:00:00`))
const poseLabel = (pose: Pose) => POSES.find((entry) => entry.pose === pose)?.label ?? ''

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
  const url = usePhotoUrl(photo)
  if (url === undefined) return <span aria-hidden className={cn('block bg-skeleton', className)} />
  if (url === null) return <span className={cn('flex items-center justify-center p-2 text-center text-xs leading-4 text-muted-foreground', className)}>Pret ngarkimin nga telefoni tjetër</span>
  return <img src={url} alt="" className={cn('object-cover', className)} />
}

/** Butoni që hap kamerën (ose galerinë) dhe ruan foton e kompresuar për sot. */
function CaptureButton({ pose, className, children, onSaved }: { pose: Pose; className?: string; children: React.ReactNode; onSaved?: () => void }) {
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
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
            setProblem(null)
            void compressPhoto(file)
              .then((compressed) => photos.add({ date: localDate(new Date()), pose, ...compressed }))
              .then(() => onSaved?.())
              .catch(() => setProblem('Foto nuk u ruajt. Provo përsëri.'))
              .finally(() => setBusy(false))
          }}
        />
        {busy ? <span className="text-sm leading-5">Po ruhet</span> : children}
      </label>
      {problem ? (
        <p role="alert" className="text-sm leading-5 text-destructive">
          {problem}
        </p>
      ) : null}
    </>
  )
}

/** Fotot e fundit për çdo pozë, te Progresi. */
export function PhotoSection() {
  const timeline = useLocalQuery(() => photos.timeline(), [])
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  if (!timeline) return null
  const latest = Object.fromEntries(POSES.map(({ pose }) => [pose, timeline.find((day) => day.photos[pose])?.photos[pose]])) as Partial<Record<Pose, PhotoRef>>
  const opened = timeline.flatMap((day) => Object.values(day.photos)).find((photo) => photo?.id === params.get('foto'))
  return (
    <section aria-labelledby="photos-title" className="flex flex-col gap-2">
      <div className="flex min-h-11 items-center justify-between gap-3">
        <h2 id="photos-title" className="text-sm leading-5 font-semibold text-muted-foreground">
          Fotot e progresit
        </h2>
        {timeline.length > 0 ? (
          <Link to="/progresi/fotot" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'min-h-11')}>
            Të gjitha
          </Link>
        ) : null}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {POSES.map(({ pose, label }) => {
          const photo = latest[pose]
          return photo ? (
            <button
              key={pose}
              type="button"
              aria-label={`${label}, ${dayText(photo.date)}`}
              onClick={() => setParams({ foto: photo.id })}
              className="relative aspect-[3/4] overflow-hidden rounded-lg bg-secondary"
            >
              <Thumb photo={photo} className="size-full" />
              <span className="absolute inset-x-0 bottom-0 bg-overlay px-2 py-1 text-left text-xs leading-4 font-medium text-panel-foreground">{label}</span>
            </button>
          ) : (
            <CaptureButton
              key={pose}
              pose={pose}
              className="flex aspect-[3/4] flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-input text-sm leading-5 text-muted-foreground hover:bg-accent"
            >
              <Icon name="shto" size={22} />
              <span>{label}</span>
            </CaptureButton>
          )
        })}
      </div>
      <p className="text-xs leading-4 text-muted-foreground">
        {timeline.length > 0 ? `E fundit: ${dayText(timeline[0].date)}. ` : ''}Në të njëjtin vend dhe dritë çdo herë, që ndryshimi të duket.
      </p>
      {opened ? <PhotoViewer photo={opened} onClose={() => navigate(-1)} /> : null}
    </section>
  )
}

export function PhotosPage() {
  const timeline = useLocalQuery(() => photos.timeline(), [])
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  if (!timeline) return <h1 className="sr-only">Fotot e progresit</h1>
  const opened = timeline.flatMap((day) => Object.values(day.photos)).find((photo) => photo?.id === params.get('foto'))
  return (
    <div className="flex flex-col gap-5">
      <header className="flex min-h-11 items-center">
        <BackButton label="Kthehu te progresi" />
      </header>
      <h1 className="text-3xl leading-9 font-bold tracking-[-0.025em]">Fotot e progresit</h1>
      {timeline.length === 0 ? <p className="text-sm leading-5 text-muted-foreground">Ende pa foto.</p> : null}
      {timeline.map((day: PhotoDay) => (
        <section key={day.date} aria-label={dayText(day.date)} className="flex flex-col gap-2">
          <h2 className="text-sm leading-5 font-semibold">{dayText(day.date)}</h2>
          <div className="grid grid-cols-3 gap-2">
            {POSES.map(({ pose, label }) => {
              const photo = day.photos[pose]
              return photo ? (
                <button
                  key={pose}
                  type="button"
                  aria-label={`${label}, ${dayText(day.date)}`}
                  onClick={() => setParams({ foto: photo.id })}
                  className="aspect-[3/4] overflow-hidden rounded-lg bg-secondary"
                >
                  <Thumb photo={photo} className="size-full" />
                </button>
              ) : (
                <span key={pose} className="flex aspect-[3/4] items-center justify-center rounded-lg border border-dashed border-border text-xs leading-4 text-muted-foreground">
                  Pa {label.toLowerCase()}
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
  const [confirm, setConfirm] = useState(false)
  return (
    <Sheet title={`${poseLabel(photo.pose)} · ${dayText(photo.date)}`} onClose={onClose}>
      <div className="flex justify-center overflow-hidden rounded-lg bg-secondary">
        <Thumb photo={photo} className="max-h-[56dvh] w-full object-contain" />
      </div>
      <CaptureButton pose={photo.pose} onSaved={onClose} className={buttonVariants({ variant: 'outline' })}>
        Bëj foto të re sot
      </CaptureButton>
      {confirm ? (
        <div role="alert" className="flex flex-col gap-2 rounded-md border border-destructive p-3">
          <p className="text-sm leading-5">Foto fshihet nga ky telefon dhe nga llogaria.</p>
          <Button variant="destructive" onClick={() => void photos.remove(photo.id).then(onClose)}>
            Po, fshije
          </Button>
        </div>
      ) : (
        <Button variant="ghost" className="text-destructive" onClick={() => setConfirm(true)}>
          Fshi foton
        </Button>
      )}
    </Sheet>
  )
}
