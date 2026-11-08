import { type ReactNode, useId } from 'react'

// Fusha e Vrullit: etiketa 14/20 500 6 px mbi fushën, fusha 44 px me radius 12 dhe tekst
// 16 px, ndihma dhe gabimi poshtë saj, të lidhura me aria-describedby.

interface ControlProps {
  id: string
  'aria-describedby'?: string
  'aria-invalid'?: true
}

export function Field({
  label,
  hint,
  error,
  className,
  children,
}: {
  label: string
  hint?: ReactNode
  error?: string | null
  className?: string
  children: (props: ControlProps) => ReactNode
}) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm leading-5 font-medium text-foreground">
        {label}
      </label>
      {children({ id, 'aria-describedby': describedBy, ...(error ? { 'aria-invalid': true as const } : {}) })}
      {error ? (
        <p id={errorId} className="mt-1.5 text-sm leading-5 text-danger">
          {error}
        </p>
      ) : null}
      {hint ? (
        <p id={hintId} className="mt-1.5 text-sm leading-5 text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
