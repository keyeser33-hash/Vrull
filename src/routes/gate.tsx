import { Navigate, Outlet, useLocation } from 'react-router'
import { FocusLayout } from '@/components/layout/focus-layout'
import { Button } from '@/components/ui/button'
import { auth, scheduler, useAppPhase, useDataUpgrades, usePhotoUploader, useReminderPlanner } from '@/data/app-data'

// Porta e app-it: i vetmi vend që vendos rrugën sipas fazës (data/phase.ts).
export function AppGate() {
  const phase = useAppPhase()
  const { pathname } = useLocation()
  useDataUpgrades(phase === 'ready')
  useReminderPlanner(phase === 'ready')
  usePhotoUploader(phase === 'ready')

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
  const footer = failed ? (
    <div className="grid gap-2">
      <Button variant="brand" className="w-full" onClick={() => void scheduler.syncNow()}>
        Provo përsëri
      </Button>
      <Button variant="ghost" className="w-full" onClick={() => void auth.signOut()}>
        Dil nga llogaria
      </Button>
    </div>
  ) : undefined
  return (
    <FocusLayout footer={footer}>
      <div className="mt-16" role="status">
        <h1 className="text-3xl font-semibold tracking-tight">
          {failed ? 'Të dhënat nuk u morën' : 'Po merren të dhënat e tua'}
        </h1>
        <p className="mt-2 text-base leading-6 text-muted-foreground">
          {failed
            ? 'Pas hyrjes duhet internet edhe për këtë hap, që profili dhe historia jote të vijnë nga Supabase. Lidhu dhe provo përsëri.'
            : 'Nëse e ke përdorur Training Hub më parë, profili dhe historia jote vijnë nga Supabase.'}
        </p>
      </div>
    </FocusLayout>
  )
}
