import type { ReactNode } from 'react'

// Korniza e ekraneve pa navigim poshtë (hyrja, hapat e para): përmbajtja lart, veprimi
// kryesor në fund, në gjerësi të plotë (Omal UI v2, telefoni). Hapësirat e sigurta si te AppShell.
export function FocusLayout({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background pt-[var(--safe-top)] pb-[var(--safe-bottom)]">
      <div aria-hidden className="fixed inset-x-0 top-0 z-30 h-[var(--safe-top)] bg-background" />
      <main className="mx-auto flex w-full max-w-[480px] flex-1 flex-col px-4 pt-4 pb-6">{children}</main>
      {footer ? <footer className="mx-auto w-full max-w-[480px] px-4 pb-6">{footer}</footer> : null}
    </div>
  )
}
