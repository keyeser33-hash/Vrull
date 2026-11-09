import { type ReactNode, useEffect, useId, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icons'
import { useI18n } from '@/i18n/use-i18n'

// Fleta nga poshtë e Vrullit (bordi "Përditësimi"): `surface` me cepat 20 px sipër, doreza, titulli
// `display-s` me një rresht poshtë dhe "Mbyll" 44 px; veprimi kryesor (opsional) rri në fund, jashtë
// pjesës që lëviz. Hapet me një parametër në adresë, që butoni mbrapa i Android-it ta mbyllë pa dalë
// nga ekrani; onClose zakonisht bën navigate(-1). Me `hero` (bordi "Arritja"): shenja e madhe në qendër,
// titulli dhe rreshti poshtë saj, të qendërzuar; "Mbyll" mbetet lart djathtas.
export function Sheet({
  title,
  description,
  hero,
  onClose,
  footer,
  children,
}: {
  title: string
  /** Rreshti poshtë titullit (p.sh. "Ke 0.20.0. Shkarkimi: 12 MB."). */
  description?: ReactNode
  /** Shenja dekorative mbi titull; kreu bëhet i qendërzuar. */
  hero?: ReactNode
  onClose: () => void
  /** Veprimi në fund të fletës, gjithnjë i dukshëm. */
  footer?: ReactNode
  children?: ReactNode
}) {
  const { t } = useI18n()
  const titleId = useId()
  const descriptionId = useId()
  const panel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    panel.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const close = (
    <Button variant="ghost" size="icon" aria-label={t('common.close')} className="rounded-pill" onClick={onClose}>
      <Icon name="mbyll-vrull" size={22} />
    </Button>
  )
  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end">
      <div aria-hidden className="absolute inset-0 bg-scrim" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className="relative mx-auto flex max-h-[85dvh] w-full max-w-[480px] flex-col rounded-t-xl border-t border-surface-border bg-surface pb-[var(--safe-bottom)] text-foreground outline-none"
      >
        <span aria-hidden className="mt-2 h-1 w-9 shrink-0 self-center rounded-pill bg-subtle" />
        {hero ? (
          <header className="flex shrink-0 flex-col items-center gap-2.5 px-4 text-center">
            <div className="-mr-2 -mb-3 flex self-stretch justify-end">{close}</div>
            {hero}
            <h2 id={titleId} className="mt-2 type-display-s">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="type-body text-muted-foreground tabular-nums">
                {description}
              </p>
            ) : null}
          </header>
        ) : (
          <header className="flex shrink-0 items-start justify-between gap-2 pt-2 pr-2 pl-4">
            <div className="flex min-w-0 flex-col gap-0.5 pt-1.5">
              <h2 id={titleId} className="type-display-s">
                {title}
              </h2>
              {description ? (
                <p id={descriptionId} className="type-body text-muted-foreground tabular-nums">
                  {description}
                </p>
              ) : null}
            </div>
            {close}
          </header>
        )}
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto px-4 pt-3.5 pb-4">{children}</div>
        {footer ? <div className="shrink-0 px-4 pt-3 pb-5">{footer}</div> : null}
      </div>
    </div>
  )
}
