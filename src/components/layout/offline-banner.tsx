import { useId } from 'react'
import { Icon } from '@/components/ui/icons'
import { usePendingChanges } from '@/data/app-data'
import { useI18n } from '@/i18n/use-i18n'
import { useOnline } from '@/lib/use-online'

// Rripi "Pa internet" (bordi "Gjendje · Pa internet"): sipër ekraneve kryesore, `surface` me vijë
// 1 px poshtë, me sa ndryshime presin. Ekranet punojnë njësoj; vetëm e thotë. Ndryshimet që presin
// numërohen vetëm pa internet.
export function OfflineBanner() {
  return useOnline() ? null : <Offline />
}

function Offline() {
  const { t } = useI18n()
  const pending = usePendingChanges()
  const titleId = useId()
  return (
    <div
      role="status"
      aria-labelledby={titleId}
      className="sticky top-[var(--safe-top)] z-20 flex min-h-10 items-center justify-center gap-2.5 border-b border-border bg-surface px-4 py-2 type-caption"
    >
      <Icon name="pa-internet" size={18} className="text-muted-foreground" />
      <span>
        <span id={titleId} className="font-semibold">
          {t('shell.offline')}
        </span>
        <span className="text-muted-foreground"> · {pending > 0 ? t('shell.offlinePending', { count: pending }) : t('shell.offlineSaved')}</span>
      </span>
    </div>
  )
}
