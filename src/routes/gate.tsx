import { Navigate, Outlet, useLocation } from 'react-router'
import { Button } from '@/components/ui/button'
import { VrullMark } from '@/components/ui/logo'
import {
  auth,
  scheduler,
  useAppPhase,
  useBackgroundSync,
  useDataUpgrades,
  useFormVideoUploader,
  useLanguageSync,
  usePhotoUploader,
  useReminderPlanner,
  useUpdateChecker,
} from '@/data/app-data'
import { useI18n } from '@/i18n/use-i18n'
import { APP_NAME } from '@/lib/app-name'
import { useReminderOpen } from '@/lib/reminder-open'
import { useSessionNotification } from '@/lib/session-notification-hook'

const onboardingPath = (pathname: string) => pathname === '/fillimi' || pathname.startsWith('/fillimi/')

// Porta e app-it: i vetmi vend që vendos rrugën sipas fazës (data/phase.ts).
export function AppGate() {
  const phase = useAppPhase()
  const { pathname } = useLocation()
  useDataUpgrades(phase === 'ready')
  useReminderPlanner(phase === 'ready')
  usePhotoUploader(phase === 'ready')
  useFormVideoUploader(phase === 'ready')
  useUpdateChecker(phase === 'ready')
  useLanguageSync(phase === 'ready')
  useBackgroundSync(phase === 'ready')
  useSessionNotification(phase === 'ready')
  useReminderOpen(phase === 'ready')

  switch (phase) {
    case 'loading':
      return <div className="min-h-dvh bg-background" />
    case 'signed_out':
      return pathname === '/hyrja' ? <Outlet /> : <Navigate to="/hyrja" replace />
    case 'fetching':
    case 'fetch_failed':
      return <FetchingScreen failed={phase === 'fetch_failed'} />
    // Hapat e parë dhe ndërtuesi brenda tyre ("Ndërto timin", `/fillimi/programi/…`, V2-E1-10).
    case 'onboarding':
      return onboardingPath(pathname) ? <Outlet /> : <Navigate to="/fillimi" replace />
    case 'ready':
      return pathname === '/hyrja' || onboardingPath(pathname) ? <Navigate to="/" replace /> : <Outlet />
  }
}

/**
 * Marrja e të dhënave pas hyrjes (bordi "Hyrja · Hapja", V2-E1-17): logoja, emri dhe fjalia në qendër;
 * poshtë shiriti që lëviz dhe gjendja me fjalë. Kur marrja dështon (pa internet), poshtë dalin arsyeja,
 * "Provo përsëri" dhe "Dil nga llogaria".
 */
function FetchingScreen({ failed }: { failed: boolean }) {
  const { t } = useI18n()
  return (
    <div className="flex min-h-dvh flex-col bg-background pt-[var(--safe-top)] pb-[var(--safe-bottom)] text-foreground">
      <div aria-hidden className="fixed inset-x-0 top-0 z-30 h-[var(--safe-top)] bg-background" />
      <main className="mx-auto flex w-full max-w-[480px] flex-1 flex-col items-center justify-center gap-6 px-4 text-center">
        <VrullMark size={96} />
        <div className="flex flex-col items-center gap-2.5">
          <h1 className="type-display-xl">{APP_NAME}</h1>
          <p className="type-body-l text-muted-foreground">{t('entry.fetch.tagline')}</p>
        </div>
      </main>
      {failed ? (
        <div className="mx-auto flex w-full max-w-[480px] shrink-0 flex-col gap-3 px-4 pb-6">
          <div role="alert" className="flex flex-col gap-1.5 pb-2 text-center">
            <h2 className="type-title">{t('entry.fetch.failedTitle')}</h2>
            <p className="type-body text-muted-foreground">{t('entry.fetch.failedText')}</p>
          </div>
          <Button variant="primary" size="xl" onClick={() => void scheduler.syncNow()}>
            {t('common.retry')}
          </Button>
          <Button variant="ghost" size="lg" className="w-full" onClick={() => void auth.signOut()}>
            {t('common.signOut')}
          </Button>
        </div>
      ) : (
        <div role="status" className="flex shrink-0 flex-col items-center gap-3.5 px-4 pb-[72px]">
          <span aria-hidden className="relative block h-1 w-40 overflow-hidden rounded-pill bg-track">
            <span className="absolute inset-y-0 left-10 w-14 animate-loading rounded-pill bg-ember" />
          </span>
          <span className="type-body text-muted-foreground">{t('entry.fetch.status')}</span>
        </div>
      )}
    </div>
  )
}
