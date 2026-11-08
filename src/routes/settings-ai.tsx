import { useId } from 'react'
import { Link } from 'react-router'
import { BackHeader } from '@/components/layout/page'
import { Icon } from '@/components/ui/icons'
import { ProgressTrack } from '@/components/ui/progress-bar'
import { surfaceClass } from '@/components/ui/surface'
import { store, useLocalQuery } from '@/data/app-data'
import { type AiMonth, aiMonth } from '@/data/ai-usage'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import { euro, euroLimit, monthName } from './ai-format'

// Cilësimet › AI (V2-E1-11; bordi "Cilësimet · AI"): sa ka harxhuar AI-ja këtë muaj nga kufiri, ku shkon
// dhe çfarë ndodh te kufiri (V25). Rreshtat vijnë nga serveri me sinkronizimin; ekrani nuk pret rrjetin.
// Te "Çfarë e përdor AI-në" del vetëm leximi i PDF-ve: foto e pjatës dhe ushqimi me fjalë vijnë me
// Etapën 2, shpjegimet "Pse?" me Etapën 3. "Ndrysho kufirin" i përket faqes së Adminit (V31, Etapa 2).

const ratio = (month: AiMonth) => (month.limitEur > 0 ? month.spentEur / month.limitEur : 1)

export function AiSettingsPage() {
  const { t, fmt } = useI18n()
  const month = useLocalQuery(() => aiMonth(store), [])
  const monthTitle = useId()
  const usesTitle = useId()
  const limitTitle = useId()
  const resets = month ? fmt.date(month.resetsOn, { weekday: false }) : ''
  return (
    <div className="flex flex-col gap-[18px]">
      <BackHeader title={t('ai.settings.title')} back={t('settings.backToSettings')} fallback="/cilesimet" />

      {month ? (
        <>
          <section aria-labelledby={monthTitle} className="flex flex-col gap-2.5">
            <h2 id={monthTitle} className="type-label text-muted-foreground">
              {monthName(t, month.month)}
            </h2>
            <div className="flex items-end gap-3">
              <span className="type-display-xl tabular-nums">{fmt.number(month.spentEur, { minDigits: 2, maxDigits: 2 })}</span>
              <span className="flex flex-col pb-2 type-body text-muted-foreground tabular-nums">
                <span>{t('ai.settings.of', { limit: euroLimit(fmt, month.limitEur) })}</span>
                {month.reached ? (
                  <>
                    <span className="font-semibold text-foreground">{t('ai.settings.reached')}</span>
                    <span>{t('ai.settings.resumes', { date: resets })}</span>
                  </>
                ) : (
                  <span>
                    {t('ai.settings.left', { left: euro(fmt, month.remainingEur) })} <span className="whitespace-nowrap">{t('ai.settings.until', { date: resets })}</span>
                  </span>
                )}
              </span>
            </div>
            <span
              role="meter"
              aria-label={t('ai.settings.meterLabel')}
              aria-valuemin={0}
              aria-valuemax={month.limitEur}
              aria-valuenow={month.spentEur}
              aria-valuetext={t('ai.settings.meterValue', { spent: euro(fmt, month.spentEur), limit: euroLimit(fmt, month.limitEur) })}
            >
              <ProgressTrack ratio={ratio(month)} tone="data" ground="page" />
            </span>
          </section>

          <section aria-labelledby={usesTitle} className="flex flex-col gap-2">
            <h2 id={usesTitle} className="type-label text-muted-foreground">
              {t('ai.settings.uses')}
            </h2>
            <ul className={cn(surfaceClass, 'flex flex-col overflow-hidden rounded-lg')}>
              <li className="flex min-h-[64px] items-center gap-3 px-4 py-2.5">
                <Icon name="skedari" size={22} className="text-muted-foreground" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="type-body-strong">{t('ai.settings.pdf')}</span>
                  <span className="type-caption text-muted-foreground">{t('ai.settings.pdfText')}</span>
                </span>
                <span className="shrink-0 font-display text-xl font-bold tabular-nums">{euro(fmt, month.byFeature.program_pdf ?? 0)}</span>
              </li>
            </ul>
          </section>

          <section aria-labelledby={limitTitle} className="flex flex-col gap-2">
            <h2 id={limitTitle} className="type-label text-muted-foreground">
              {t('ai.settings.limit')}
            </h2>
            <div className={cn(surfaceClass, 'flex flex-col overflow-hidden rounded-lg')}>
              <div className="flex flex-col gap-1 px-4 py-3">
                <h3 className="type-body-strong">{t('ai.settings.whenTitle')}</h3>
                <p className="type-body text-muted-foreground">{t('ai.settings.whenText', { date: resets })}</p>
              </div>
              <div className="flex flex-col gap-1 border-t border-border px-4 py-3">
                <h3 className="type-body-strong">{t('ai.settings.whoTitle')}</h3>
                <p className="type-body text-muted-foreground tabular-nums">{t('ai.settings.whoText', { limit: euroLimit(fmt, month.limitEur) })}</p>
              </div>
            </div>
          </section>
        </>
      ) : (
        <div aria-hidden className="h-60 rounded-lg bg-surface" />
      )}
    </div>
  )
}

/** Grupi "AI" te Cilësimet (bordi "Cilësimet"): përdorimi i muajit me shiritin, që hap Cilësimet › AI. */
export function AiUsageGroup() {
  const { t, fmt } = useI18n()
  const month = useLocalQuery(() => aiMonth(store), [])
  const titleId = useId()
  if (!month) return null
  const spent = euro(fmt, month.spentEur)
  const limit = euroLimit(fmt, month.limitEur)
  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-2">
      <h2 id={titleId} className="type-label text-muted-foreground">
        {t('ai.settings.group')}
      </h2>
      <Link
        to="/cilesimet/ai"
        aria-label={`${t('ai.settings.row')}, ${t('ai.settings.rowValue', { spent, limit })}`}
        className={cn(
          surfaceClass,
          'flex flex-col gap-3 rounded-lg pt-3.5 pr-3 pb-4 pl-4 outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground',
        )}
      >
        <span className="flex items-center justify-between gap-3">
          <span className="type-body-strong">{t('ai.settings.row')}</span>
          <span className="flex shrink-0 items-center gap-1 type-body text-muted-foreground tabular-nums">
            <span className="font-semibold text-foreground">{spent}</span>
            {t('ai.settings.ofLimit', { limit })}
            <Icon name="hap" size={18} />
          </span>
        </span>
        <ProgressTrack ratio={ratio(month)} tone="data" className="mr-1" />
      </Link>
    </section>
  )
}
