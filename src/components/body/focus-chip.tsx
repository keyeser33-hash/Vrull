import { buttonVariants } from '@/components/ui/button-variants'
import { Icon } from '@/components/ui/icons'

// Emri i muskulit të fokusuar mbi modelin 3D (SPEC §11): emri, një rresht me vlerën ose rolin,
// "Më shumë" kur ka fletë për të, dhe "×" që heq fokusin.

export function FocusChip({ title, detail, onOpen, onClear }: { title: string; detail: string; onOpen?: () => void; onClear: () => void }) {
  return (
    <div
      role="group"
      aria-label="Muskuli i zgjedhur"
      className="mb-1 flex w-full max-w-[340px] items-center gap-2 rounded-2xl bg-panel-button/95 py-1.5 pr-0.5 pl-4 text-panel-foreground shadow-md"
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm leading-5 font-semibold">{title}</span>
        <span className="truncate text-xs leading-4 text-panel-foreground/80">{detail}</span>
      </span>
      {onOpen ? (
        <button type="button" aria-label={`Më shumë për ${title}`} onClick={onOpen} className={buttonVariants({ variant: 'on-panel' })}>
          Më shumë
        </button>
      ) : null}
      <button type="button" aria-label="Hiq fokusin" onClick={onClear} className="flex size-11 shrink-0 items-center justify-center rounded-full">
        <Icon name="mbyll" size={20} />
      </button>
    </div>
  )
}
