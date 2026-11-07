import { Link } from 'react-router'
import { EmptyCard, PageHeader } from '@/components/layout/page'
import { buttonVariants } from '@/components/ui/button-variants'
import { Icon } from '@/components/ui/icons'
import { store, useLocalQuery } from '@/data/app-data'
import { nextWorkout } from '@/data/profile'

export function TodayPage() {
  const next = useLocalQuery(() => nextWorkout(store), [])
  return (
    <>
      <PageHeader
        title="Sot"
        actions={
          <Link
            to="/cilesimet"
            aria-label="Cilësimet"
            className={buttonVariants({ variant: 'ghost', size: 'icon' })}
          >
            <Icon name="cilesimet" size={22} />
          </Link>
        }
      />
      <div className="space-y-6">
        <section aria-labelledby="next-workout" className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <h2 id="next-workout" className="text-lg leading-7 font-semibold tracking-[-0.01em]">
            Stërvitja e radhës
          </h2>
          {next ? (
            <>
              <p className="mt-2 text-xl leading-7 font-semibold tracking-[-0.015em] tabular-nums">{next.label}</p>
              <p className="text-sm leading-5 text-muted-foreground">{next.dayName}</p>
              <p className="mt-3 text-sm leading-5 text-muted-foreground">
                Ushtrimet dhe peshat e sugjeruara shtohen këtu me programin e plotë.
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm leading-5 text-muted-foreground">Shfaqet këtu pasi të zgjidhet programi.</p>
          )}
        </section>
        <EmptyCard title="Ushqimi i sotëm">Kaloritë, proteina dhe vaktet e ditës, kundrejt objektivave.</EmptyCard>
      </div>
    </>
  )
}
