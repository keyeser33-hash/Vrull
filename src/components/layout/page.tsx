import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icons'

// Koka e një ekrani: një h1 për faqe (Omal UI v2: 30/36, 600, -0.025em) dhe veprime opsionale.
export function PageHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex min-h-11 items-center justify-between gap-3">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      {actions ? <div className="flex items-center gap-1">{actions}</div> : null}
    </header>
  )
}

// Kartë për një pjesë që ende s'ka të dhëna. Teksti thotë çfarë do shfaqet aty.
export function EmptyCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <h2 className="text-lg leading-7 font-semibold tracking-[-0.01em]">{title}</h2>
      <p className="mt-1 text-sm leading-5 text-muted-foreground">{children}</p>
    </section>
  )
}

/** Shigjeta mbrapa e ekraneve të detajit; kthehet aty nga erdhi përdoruesi. */
export function BackButton({ label }: { label: string }) {
  const navigate = useNavigate()
  return (
    <Button variant="ghost" size="icon" aria-label={label} className="-ml-3 text-foreground" onClick={() => navigate(-1)}>
      <Icon name="chevron-majtas" size={22} />
    </Button>
  )
}
