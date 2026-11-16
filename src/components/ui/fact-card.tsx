import { type ReactNode, useState } from 'react'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import { Button } from './button'
import { buttonVariants } from './button-variants'
import { Icon } from './icons'
import { surfaceClass } from './surface'

// Karta "A e dije?" e Mëso-s (V28, V56, SPEC §0.3e; bordet "Pushimi · A e dije?" dhe "Ushqimi · Pas regjistrimit"):
// një fakt i shkurtër me burim, gjithnjë i pranishëm. Rreshti i parë: etiketa në `data`, konteksti (ushtrimi ose
// ushqimi) dhe "×" 44 px që e mbyll për sot. Vetëm "Më shumë" (pa "Tjetër": një fakt në ditë në çdo vend), që hap
// në vend shpjegimin e gjatë dhe lidhjen e burimit jashtë app-it. Një shpjegim nga AI ka "Shpjeguar nga AI" në vend
// të burimit. Karta nuk merr kurrë prushin.

type Origin = { source: string; ai?: false } | { ai: true; source?: undefined }

export function FactCard({
  fact,
  context,
  more,
  href,
  onMore,
  onDismiss,
  className,
  ...origin
}: {
  fact: ReactNode
  /** Ushtrimi ose ushqimi i faktit ("Bench Press"), djathtas etiketës. */
  context?: string
  /** Shpjegimi i gjatë që hap "Më shumë". */
  more?: ReactNode
  /** Lidhja e burimit, që hapet jashtë app-it pas "Më shumë". */
  href?: string
  onMore?: () => void
  /** "×": mbyll kartën për sot. */
  onDismiss?: () => void
  className?: string
} & Origin) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const expandable = !!(more || href || onMore)
  return (
    <section aria-label={t('ui.fact.title')} className={cn(surfaceClass, 'flex flex-col gap-2 rounded-lg p-3.5', className)}>
      <div className="flex min-h-6 items-center gap-2">
        <span className="type-label text-data">{t('ui.fact.title')}</span>
        {context ? <span className="ml-auto min-w-0 truncate text-[13px] leading-[1.35] text-muted-foreground">{context}</span> : null}
        {onDismiss ? (
          <Button variant="ghost" size="icon" aria-label={t('learn.card.dismiss')} className={cn('-my-2.5 -mr-2.5 shrink-0 rounded-pill text-muted-foreground', !context && 'ml-auto')} onClick={onDismiss}>
            <Icon name="mbyll-vrull" size={18} />
          </Button>
        ) : null}
      </div>
      <p className="m-0 text-base leading-[1.45] font-medium text-foreground">{fact}</p>
      <span className="text-[13px] leading-[1.35] text-muted-foreground">{origin.ai ? t('ui.ai') : t('ui.fact.source', { source: origin.source })}</span>
      {open ? (
        <>
          {more ? <p className="m-0 text-[15px] leading-[1.45] text-foreground">{more}</p> : null}
          {href ? (
            <a href={href} target="_blank" rel="noreferrer" className={cn(buttonVariants({ variant: 'outline' }), 'mt-1 self-start text-[17px]')}>
              {t('learn.source.open')}
              <Icon name="jashte" size={16} />
            </a>
          ) : null}
        </>
      ) : expandable ? (
        <div className="mt-1 flex gap-2">
          <Button
            variant="outline"
            className="text-[17px]"
            onClick={() => {
              setOpen(true)
              onMore?.()
            }}
          >
            {t('ui.fact.more')}
          </Button>
        </div>
      ) : null}
    </section>
  )
}
