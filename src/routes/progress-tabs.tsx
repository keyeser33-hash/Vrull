import { Link } from 'react-router'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import { surfaceClass } from '@/components/ui/surface'

// Tab-et e Progresit (SPEC §0.3c, bordi "Progresi"): Trupi · Përmbledhja · Historiku · Arritjet. Çdo
// tab është një rrugë më vete (lidhje me role="tab"), që "Mbrapa" dhe lidhjet e jashtme të punojnë;
// Progresi hapet te Përmbledhja. I zgjedhuri në bojë, si segmenti i zgjedhur (DESIGN.md).

export type ProgressTab = 'body' | 'summary' | 'history' | 'achievements'

const TABS: { key: ProgressTab; to: string }[] = [
  { key: 'body', to: '/progresi/trupi' },
  { key: 'summary', to: '/progresi' },
  { key: 'history', to: '/progresi/historiku' },
  { key: 'achievements', to: '/progresi/arritjet' },
]

export function ProgressTabs({ current, className }: { current: ProgressTab; className?: string }) {
  const { t } = useI18n()
  const names: Record<ProgressTab, string> = {
    body: t('tab.body'),
    summary: t('progress.tabs.summary'),
    history: t('progress.tabs.history'),
    achievements: t('progress.tabs.achievements'),
  }
  return (
    <div role="tablist" aria-label={t('progress.tabs.label')} className={cn(surfaceClass, 'grid grid-cols-4 gap-1 rounded-[14px] p-1', className)}>
      {TABS.map((tab) => {
        const selected = tab.key === current
        return (
          <Link
            key={tab.key}
            to={tab.to}
            replace
            role="tab"
            aria-selected={selected}
            aria-current={selected ? 'page' : undefined}
            className={cn(
              'flex h-touch min-w-0 items-center justify-center truncate rounded-sm px-0.5 font-display font-bold transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground',
              // Një emër i gjatë ("Achievements") zvogëlohet pak, që të katër të nxënë në 390 px.
              names[tab.key].length > 11 ? 'text-[15px]' : 'text-[17px]',
              selected ? 'bg-foreground text-background' : 'text-muted-foreground',
            )}
          >
            {names[tab.key]}
          </Link>
        )
      })}
    </div>
  )
}
