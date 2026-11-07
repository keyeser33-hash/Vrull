import { Outlet } from 'react-router'
import { BottomNav } from './bottom-nav'

export function AppShell() {
  return (
    <div className="min-h-dvh bg-background pt-[var(--safe-top)]">
      {/* Nën orën dhe baterinë, kur faqja shkon deri në cep (WebView 140+): përmbajtja që lëviz
          nuk kalon poshtë ikonave të sistemit. Në shfletues --safe-top është 0. */}
      <div aria-hidden className="fixed inset-x-0 top-0 z-30 h-[var(--safe-top)] bg-background" />
      <main className="mx-auto w-full max-w-[480px] px-4 pt-4 pb-[calc(var(--bottom-nav-h)+var(--safe-bottom)+24px)]">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
