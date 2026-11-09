import { useEffect } from 'react'
import { Outlet, useLocation, useMatches } from 'react-router'
import { TabBar } from '@/components/ui/tab-bar'
import { store, useLocalQuery } from '@/data/app-data'
import { dayModeNow } from '@/data/day-mode'
import { useI18n } from '@/i18n/use-i18n'
import { useBackground } from '@/lib/background'
import { cn } from '@/lib/cn'
import { KEEP_EMBER_ATTRIBUTE, keepsEmber, setDayAttribute } from '@/lib/day-mode'
import { activeTab, NAV_PLACES } from './nav-places'
import { OfflineBanner } from './offline-banner'

// Korniza e Vrullit (V2-E1-05): rripi "Pa internet" sipër, ekrani, dhe tab-bar-i 72 px poshtë me
// pesë vendet. Çdo rrugë e thotë te `handle` (router.tsx) cili tab është aktiv; cilësimet dhe
// editorët nuk kanë tab-bar. Sfondi "Vija shpejtësie" vizatohet pas kreut dhe zbehet poshtë.
export function AppShell() {
  const { t } = useI18n()
  const tab = activeTab(useMatches())
  const background = useBackground()
  const { pathname } = useLocation()
  // Pamja e ditës (V20, V50): gatishmëria dhe çelësi "Pamja ndjek gjendjen" vendosin `data-day` te <html>;
  // rifreskohet kur ndryshon `daily_states` ose çelësi. Historiku mban prushin (`data-day-keep`).
  const dayMode = useLocalQuery(() => dayModeNow(store), [])
  useEffect(() => setDayAttribute(dayMode ?? 'normal'), [dayMode])
  useEffect(() => () => setDayAttribute('normal'), [])
  const items = NAV_PLACES.map((place) => ({ id: place.id, label: t(place.label), icon: place.icon, to: place.to }))
  return (
    <div className="relative isolate min-h-dvh bg-background pt-[var(--safe-top)]">
      {background === 'speed_lines' ? (
        <div aria-hidden data-background="speed_lines" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-speed-lines mask-fade-down" />
      ) : null}
      {/* Nën orën dhe baterinë, kur faqja shkon deri në cep (WebView 140+): përmbajtja që lëviz
          nuk kalon poshtë ikonave të sistemit. Në shfletues --safe-top është 0. */}
      <div aria-hidden className="fixed inset-x-0 top-0 z-30 h-[var(--safe-top)] bg-background" />
      <OfflineBanner />
      <main
        {...(keepsEmber(pathname) ? { [KEEP_EMBER_ATTRIBUTE]: '' } : {})}
        className={cn(
          'mx-auto w-full max-w-[480px] px-4 pt-5',
          tab ? 'pb-[calc(var(--spacing-tab-bar)+var(--safe-bottom)+24px)]' : 'pb-[calc(var(--safe-bottom)+24px)]',
        )}
      >
        <Outlet />
      </main>
      {tab ? <TabBar items={items} active={tab} className="fixed inset-x-0 bottom-0 z-20" /> : null}
    </div>
  )
}
