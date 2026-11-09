import { useNavigate, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icons'
import { surfaceClass } from '@/components/ui/surface'
import { store, useLocalQuery } from '@/data/app-data'
import { skipCheckIn } from '@/data/daily-state'
import { readinessView } from '@/data/readiness-view'
import type { TodayView } from '@/data/today'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import { CheckInSheet } from './checkin-sheet'
import { LEVEL_TONE, levelLabel } from './readiness-format'
import { ReadinessSheet } from './readiness-sheet'

// Vendi i kartës "Si ndihesh sot?" dhe i pllakës "Gati" te Sot, menjëherë nën kre (V50, V2-E3-04, V2-E3-05;
// bordet "Sot · Si ndihesh sot?", "Gjendja e ditës", "Fleta Gati"):
// - pa gjendje dhe pa "Jo sot": karta me "Plotëso" (hap fletën) dhe "Jo sot";
// - me "Jo sot" dhe pa gjendje: asgjë;
// - me gjendje: pllaka "Gati" me përqindjen e rillogaritur (jo të ruajtur), nivelin dhe shigjetën; hap fletën "Gati".
// Fletët hapen me një parametër në adresë (`fleta=gjendja|gati`), që butoni mbrapa i Android-it t'i mbyllë.

const SHEET = 'fleta'

export function ReadinessCard({ view }: { view: TodayView }) {
  const { t, fmt } = useI18n()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const rv = useLocalQuery(() => readinessView(store, view), [view])
  const sheet = params.get(SHEET)
  const open = (name: 'gjendja' | 'gati', replace = false) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        next.set(SHEET, name)
        return next
      },
      { replace },
    )
  const close = () => navigate(-1)
  if (!rv) return null

  const { readiness, state } = rv
  const level = readiness ? levelLabel(t, readiness.level) : ''
  const percent = readiness ? fmt.number(readiness.percent) : ''
  return (
    <>
      {state && readiness ? (
        <button
          type="button"
          aria-label={t('readiness.tile.aria', { percent, level })}
          onClick={() => open('gati')}
          className={cn(surfaceClass, 'flex min-h-16 w-full items-center justify-between gap-3 rounded-lg px-4 py-2 text-left text-foreground')}
        >
          <span aria-hidden className="flex flex-col gap-0.5">
            <span className="text-[13px] leading-[1.35] text-muted-foreground">{t('readiness.tile')}</span>
            <span className="font-display text-[34px] leading-none font-extrabold tabular-nums">{percent}%</span>
          </span>
          <span aria-hidden className="flex items-center gap-2 text-[15px] font-semibold">
            <span className={cn('size-2 rounded-pill', LEVEL_TONE[readiness.level])} />
            {level}
            <Icon name="hap" size={16} className="text-muted-foreground" />
          </span>
        </button>
      ) : !state && !rv.skipped ? (
        <section aria-labelledby="checkin-card" className={cn(surfaceClass, 'flex flex-col gap-3.5 rounded-xl p-4')}>
          <div className="flex flex-col gap-1">
            <h2 id="checkin-card" className="type-display-s">
              {t('checkin.title')}
            </h2>
            <p className="type-body text-muted-foreground">{t('checkin.card.text')}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="lg" className="flex-1" onClick={() => open('gjendja')}>
              {t('checkin.fill')}
            </Button>
            <Button variant="ghost" size="lg" onClick={() => void skipCheckIn(store, rv.date)}>
              {t('checkin.skip')}
            </Button>
          </div>
        </section>
      ) : null}
      {sheet === 'gjendja' ? <CheckInSheet view={view} state={state} onClose={close} /> : null}
      {sheet === 'gati' && state && readiness ? <ReadinessSheet view={view} rv={rv} onClose={close} onChange={() => open('gjendja', true)} /> : null}
    </>
  )
}
