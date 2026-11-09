import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icons'
import { useI18n } from '@/i18n/use-i18n'
import type { SetRecordResult } from '@/progress/records'
import { useBannerMotion } from './session-motion'

// Banderola e rekordit (SPEC §0.3c, V2-E2-21; bordet "Pushimi · banderola e rekordit" dhe "Lëvizja"):
// kur seti i sapo ruajtur jep rekord, zbret nga lart mbi pushimin me "Rekord i ri", ushtrimin, e1RM-në
// dhe shtesën (ose peshën më të madhe për ato përsëritje, §6); rri 3 s ose mbyllet me "Mbyll" (44 px). Pushimi vazhdon poshtë saj. Rajoni `status`
// rri gjithnjë në faqe, që lexuesi i ekranit ta lexojë banderolën kur hyn. Shkëndijat mbeten te mbyllja.

export interface BannerRecord {
  /** Seti që dha rekordin; një set i ri rinis banderolën. */
  id: string
  exercise: string
  /** `setRecord`: e1RM-ja me shtesën, ose pesha më e madhe për ato përsëritje. */
  record: SetRecordResult
}

export function RecordBanner({ banner, onDone }: { banner: BannerRecord | null; onDone: () => void }) {
  return (
    <div role="status" className="pointer-events-none fixed inset-x-0 top-0 z-[35] pt-[calc(var(--safe-top)+10px)]">
      {banner ? <BannerCard key={banner.id} banner={banner} onDone={onDone} /> : null}
    </div>
  )
}

function BannerCard({ banner, onDone }: { banner: BannerRecord; onDone: () => void }) {
  const { t, fmt } = useI18n()
  const { ref, dismiss } = useBannerMotion<HTMLDivElement>(onDone)
  const { record } = banner
  return (
    <div className="mx-auto w-full max-w-[480px] px-3">
      <div ref={ref} className="pointer-events-auto relative flex items-center gap-3 overflow-hidden rounded-lg border border-ember-text bg-insight py-2.5 pr-1.5 pl-3">
        <span aria-hidden className="absolute inset-y-0 right-[54px] w-[110px] bg-speed-lines" />
        <span aria-hidden className="relative flex size-11 shrink-0 items-center justify-center rounded-pill bg-ember text-on-ember">
          <Icon name="kupa" size={22} />
        </span>
        <span className="relative flex min-w-0 grow flex-col gap-0.5">
          <span className="type-title">{t('session.banner.title')}</span>
          <span className="type-caption">
            {banner.exercise} ·{' '}
            {record.kind === 'e1rm' ? (
              <>
                <span className="whitespace-nowrap tabular-nums">{t('session.banner.e1rm', { e1rm: fmt.unit(record.e1rmKg, 'kg', { maxDigits: 1 }) })}</span>{' '}
                <span className="font-semibold whitespace-nowrap text-ember-text tabular-nums">+{fmt.unit(record.gainKg, 'kg', { maxDigits: 1 })}</span>
              </>
            ) : (
              <span className="tabular-nums">{t('session.banner.weight', { count: record.reps, weight: fmt.unit(record.weightKg, 'kg') })}</span>
            )}
          </span>
        </span>
        <Button variant="ghost" size="icon" aria-label={t('session.banner.close')} className="relative rounded-pill" onClick={dismiss}>
          <Icon name="mbyll-vrull" size={20} />
        </Button>
      </div>
    </div>
  )
}
