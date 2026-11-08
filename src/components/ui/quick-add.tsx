import { type FormEvent, useId } from 'react'
import { cn } from '@/lib/cn'
import { Icon } from './icons'
import { surfaceClass } from './surface'

// Shtimi i ushqimit me një prekje (V6, V14): fusha "Me fjalë", foto e pjatës dhe barkodi në një
// rresht. Kur kufiri mujor i AI-së arrihet, foto e thotë dhe mbeten kërkimi dhe barkodi.
export function QuickAdd({
  value,
  onChange,
  onSubmit,
  onPhoto,
  onBarcode,
  aiLimitReached = false,
  label = 'Me fjalë: shkruaj çfarë hëngre',
  placeholder = 'p.sh. 2 vezë dhe një fetë bukë',
  className,
}: {
  value: string
  onChange: (value: string) => void
  onSubmit: (text: string) => void
  onPhoto: () => void
  onBarcode: () => void
  aiLimitReached?: boolean
  label?: string
  placeholder?: string
  className?: string
}) {
  const id = useId()
  const limitId = `${id}-kufiri`
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const text = value.trim()
    if (text) onSubmit(text)
  }
  const iconButton = 'flex size-12 shrink-0 items-center justify-center rounded-md bg-surface-2 text-foreground'
  return (
    <form aria-label="Shto shpejt" onSubmit={submit} className={cn(surfaceClass, 'flex flex-col gap-1.5 rounded-lg p-1.5', className)}>
      <div className="flex items-center gap-1.5">
        <label htmlFor={id} className="sr-only">
          {label}
        </label>
        <input
          id={id}
          type="text"
          enterKeyHint="search"
          autoComplete="off"
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className="h-12 min-w-0 flex-1 rounded-md border-0 bg-background px-3 type-body text-foreground placeholder:text-muted-foreground"
        />
        <button
          type="button"
          aria-label="Foto e pjatës"
          aria-disabled={aiLimitReached || undefined}
          aria-describedby={aiLimitReached ? limitId : undefined}
          onClick={aiLimitReached ? undefined : onPhoto}
          className={cn(iconButton, aiLimitReached && 'opacity-50')}
        >
          <Icon name="kamera" size={22} />
        </button>
        <button type="button" aria-label="Skano barkodin" onClick={onBarcode} className={iconButton}>
          <Icon name="barkodi-vija" size={22} />
        </button>
      </div>
      {aiLimitReached ? (
        <p id={limitId} className="m-0 px-1.5 pb-1 text-[13px] leading-[1.35] text-muted-foreground">
          Kufiri i këtij muaji u arrit
        </p>
      ) : null}
    </form>
  )
}
