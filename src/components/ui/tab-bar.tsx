import { Link } from 'react-router'
import { cn } from '@/lib/cn'
import { Icon, type IconName } from './icons'

// Navigimi poshtë i Vrullit, 72 px: Sot, Programi, Ushqimi, Progresi, Miqtë. Vendi aktiv në
// `ember-text` dhe 700, të tjerët `muted-foreground`; ikonat 22 px me vijë 2 px, emri 12 px poshtë.
// Sfondi `nav` (`background` në OLED, `surface` në Natë dhe Ditë) me vijë 1 px `border` sipër.
// Kush e vendos (korniza) zgjedh vendin aktiv dhe e fsheh gjatë seancës.

export interface TabBarItem {
  id: string
  label: string
  icon: IconName
  to: string
}

export function TabBar({ items, active, label = 'Navigimi', className }: { items: TabBarItem[]; active: string | null; label?: string; className?: string }) {
  return (
    <nav aria-label={label} className={cn('border-t border-border bg-nav pb-[var(--safe-bottom)]', className)}>
      <ul className="mx-auto grid h-tab-bar max-w-[480px] auto-cols-fr grid-flow-col">
        {items.map((item) => {
          const current = item.id === active
          return (
            <li key={item.id} className="flex">
              <Link
                to={item.to}
                aria-current={current ? 'page' : undefined}
                className={cn(
                  'flex min-h-touch flex-1 flex-col items-center justify-center gap-1 rounded-md text-xs leading-[1.2]',
                  current ? 'font-bold text-ember-text' : 'font-medium text-muted-foreground',
                )}
              >
                <Icon name={item.icon} size={22} />
                <span>{item.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
