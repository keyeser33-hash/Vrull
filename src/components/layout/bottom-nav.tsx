import { NavLink } from 'react-router'
import { Icon } from '@/components/ui/icons'
import { cn } from '@/lib/cn'
import { NAV_PLACES } from './nav-places'

// Omal UI v2 BottomNav: 56px mbi `card`, vijë e hollë sipër, ikonë 22px mbi etiketë 12px.
// Vendi aktiv: tekst `foreground` 600 dhe vijë 2px `brand` sipër, me aria-current="page".
export function BottomNav() {
  return (
    <nav
      aria-label="Kryesore"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card pb-[var(--safe-bottom)]"
    >
      <ul className="mx-auto grid h-14 max-w-[480px] grid-cols-5">
        {NAV_PLACES.map((place) => (
          <li key={place.to} className="flex">
            <NavLink
              to={place.to}
              end={place.to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex flex-1 flex-col items-center justify-center gap-0.5 text-xs leading-4',
                  isActive
                    ? 'font-semibold text-foreground shadow-[inset_0_2px_0_var(--brand)]'
                    : 'text-muted-foreground',
                )
              }
            >
              <Icon name={place.icon} size={22} />
              <span>{place.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
