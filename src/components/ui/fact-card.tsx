import type { ReactNode } from 'react'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import { Button } from './button'
import { surfaceClass } from './surface'

// Karta "A e dije?" e Mësos (V28): një fakt i shkurtër me burim, gjithnjë i pranishëm. Një shpjegim
// nga AI ka "Shpjeguar nga AI" në vend të burimit. "Më shumë" hap faqen e ushtrimit ose të pjatës,
// "Tjetër" sjell faktin tjetër.

type Origin = { source: string; ai?: false } | { ai: true; source?: undefined }

export function FactCard({
  fact,
  onMore,
  onNext,
  className,
  ...origin
}: { fact: ReactNode; onMore?: () => void; onNext?: () => void; className?: string } & Origin) {
  const { t } = useI18n()
  return (
    <section aria-label={t('ui.fact.title')} className={cn(surfaceClass, 'flex flex-col gap-2 rounded-lg p-3.5', className)}>
      <span className="type-label text-data">{t('ui.fact.title')}</span>
      <p className="m-0 text-base leading-[1.45] font-medium text-foreground">{fact}</p>
      <span className="text-[13px] leading-[1.35] text-muted-foreground">{origin.ai ? t('ui.ai') : t('ui.fact.source', { source: origin.source })}</span>
      {onMore || onNext ? (
        <div className="mt-1 flex gap-2">
          {onMore ? (
            <Button variant="outline" className="text-[17px]" onClick={onMore}>
              {t('ui.fact.more')}
            </Button>
          ) : null}
          {onNext ? (
            <Button variant="outline" className="text-[17px]" onClick={onNext}>
              {t('ui.fact.next')}
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
