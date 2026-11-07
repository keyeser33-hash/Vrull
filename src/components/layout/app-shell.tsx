import { Outlet } from 'react-router'
import { BottomNav } from './bottom-nav'

export function AppShell() {
  return (
    <div className="min-h-dvh bg-background pt-[var(--safe-top)]">
      <main className="mx-auto w-full max-w-[480px] px-4 pt-4 pb-[calc(var(--bottom-nav-h)+var(--safe-bottom)+24px)]">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
