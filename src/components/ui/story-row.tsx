import { cn } from '@/lib/cn'
import { Icon, type IconName } from './icons'

// Rrathët e ditës te Sot (V57, SPEC §0.3f; bordi "Sot"): një rresht që lëviz anash, pa shirit lëvizjeje. Çdo rreth 64 px
// me unazë 2,5 px: e pashikuar në `ember-text` (në ditë të lodhura bëhet rërë me vetë tokenin), e shikuar gri. Çdo gjë
// që preket ka të paktën 44 px; etiketa 12 px poshtë rrethit. Pa tekst të gjatë: etiketa mbahet në dy rreshta.

export interface StoryItem {
  key: string
  label: string
  /** Ajo që thotë lexuesi i ekranit (etiketa, me "e re" kur është e pashikuar). */
  spoken: string
  icon: IconName
  seen: boolean
  onSelect: () => void
}

export function StoryRow({ items, label, className }: { items: readonly StoryItem[]; label: string; className?: string }) {
  if (items.length === 0) return null
  return (
    <ul aria-label={label} className={cn('-mx-4 m-0 flex list-none gap-3 overflow-x-auto px-4 py-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', className)}>
      {items.map((item) => (
        <li key={item.key} className="shrink-0">
          <button
            type="button"
            aria-label={item.spoken}
            onClick={item.onSelect}
            className="flex min-h-touch w-[72px] flex-col items-center gap-1.5 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
          >
            <span aria-hidden className={cn('box-border flex size-16 items-center justify-center rounded-pill border-[2.5px] p-[3px]', item.seen ? 'border-subtle' : 'border-ember-text')}>
              <span className="flex size-full items-center justify-center rounded-pill bg-surface text-foreground">
                <Icon name={item.icon} size={24} />
              </span>
            </span>
            <span aria-hidden className={cn('line-clamp-2 w-full text-center text-xs leading-[1.2]', item.seen ? 'text-muted-foreground' : 'text-foreground')}>
              {item.label}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
