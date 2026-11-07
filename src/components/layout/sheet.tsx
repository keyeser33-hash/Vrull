import { type ReactNode, useEffect, useId, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icons'

// Fletë nga poshtë (seanca, cilësimet). Hapet me një parametër në adresë, që butoni mbrapa i
// Android-it ta mbyllë pa dalë nga ekrani; onClose zakonisht bën navigate(-1).
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const titleId = useId()
  const panel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    panel.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end">
      <div aria-hidden className="absolute inset-0 bg-overlay" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative mx-auto flex max-h-[85dvh] w-full max-w-[480px] flex-col rounded-t-xl bg-popover pb-[var(--safe-bottom)] text-popover-foreground outline-none"
      >
        <header className="flex items-center gap-2 py-2 pr-2 pl-4">
          <h2 id={titleId} className="flex-1 text-lg leading-7 font-semibold">
            {title}
          </h2>
          <Button variant="ghost" size="icon" aria-label="Mbyll" onClick={onClose}>
            <Icon name="mbyll" />
          </Button>
        </header>
        <div className="flex flex-col gap-3 overflow-y-auto px-4 pb-4">{children}</div>
      </div>
    </div>
  )
}
