import { type ReactNode, useId } from 'react'
import { Link } from 'react-router'
import { Icon } from '@/components/ui/icons'
import { surfaceClass } from '@/components/ui/surface'
import { cn } from '@/lib/cn'

// Grupet e rreshtave të Vrullit (bordi "Cilësimet"; edhe editori i programit): etiketa `label` sipër,
// karta 16 px me rreshta të paktën 52 px. Një rresht hap një fletë ose një ekran; vlera e tanishme
// rri djathtas me shigjetën. Kufiri i kartës vetëm në OLED (`surfaceClass`).

export function Group({ title, action, children, className }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  const id = useId()
  return (
    <section aria-labelledby={title ? id : undefined} className={cn('flex flex-col gap-2', className)}>
      {title ? (
        <div className="flex min-h-5 items-end justify-between gap-3">
          <h2 id={id} className="type-label text-muted-foreground">
            {title}
          </h2>
          {action}
        </div>
      ) : null}
      <div className={cn(surfaceClass, 'flex flex-col overflow-hidden rounded-lg')}>{children}</div>
    </section>
  )
}

/** Klasa e një rreshti brenda grupit: 52 px, ndarës 1 px mes rreshtave. */
export const rowClass =
  'flex min-h-[52px] w-full items-center gap-3 border-b border-border py-1.5 pr-3 pl-4 text-left last:border-b-0 outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground'

function RowBody({ label, detail, value, chevron = true }: { label: string; detail?: ReactNode; value?: string; chevron?: boolean }) {
  return (
    <>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="type-body-strong">{label}</span>
        {detail ? <span className="type-caption text-muted-foreground">{detail}</span> : null}
      </span>
      {value ? <span className="max-w-[55%] text-right type-body text-muted-foreground tabular-nums">{value}</span> : null}
      {chevron ? <Icon name="hap" size={18} className="shrink-0 text-muted-foreground" /> : null}
    </>
  )
}

/** Një rresht 52 px; `action` për veprimet e menjëhershme (pa shigjetë, nuk hap fletë). */
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
export function LinkRow({ to, label, detail, value, ariaLabel }: { to: string; label: string; detail?: ReactNode; value?: string; ariaLabel?: string }) {
  return (
    <Link to={to} aria-label={ariaLabel} className={rowClass}>
      <RowBody label={label} detail={detail} value={value} />
    </Link>
  )
}

/** Rresht me çelës (ndezur/fikur); i gjithë rreshti prek çelësin. Çelësi i ndezur është në bojë. */
export function SwitchRow({ label, detail, checked, onChange }: { label: string; detail?: ReactNode; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className={cn(rowClass, 'cursor-pointer has-focus-visible:outline-2 has-focus-visible:-outline-offset-2 has-focus-visible:outline-foreground')}>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="type-body-strong">{label}</span>
        {detail ? <span className="type-caption text-muted-foreground">{detail}</span> : null}
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(event) => onChange(event.currentTarget.checked)} className="peer sr-only" />
      {/* Fikur: gjurmë me kontur dhe doreza gri; ndezur: gjurmë në bojë me dorezën në ngjyrën e sfondit. */}
      <span
        aria-hidden
        className="flex h-8 w-[52px] shrink-0 items-center rounded-pill border-2 border-muted-foreground p-[3px] transition-colors peer-checked:justify-end peer-checked:border-foreground peer-checked:bg-foreground peer-checked:*:bg-background"
      >
        <span className="size-5 rounded-pill bg-muted-foreground" />
      </span>
    </label>
  )
}

/** Një zgjedhje radio si rresht (p.sh. dita e matjes): e zgjedhura ka shenjën djathtas. */
export function ChoiceRow({ name, value, label, checked, onChange }: { name: string; value: string; label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className={cn(rowClass, 'cursor-pointer has-focus-visible:outline-2 has-focus-visible:-outline-offset-2 has-focus-visible:outline-foreground')}>
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="sr-only" />
      <span className="min-w-0 flex-1 type-body-strong">{label}</span>
      {checked ? <Icon name="zgjedhur" size={20} className="shrink-0" /> : null}
    </label>
  )
}
