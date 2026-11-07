import { Link } from 'react-router'
import { EmptyCard, PageHeader } from '@/components/layout/page'
import { buttonVariants } from '@/components/ui/button-variants'
import { Icon } from '@/components/ui/icons'

export function TodayPage() {
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
        <EmptyCard title="Stërvitja e radhës">
          Shfaqet këtu sapo të shtohet programi Shortcut to Size, duke nisur nga Java 0.
        </EmptyCard>
        <EmptyCard title="Ushqimi i sotëm">
          Kaloritë, proteina dhe vaktet e ditës, kundrejt objektivave.
        </EmptyCard>
      </div>
    </>
  )
}
