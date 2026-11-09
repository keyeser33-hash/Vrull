import { Link } from 'react-router'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import { surfaceClass } from '@/components/ui/surface'

// Tab-et e Progresit (V44, SPEC §0.3c; bordet "Progresi · Përmbledhja" dhe "Progresi · Arritjet"):
// Trupi · Përmbledhja · Historiku · Arritjet, katër lidhje 44 px në një shirit `surface` me rreze 14 px.
// I zgjedhuri si segmenti i zgjedhur (DESIGN.md › Rregullat e temave): mbushje `foreground`, tekst
// `background`. Çdo tab është rrugë e vet, që butoni mbrapa dhe lidhjet të çojnë drejt aty.

export type ProgressTab = 'body' | 'summary' | 'history' | 'achievements'

const TABS: { id: ProgressTab; to: string; label: 'tab.body' | 'progressTabs.summary' | 'progressTabs.history' | 'progressTabs.achievements' }[] = [
  { id: 'body', to: '/progresi/trupi', label: 'tab.body' },
  { id: 'summary', to: '/progresi', label: 'progressTabs.summary' },
  { id: 'history', to: '/progresi/historiku', label: 'progressTabs.history' },
  { id: 'achievements', to: '/progresi/arritjet', label: 'progressTabs.achievements' },
]

export function ProgressTabs({ active, className }: { active: ProgressTab; className?: string }) {
  const { t } = useI18n()
  return (
    <div role="tablist" aria-label={t('progressTabs.label')} className={cn(surfaceClass, 'grid grid-cols-4 gap-1 rounded-[14px] p-1', className)}>
      {TABS.map((tab) => {
        const selected = tab.id === active
        return (
          <Link
            key={tab.id}
            to={tab.to}
            role="tab"
            aria-selected={selected}
            aria-current={selected ? 'page' : undefined}
            replace
            className={cn(
              'flex h-touch min-w-0 items-center justify-center rounded-[10px] font-display text-[16px] leading-none font-bold transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground',
              selected ? 'bg-foreground text-background' : 'text-muted-foreground',
            )}
          >
            <span className="truncate">{t(tab.label)}</span>
          </Link>
        )
      })}
    </div>
  )
}
