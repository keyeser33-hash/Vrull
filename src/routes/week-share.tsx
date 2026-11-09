import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icons'
import { store, useLocalQuery } from '@/data/app-data'
import { trainingSnapshot } from '@/data/training'
import { weekSummary } from '@/data/weekly-goals'
import { useI18n } from '@/i18n/use-i18n'
import { APP_NAME } from '@/lib/app-name'
import { saveImageToGallery, shareImage } from '@/lib/gallery-native'
import { pngBase64, renderWeekCard } from '@/share/render'
import { weekCardContent } from '@/share/week-card'

// Karta për ndarje (V43, SPEC §0.3c, bordi "Karta"; /progresi/java/:e-hëna/karta): parapamja e PNG-së
// 1080 × 1350 me vetëm stërvitjen, "Ruaj në galeri" (Pictures/Vrull) dhe "Ndaj" (menyja e Android-it).
// Pesha, matjet, ushqimi dhe uji nuk hyjnë në kartë (`weekCardContent`).

type Status = 'saved' | 'downloaded' | 'denied' | 'failed' | null

export function WeekSharePage() {
  const i18n = useI18n()
  const { t, lang } = i18n
  const navigate = useNavigate()
  const location = useLocation()
  const { monday = '' } = useParams()
  const data = useLocalQuery(async () => {
    const [summary, snapshot] = await Promise.all([weekSummary(store, monday), trainingSnapshot(store)])
    return { summary, programme: snapshot?.programName ?? null }
  }, [monday])
  const content = data?.summary ? weekCardContent(data.summary, i18n, { brand: APP_NAME, programme: data.programme }) : null
  const [image, setImage] = useState<{ key: string; url: string; base64: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<Status>(null)
  const key = content ? `${lang}|${content.spoken}` : ''

  useEffect(() => {
    if (!content) return
    let cancelled = false
    void renderWeekCard(content, lang)
      .then((canvas) => {
        if (cancelled || !canvas) return
        const base64 = pngBase64(canvas)
        if (base64) setImage({ key, url: `data:image/png;base64,${base64}`, base64 })
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
    // Karta rivizatohet kur ndryshon teksti (gjuha ose të dhënat), jo në çdo vizatim.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const close = () => (location.key === 'default' ? navigate(`/progresi/java/${monday}`, { replace: true }) : navigate(-1))
  const ready = image && image.key === key ? image : null
  const name = `vrull-java-${monday}.png`

  async function run(action: () => Promise<Status>) {
    setBusy(true)
    setStatus(null)
    try {
      setStatus(await action())
    } catch {
      setStatus('failed')
    } finally {
      setBusy(false)
    }
  }

  const preview = content ? t('week.share.preview', { text: content.spoken }) : t('week.share.action')
  return (
    <div className="flex min-h-[calc(100dvh-var(--safe-top)-var(--safe-bottom)-48px)] flex-col gap-4">
      <div className="flex min-h-[52px] items-center">
        <Button variant="ghost" size="icon" aria-label={t('common.close')} className="-ml-3 rounded-pill" onClick={close}>
          <Icon name="mbyll-vrull" size={22} />
        </Button>
      </div>
      <div className="flex flex-col gap-1">
        <span className="type-caption text-muted-foreground tabular-nums">{t('week.share.size')}</span>
        <h1 className="type-display-m">{t('week.share.action')}</h1>
      </div>
      {data && !data.summary ? <p className="type-body text-muted-foreground">{t('week.summary.notFound')}</p> : null}
      <figure className="m-0 flex justify-center">
        {ready ? (
          <img src={ready.url} alt={preview} className="aspect-[4/5] w-full max-w-[320px] rounded-lg border border-border" />
        ) : (
          <div role="img" aria-label={preview} className="aspect-[4/5] w-full max-w-[320px] rounded-lg border border-border bg-surface" />
        )}
      </figure>
      <p className="type-caption text-muted-foreground">{t('week.share.privacy')}</p>
      {status ? (
        <p role="status" className="type-body text-foreground">
          {t(status === 'saved' ? 'week.share.saved' : status === 'downloaded' ? 'week.share.downloaded' : status === 'denied' ? 'week.share.denied' : 'week.share.failed')}
        </p>
      ) : null}
      <div className="mt-auto grid grid-cols-2 gap-2.5">
        <Button variant="outline" className="h-button-l rounded-md px-2 text-lg leading-none whitespace-normal" disabled={!ready || busy} onClick={() => ready && void run(() => saveImageToGallery(ready.base64, name))}>
          <Icon name="shkarko-vrull" size={20} />
          {t('week.share.save')}
        </Button>
        <Button
          variant="primary"
          className="h-button-l rounded-md px-3 text-2xl"
          disabled={!ready || busy}
          onClick={() =>
            ready &&
            void run(async () => {
              await shareImage(ready.base64, name, t('week.share.action'))
              return null
            })
          }
        >
          <Icon name="ndaj" size={22} />
          {t('week.share.share')}
        </Button>
      </div>
    </div>
  )
}
