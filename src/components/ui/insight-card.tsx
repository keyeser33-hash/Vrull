import { cva } from 'class-variance-authority'
import type { ReactNode } from 'react'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import { Icon, type IconName } from './icons'

// Mesazhi i zgjuar në kontekst: rekordi që po vjen, pesha e propozuar (`insight`, me ikonë 28 px në
// `ember-text`), ose sugjerimi i gatishmërisë (`tired`, në `surface`, me "Prano" dhe "Jo sot").
// Një e tillë njëkohësisht në ekran. Sugjerimet nga AI e thonë me "Shpjeguar nga AI".

const card = cva('flex gap-3 rounded-lg border px-3.5 py-3', {
  variants: {
    tone: {
      // Kartat insight e mbajnë kufirin në çdo temë.
      insight: 'items-center border-insight-border bg-insight',
      tired: 'flex-col items-start gap-1 border-surface-border bg-surface',
    },
  },
})

export function InsightCard({
  tone = 'insight',
  icon = 'kupa',
  children,
  actions,
  ai = false,
  className,
}: {
  tone?: 'insight' | 'tired'
  /** Vetëm te `insight`; null e heq. */
  icon?: IconName | null
  children: ReactNode
  actions?: ReactNode
  ai?: boolean
  className?: string
}) {
  const { t } = useI18n()
  return (
    <div className={cn(card({ tone }), className)}>
      {tone === 'insight' && icon ? <Icon name={icon} size={28} className="text-ember-text" /> : null}
      <div className="flex min-w-0 flex-col gap-1">
        <p className="m-0 text-sm leading-[1.4] text-foreground">{children}</p>
        {ai ? <span className="text-[13px] leading-[1.35] text-muted-foreground">{t('ui.ai')}</span> : null}
        {actions ? <div className="mt-2 flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </div>
  )
}
