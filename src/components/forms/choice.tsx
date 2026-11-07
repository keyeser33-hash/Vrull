import { cn } from '@/lib/cn'

// Një zgjedhje radio si rresht 44 px (tema, receta, teknika); e zgjedhura ka kufi dhe sfond.
export function Choice({
  name,
  value,
  checked,
  onChange,
  label,
  hint,
}: {
  name: string
  value: string
  checked: boolean
  onChange: () => void
  label: string
  hint?: string
}) {
  return (
    <label
      className={cn(
        'flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3.5 py-2 text-base',
        checked ? 'border-foreground bg-selected' : 'border-border hover:bg-accent',
      )}
    >
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="size-4 shrink-0 accent-current" />
      <span className="flex flex-col">
        <span className="leading-6">{label}</span>
        {hint ? <span className="text-xs leading-4 text-muted-foreground">{hint}</span> : null}
      </span>
    </label>
  )
}
