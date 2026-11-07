import { useNavigate, useSearchParams } from 'react-router'
import { Sheet } from '@/components/layout/sheet'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icons'
import { updater, useAppUpdate } from '@/data/app-data'
import type { UpdateState } from '@/update/updater'
import { FAILURE_TEXT, megabytes, percent, updateDetail } from './update-format'

// Përditësimi brenda app-it (SPEC §3b, TH-23). Te Sot, një rresht i qetë kur ka version të ri
// (si njoftimet brenda faqes te Mindtrip); fleta, si "What's new" te Insight Timer, ka çfarë ka të
// re dhe një veprim. Te Cilësimet, rreshti "Versioni" hap të njëjtën fletë.

/** Rreshti te Sot: vetëm kur ka një version të ri në pritje; hap fletën (?perditesimi=1). */
export function UpdateNotice() {
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
          className="flex min-h-14 items-center gap-3 rounded-xl border border-border bg-card px-4 py-2.5 text-left"
        >
          <Icon name="shkarko" size={22} className="shrink-0 text-muted-foreground" />
          <span className="flex flex-1 flex-col">
            <span className="text-base leading-6 font-medium">Versioni {release.version} është gati</span>
            <span className="text-sm leading-5 text-muted-foreground">{updateDetail(state)}</span>
          </span>
          <Icon name="chevron-djathtas" size={20} className="shrink-0 text-muted-foreground" />
        </button>
      ) : null}
      {params.get('perditesimi') ? <UpdateSheet onClose={() => navigate(-1)} /> : null}
    </>
  )
}

export function UpdateSheet({ onClose }: { onClose: () => void }) {
  const state = useAppUpdate()
  const release = 'release' in state ? state.release : undefined
  return (
    <Sheet title={release ? `Versioni ${release.version}` : 'Përditësimi'} onClose={onClose}>
      {release ? (
        <>
          <p className="text-sm leading-5 text-muted-foreground">
            Ke {__APP_VERSION__}. Shkarkimi: {megabytes(release.bytes)}.
          </p>
          {release.notes.length > 0 ? (
            <>
              <h3 className="text-sm leading-5 font-semibold">Çfarë ka të re</h3>
              <ul aria-label="Çfarë ka të re" className="flex list-disc flex-col gap-1 pl-5 text-base leading-6">
                {release.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </>
          ) : null}
        </>
      ) : null}
      <UpdateStatus state={state} />
    </Sheet>
  )
}

function UpdateStatus({ state }: { state: UpdateState }) {
  const update = () => void updater.update()
  switch (state.status) {
    case 'available':
      return <Button onClick={update}>Përditëso</Button>
    case 'permission':
      return (
        <>
          <p className="text-sm leading-5">
            Herën e parë Android-i kërkon lejen "Instalo app të panjohura" për Training Hub. Lejoje, kthehu këtu dhe prek "Përditëso".
          </p>
          <Button onClick={() => void updater.allowInstall()}>Lejo instalimin</Button>
          <Button variant="outline" onClick={update}>
            Përditëso
          </Button>
        </>
      )
    case 'downloading':
      return (
        <div className="flex flex-col gap-2">
          <div
            role="progressbar"
            aria-label="Shkarkimi"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(state.progress * 100)}
            className="h-2 overflow-hidden rounded-full bg-muted"
          >
            <div className="h-full rounded-full bg-foreground transition-[width]" style={{ width: percent(state.progress) }} />
          </div>
          <p className="text-sm leading-5 text-muted-foreground tabular-nums">{updateDetail(state)}</p>
        </div>
      )
    case 'installing':
      return <p className="text-sm leading-5">Po instalohet. Training Hub mbyllet për pak; hape përsëri nga njoftimi "Training Hub u përditësua".</p>
    case 'failed':
      return (
        <>
          <p role="alert" className="text-sm leading-5 text-destructive">
            {FAILURE_TEXT[state.reason]}
          </p>
          <Button onClick={state.release ? update : () => void updater.check({ force: true })}>Provo përsëri</Button>
        </>
      )
    case 'current':
      return (
        <>
          <p className="text-base leading-6">Ke versionin e fundit, {__APP_VERSION__}.</p>
          <Button variant="outline" onClick={() => void updater.check({ force: true })}>
            Kontrollo tani
          </Button>
        </>
      )
    default:
      return (
        <>
          <p className="text-sm leading-5 text-muted-foreground">{updateDetail(state) ?? `Ke ${__APP_VERSION__}.`}</p>
          <Button variant="outline" disabled={state.status === 'checking'} onClick={() => void updater.check({ force: true })}>
            Kontrollo tani
          </Button>
        </>
      )
  }
}
