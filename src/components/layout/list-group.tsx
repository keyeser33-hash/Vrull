import { type ReactNode, useId } from 'react'
import { Link } from 'react-router'
import { Icon } from '@/components/ui/icons'
import { cn } from '@/lib/cn'

// Grupet e rreshtave (cilësimet, editori i programit): titull i vogël sipër, karta me rreshta
// 56 px. Një rresht hap një fletë ose një ekran; vlera e tanishme rri djathtas.

export function Group({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="flex flex-col">
      <div className="mb-1 flex min-h-5 items-end justify-between gap-3">
        <h2 id={id} className="text-sm leading-5 font-semibold text-muted-foreground">
          {title}
        </h2>
        {action}
      </div>
      <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">{children}</div>
    </section>
  )
}

const rowClass = 'flex min-h-14 items-center gap-3 border-t border-border-subtle px-4 py-2 text-left first:border-t-0 hover:bg-accent'

function RowBody({ label, detail, value, chevron = true }: { label: string; detail?: ReactNode; value?: string; chevron?: boolean }) {
  return (
    <>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-base leading-6">{label}</span>
        {detail ? <span className="text-xs leading-4 text-muted-foreground">{detail}</span> : null}
      </span>
      {value ? <span className="max-w-[55%] text-right text-sm leading-5 text-muted-foreground tabular-nums">{value}</span> : null}
      {chevron ? <Icon name="chevron-djathtas" size={16} className="shrink-0 text-muted-foreground" /> : null}
    </>
  )
}

/** Një rresht 56 px; `action` për veprimet e menjëhershme (pa shigjetë, nuk hap fletë). */
export function Row({
  label,
  detail,
  value,
  onClick,
  disabled,
  action,
  ariaLabel,
}: {
  label: string
  detail?: ReactNode
  value?: string
  onClick: () => void
  disabled?: boolean
  action?: boolean
  ariaLabel?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel ?? (value ? `${label}, ${value}` : label)}
      className={cn(rowClass, 'disabled:opacity-50')}
    >
      <RowBody label={label} detail={detail} value={value} chevron={!action} />
    </button>
  )
}

/** Rresht që hap një ekran tjetër. */
export function LinkRow({ to, label, detail, value }: { to: string; label: string; detail?: ReactNode; value?: string }) {
  return (
    <Link to={to} className={rowClass}>
      <RowBody label={label} detail={detail} value={value} />
    </Link>
  )
}

/** Rresht me çelës (ndezur/fikur); i gjithë rreshti prek çelësin. */
export function SwitchRow({ label, detail, checked, onChange }: { label: string; detail?: ReactNode; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className={cn(rowClass, 'cursor-pointer')}>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-base leading-6">{label}</span>
        {detail ? <span className="text-xs leading-4 text-muted-foreground">{detail}</span> : null}
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(event) => onChange(event.currentTarget.checked)} className="size-5 shrink-0 accent-current" />
    </label>
  )
}
