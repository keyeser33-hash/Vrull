import { type ReactNode, useId, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { Sheet } from '@/components/layout/sheet'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icons'
import { surfaceClass } from '@/components/ui/surface'
import { programDayName } from '@/i18n/domain'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import { PROGRAM_TEMPLATES, type TemplateId } from '@/program/templates'
import { useTemplateNames, useTemplateText } from './builder-format'

// Pjesët e përbashkëta të ndërtuesit (V2-E1-10; bordet "Ndërto", "Dita", "Sloti"): shiriti sipër me
// titullin e vogël në mes, veprimi kryesor poshtë, çipat dhe segmentet 44 px, zgjedhja si buton,
// çelësi, fletët e emrit, të konfirmimit dhe të veprimeve, dhe shabllonet.

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground'

/**
 * Shiriti 56 px i ekraneve të ndërtuesit: × ose shigjeta majtas, titulli i vogël në mes, veprimi djathtas.
 * Mbrapa kthehet aty nga erdhi përdoruesi, ose te `fallback` kur ekrani është i pari në histori.
 */
export function EditorBar({ icon, label, fallback, title, action }: { icon: 'close' | 'back'; label: string; fallback: string; title: string; action?: ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  return (
    <div className="-mx-2 -mt-3 flex h-14 items-center justify-between gap-1">
      <Button
        variant="ghost"
        size="icon"
        aria-label={label}
        className="rounded-pill"
        onClick={() => (location.key === 'default' ? navigate(fallback, { replace: true }) : navigate(-1))}
      >
        <Icon name={icon === 'close' ? 'mbyll-vrull' : 'mbrapa'} size={22} />
      </Button>
      <span className="min-w-0 truncate text-center font-display text-lg leading-[1.2] font-bold tracking-[0.04em] text-muted-foreground uppercase">{title}</span>
      {action ?? <span aria-hidden className="size-touch shrink-0" />}
    </div>
  )
}

/** Butoni ⋯ i shiritit, që hap fletën e veprimeve. */
export function MoreButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button variant="ghost" size="icon" aria-label={label} className="rounded-pill" onClick={onClick}>
      <Icon name="me-shume" size={22} />
    </Button>
  )
}

/** Veprimi kryesor në fund të ekranit, gjithnjë i dukshëm (si te "Krijo ushtrim"). */
export function EditorFooter({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 -mb-[calc(var(--safe-bottom)+24px)] flex flex-col gap-2 border-t border-border bg-background px-4 pt-2.5 pb-[calc(var(--safe-bottom)+20px)]">
      {children}
    </div>
  )
}

/** Butoni 44 px − ose + i një vlere, `surface-2` brenda kartës. */
export function StepButton({ label, sign, onClick, disabled, className }: { label: string; sign: '−' | '+' | string; onClick: () => void; disabled?: boolean; className?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex size-touch shrink-0 items-center justify-center rounded-sm bg-surface-2 font-display text-[22px] font-bold text-foreground disabled:opacity-40',
        focusRing,
        className,
      )}
    >
      {sign}
    </button>
  )
}

/** Segmenti: radio 44 px, i zgjedhuri në bojë (DESIGN.md › segmenti i zgjedhur). */
export function Segmented<V extends string>({
  label,
  options,
  value,
  onChange,
  ground = 'page',
  className,
}: {
  label: string
  options: { value: V; label: string }[]
  value: V
  onChange: (value: V) => void
  ground?: 'page' | 'card'
  className?: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('grid gap-1 rounded-[14px] p-1', ground === 'page' ? surfaceClass : 'border border-border bg-background', className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => {
        const checked = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={checked}
            onClick={() => onChange(option.value)}
            className={cn(
              'min-h-touch rounded-sm px-1.5 text-[15px] leading-[1.15]',
              checked ? 'bg-foreground font-bold text-background' : 'font-semibold text-muted-foreground',
              focusRing,
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

/** Çip 44 px me shkronja të ngushta (blloqet, javët, RIR-i, teknika); i zgjedhuri në bojë. */
export function ChoiceChip({
  selected,
  role = 'radio',
  children,
  onClick,
  className,
  label,
}: {
  selected: boolean
  role?: 'radio' | 'button'
  children: ReactNode
  onClick: () => void
  className?: string
  label?: string
}) {
  return (
    <button
      type="button"
      role={role === 'radio' ? 'radio' : undefined}
      aria-checked={role === 'radio' ? selected : undefined}
      aria-pressed={role === 'button' ? selected : undefined}
      aria-label={label}
      onClick={onClick}
      className={cn(
        'flex h-touch min-w-touch shrink-0 items-center justify-center rounded-md border px-3.5 font-display text-lg leading-none font-bold whitespace-nowrap uppercase tabular-nums',
        selected ? 'border-foreground bg-foreground text-background' : 'border-border bg-surface-2 text-foreground',
        focusRing,
        className,
      )}
    >
      {children}
    </button>
  )
}

/** Zgjedhja si buton 44 px me shigjetë (RIR-i, shtesa): `<select>` i telefonit, që lexuesi i ekranit e njeh. */
export function SelectButton<V extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: V
  options: { value: V; label: string }[]
  onChange: (value: V) => void
}) {
  return (
    <span className="relative inline-flex">
      <select
        aria-label={label}
        value={String(value)}
        onChange={(event) => {
          const found = options.find((option) => String(option.value) === event.currentTarget.value)
          if (found) onChange(found.value)
        }}
        className={cn(
          'h-touch appearance-none rounded-sm border border-subtle bg-surface-2 pr-8 pl-3 font-display text-xl font-bold text-foreground tabular-nums',
          focusRing,
        )}
      >
        {options.map((option) => (
          <option key={String(option.value)} value={String(option.value)}>
            {option.label}
          </option>
        ))}
      </select>
      <Icon name="chevron-poshte" size={16} className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground" />
    </span>
  )
}

/** Çelësi 52 × 30 brenda një zone prekjeje 56 × 44; i ndezur në bojë. */
export function Switch({ checked, label, onChange }: { checked: boolean; label: string; onChange: (checked: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn('flex h-touch w-14 shrink-0 items-center justify-center rounded-pill', focusRing)}
    >
      <span className={cn('flex h-[30px] w-[52px] rounded-pill p-[3px]', checked ? 'justify-end bg-foreground' : 'justify-start bg-subtle')}>
        <span className={cn('size-6 rounded-pill', checked ? 'bg-background' : 'bg-foreground')} />
      </span>
    </button>
  )
}

/** Teksti kur ekrani nuk gjen më programin, ditën ose ushtrimin. */
export function NotFound({ text, back, fallback }: { text: string; back: string; fallback: string }) {
  return (
    <div className="flex flex-col gap-4">
      <EditorBar icon="back" label={back} fallback={fallback} title="" />
      <p className="type-body text-muted-foreground">{text}</p>
    </div>
  )
}

/** Një veprim te fleta "Më shumë": rresht 56 px me emrin dhe një fjali poshtë. */
export function SheetAction({ label, detail, onClick, disabled, danger }: { label: string; detail?: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn('flex min-h-row w-full flex-col justify-center gap-0.5 rounded-md bg-surface-2 px-3.5 py-2 text-left disabled:opacity-50', focusRing)}
    >
      <span className={cn('type-body-strong', danger && !disabled && 'text-danger')}>{label}</span>
      {detail ? <span className="type-caption text-muted-foreground">{detail}</span> : null}
    </button>
  )
}

/** Fleta e një emri (programi, blloku, dita), me gabimin me fjalë kur emri është bosh. */
export function NameSheet({ title, label, initial, onSave, onClose }: { title: string; label: string; initial: string; onSave: (name: string) => Promise<void>; onClose: () => void }) {
  const { t } = useI18n()
  const [name, setName] = useState(initial)
  const [problem, setProblem] = useState(false)
  const [busy, setBusy] = useState(false)
  const inputId = useId()
  const problemId = useId()
  async function save() {
    if (!name.trim()) return setProblem(true)
    setBusy(true)
    await onSave(name.trim())
  }
  const footer = (
    <Button variant="primary" size="xl" disabled={busy} onClick={() => void save()}>
      {t('common.save')}
    </Button>
  )
  return (
    <Sheet title={title} onClose={onClose} footer={footer}>
      <label htmlFor={inputId} className="type-label text-muted-foreground">
        {label}
      </label>
      <input
        id={inputId}
        value={name}
        maxLength={60}
        autoComplete="off"
        aria-invalid={problem ? true : undefined}
        aria-describedby={problem ? problemId : undefined}
        onChange={(event) => (setName(event.currentTarget.value), setProblem(false))}
        onKeyDown={(event) => {
          if (event.key === 'Enter') void save()
        }}
        className={cn('h-button w-full rounded-md border border-border bg-surface-2 px-3.5 text-lg font-semibold text-foreground aria-invalid:border-2 aria-invalid:border-danger', focusRing)}
      />
      {problem ? (
        <p id={problemId} role="alert" className="type-caption text-danger">
          {t('builder.nameEmpty')}
        </p>
      ) : null}
    </Sheet>
  )
}

/** Konfirmimi i një fshirjeje, me fjalinë që thotë çfarë mbetet. */
export function ConfirmSheet({ title, text, action, onConfirm, onClose }: { title: string; text: string; action: string; onConfirm: () => Promise<void>; onClose: () => void }) {
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  const footer = (
    <div className="grid grid-cols-2 gap-2">
      <Button variant="outline" size="lg" onClick={onClose}>
        {t('common.cancel')}
      </Button>
      <Button
        variant="secondary"
        size="lg"
        className="text-danger"
        disabled={busy}
        onClick={() => {
          setBusy(true)
          void onConfirm()
        }}
      >
        {action}
      </Button>
    </div>
  )
  return (
    <Sheet title={title} onClose={onClose} footer={footer}>
      <p className="type-body-l">{text}</p>
    </Sheet>
  )
}

/** Lista e shablloneve (bordi "Programet" › "Shabllonet"): emri, javët, ditët; prekja hap fletën. */
export function TemplateList({ onOpen }: { onOpen: (id: TemplateId) => void }) {
  const text = useTemplateText()
  return (
    <ul className={cn(surfaceClass, 'flex flex-col overflow-hidden rounded-lg')}>
      {PROGRAM_TEMPLATES.map((template, index) => (
        <li key={template.id} className={cn(index > 0 && 'border-t border-border')}>
          <button type="button" onClick={() => onOpen(template.id)} className={cn('flex min-h-row w-full items-center justify-between gap-2.5 py-1.5 pr-3.5 pl-3.5 text-left', focusRing)}>
            <span className="flex min-w-0 flex-col">
              <span className="type-body-strong">{text.name(template.id)}</span>
              <span className="type-caption text-muted-foreground tabular-nums">{text.meta(template)}</span>
            </span>
            <Icon name="chevron-djathtas" size={20} className="text-muted-foreground" />
          </button>
        </li>
      ))}
    </ul>
  )
}

/** Fleta e një shablloni: ditët me ushtrimet e tyre dhe "Ndërto nga shablloni". */
export function TemplateSheet({ id, onUse, onClose }: { id: TemplateId; onUse: () => Promise<void>; onClose: () => void }) {
  const { t } = useI18n()
  const text = useTemplateText()
  const names = useTemplateNames()
  const [busy, setBusy] = useState(false)
  const template = PROGRAM_TEMPLATES.find((candidate) => candidate.id === id)!
  const days = [...template.program.days].sort((a, b) => a.position - b.position)
  const footer = (
    <Button
      variant="primary"
      size="xl"
      disabled={busy}
      onClick={() => {
        setBusy(true)
        void onUse().catch(() => setBusy(false))
      }}
    >
      {t('builder.template.use')}
    </Button>
  )
  return (
    <Sheet title={text.name(id)} description={text.meta(template)} onClose={onClose} footer={footer}>
      <p className="type-body">{t('builder.template.text')}</p>
      <ul className="flex flex-col overflow-hidden rounded-lg bg-surface-2">
        {days.map((day, index) => {
          const count = template.program.slots.filter((slot) => slot.dayId === day.id).length
          const name = template.localized ? (names.day[day.name] ?? day.name) : programDayName(t, day.name)
          return (
            <li key={day.id} className={cn('flex min-h-12 items-center gap-3 px-3.5 py-1.5', index > 0 && 'border-t border-border')}>
              <span aria-hidden className="w-5 text-center font-display text-xl font-extrabold text-muted-foreground">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1 type-body-strong">{name}</span>
              <span className="type-caption text-muted-foreground tabular-nums">{t('builder.count.exercises', { count })}</span>
            </li>
          )
        })}
      </ul>
    </Sheet>
  )
}
