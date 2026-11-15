import { type KeyboardEvent, type PointerEvent, type ReactNode, useEffect, useRef } from 'react'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import { Button } from './button'
import { Icon } from './icons'

// Shikuesi i story-ve (V57, SPEC §0.3f; bordet "Story · Gjendja", "Story · Gjumi", "Story · Gati"): ekran i plotë mbi
// kornizën, pa tab-bar; shiritat lart (një për çdo story, i mbushuri për të parat), "×" 44 px, kreu me titullin dhe
// numëruesin. Pa kalim me kohë, pa tinguj, pa festime. Kalimi me prekje në gjysmën e djathtë ose të majtë dhe me
// rrëshqitje, vetëm kur story nuk ka zgjedhje të hapura (`open`); me tastet ← →. Butoni mbrapa i telefonit është
// adresa e hapjes (shiko `onClose`), Escape mbyll, fokusi mbetet brenda, lexuesi i ekranit dëgjon "Story 2 nga 5" dhe
// titullin. Pa animacion fare, pra edhe me lëvizje të reduktuar. Komponenti është i ripërdorshëm: "A e dije?" dhe kuizi.

export interface StoryPage {
  key: string
  /** Titulli që dëgjon lexuesi i ekranit ("Gjumi"). */
  label: string
  /** Pyetje pa përgjigje: pa prekje dhe pa rrëshqitje; mbrapa vetëm me butonin. */
  open?: boolean
  children: ReactNode
}

const SWIPE_PX = 48
const INTERACTIVE = 'button, a, input, select, textarea, [role="button"], [role="slider"]'
const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function StoryViewer({
  title,
  subtitle,
  counter,
  pages,
  index,
  onIndex,
  onClose,
}: {
  title: string
  subtitle?: string
  /** Numëruesi te kreu ("1 / 4"); pa të nuk del. */
  counter?: string
  pages: readonly StoryPage[]
  index: number
  onIndex: (index: number) => void
  onClose: () => void
}) {
  const { t } = useI18n()
  const root = useRef<HTMLDivElement>(null)
  const start = useRef<{ x: number; y: number } | null>(null)
  const swiped = useRef(false)
  const page = pages[Math.min(Math.max(index, 0), pages.length - 1)]
  const at = pages.indexOf(page)
  const free = !page.open

  useEffect(() => {
    root.current?.focus()
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const go = (target: number) => {
    if (target < 0) return
    if (target >= pages.length) return onClose()
    onIndex(target)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Tab') {
      const items = [...(root.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])]
      if (items.length === 0) return event.preventDefault()
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && (document.activeElement === first || document.activeElement === root.current)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
      return
    }
    if (!free || (event.target as HTMLElement).closest('input, select, textarea')) return
    if (event.key === 'ArrowRight') go(at + 1)
    if (event.key === 'ArrowLeft') go(at - 1)
  }

  const onDown = (event: PointerEvent<HTMLDivElement>) => {
    start.current = { x: event.clientX, y: event.clientY }
    swiped.current = false
  }
  const onUp = (event: PointerEvent<HTMLDivElement>) => {
    const from = start.current
    start.current = null
    if (!from || !free) return
    const dx = event.clientX - from.x
    if (Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > Math.abs(event.clientY - from.y) * 1.5) {
      swiped.current = true
      go(at + (dx < 0 ? 1 : -1))
    }
  }
  const onTap = (event: React.MouseEvent<HTMLDivElement>) => {
    if (swiped.current) {
      swiped.current = false
      return
    }
    if (!free || (event.target as HTMLElement).closest(INTERACTIVE)) return
    const box = event.currentTarget.getBoundingClientRect()
    go(at + (event.clientX - box.left < box.width / 2 ? -1 : 1))
  }

  const spoken = t('sot.viewer.position', { n: at + 1, total: pages.length, title: page.label })
  return (
    <div
      ref={root}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className="fixed inset-0 z-50 flex flex-col bg-background pt-[var(--safe-top)] pb-[var(--safe-bottom)] text-foreground outline-none"
    >
      <div className="mx-auto flex min-h-0 w-full max-w-[480px] flex-1 flex-col">
        <div role="progressbar" aria-label={title} aria-valuemin={1} aria-valuemax={pages.length} aria-valuenow={at + 1} aria-valuetext={spoken} className="flex shrink-0 gap-1 px-3 pt-2.5">
          {pages.map((item, position) => (
            <span key={item.key} aria-hidden className={cn('h-[3px] flex-1 rounded-sm', position <= at ? 'bg-foreground' : 'bg-subtle')} />
          ))}
        </div>
        <p role="status" className="sr-only">
          {spoken}
        </p>
        <header className="flex h-12 shrink-0 items-center gap-1 pr-4 pl-1">
          <Button variant="ghost" size="icon" aria-label={t('common.close')} className="rounded-pill" onClick={onClose}>
            <Icon name="mbyll-vrull" size={22} />
          </Button>
          <div className="flex min-w-0 flex-col gap-px">
            <span className="truncate text-[13px] leading-[1.2] font-semibold">{title}</span>
            {subtitle ? <span className="truncate text-xs leading-[1.2] text-muted-foreground">{subtitle}</span> : null}
          </div>
          <div className="ml-auto flex items-center gap-1">
            {page.open && at > 0 ? (
              <Button variant="ghost" size="icon" aria-label={t('sot.viewer.back')} className="rounded-pill" onClick={() => go(at - 1)}>
                <Icon name="mbrapa" size={22} />
              </Button>
            ) : null}
            {counter ? <span className="text-[13px] text-muted-foreground tabular-nums">{counter}</span> : null}
          </div>
        </header>
        <div
          key={page.key}
          onPointerDown={onDown}
          onPointerUp={onUp}
          onPointerCancel={() => (start.current = null)}
          onClick={onTap}
          className="flex min-h-0 flex-1 flex-col touch-pan-y overflow-y-auto"
        >
          {page.children}
        </div>
      </div>
    </div>
  )
}
