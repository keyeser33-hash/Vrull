import { Navigate, Outlet, useLocation } from 'react-router'
import { FocusLayout } from '@/components/layout/focus-layout'
import { Button } from '@/components/ui/button'
import { auth, scheduler, useAppPhase, useDataUpgrades, useLanguageSync, usePhotoUploader, useReminderPlanner, useUpdateChecker } from '@/data/app-data'
import { useI18n } from '@/i18n/use-i18n'

// Porta e app-it: i vetmi vend që vendos rrugën sipas fazës (data/phase.ts).
export function AppGate() {
  const phase = useAppPhase()
  const { pathname } = useLocation()
  useDataUpgrades(phase === 'ready')
  useReminderPlanner(phase === 'ready')
  usePhotoUploader(phase === 'ready')
  useUpdateChecker(phase === 'ready')
  useLanguageSync(phase === 'ready')

  switch (phase) {
    case 'loading':
      return <div className="min-h-dvh bg-background" />
    case 'signed_out':
      return pathname === '/hyrja' ? <Outlet /> : <Navigate to="/hyrja" replace />
    case 'fetching':
    case 'fetch_failed':
      return <FetchingScreen failed={phase === 'fetch_failed'} />
    case 'onboarding':
      return pathname === '/fillimi' ? <Outlet /> : <Navigate to="/fillimi" replace />
    case 'ready':
      return pathname === '/hyrja' || pathname === '/fillimi' ? <Navigate to="/" replace /> : <Outlet />
  }
}

function FetchingScreen({ failed }: { failed: boolean }) {
  const { t } = useI18n()
  const footer = failed ? (
    <div className="grid gap-2">
      <Button variant="brand" className="w-full" onClick={() => void scheduler.syncNow()}>
        {t('common.retry')}
      </Button>
      <Button variant="ghost" className="w-full" onClick={() => void auth.signOut()}>
        {t('common.signOut')}
      </Button>
    </div>
  ) : undefined
  return (
    <FocusLayout footer={footer}>
      <div className="mt-16" role="status">
        <h1 className="text-3xl font-semibold tracking-tight">{t(failed ? 'fetch.failedTitle' : 'fetch.title')}</h1>
        <p className="mt-2 text-base leading-6 text-muted-foreground">{t(failed ? 'fetch.failedText' : 'fetch.text')}</p>
      </div>
    </FocusLayout>
  )
}
