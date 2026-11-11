import { Icon } from '@/components/ui/icons'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'

// Karta e muskulit të prekur mbi modelin 3D (SPEC §11, V53; bordi "Muskuli i prekur"): poshtë majtas,
// në vend të çipit sipër. Emri i grupit me pikën e ngjyrës së tij dhe "×" që heq fokusin; dy rreshta
// (te Trupi: rikuperimi dhe java, bashkë në çdo pamje); poshtë, rreshti 44 px që hap fletën e grupit
// (ushtrimet e programit për të). Sfondi i faqes me kufi `subtle`, që të lexohet mbi modelin në çdo
// temë; një vijë e lidh me muskulin (body-model.tsx).

export function MuscleCard({
  title,
  swatch,
  lines,
  more,
  others,
  moreLabel,
  onOpen,
  onClear,
}: {
  title: string
  /** Klasa e ngjyrës së pikës (p.sh. `bg-ember`). */
  swatch: string
  /** Rreshti i parë i theksuar, i dyti i qetë. */
  lines: [string, string]
  /** Teksti i rreshtit që hap fletën: ushtrimi i parë i programit, ose "Më shumë". Shkurtohet kur është i gjatë. */
  more: string
  /** Pas tij, sa ushtrime të tjera ka ("dhe 3 të tjera"); nuk shkurtohet. */
  others?: string | null
  /** Emri i veprimit për lexuesin e ekranit ("Më shumë për Gjoksi"). */
  moreLabel: string
  onOpen: () => void
  onClear: () => void
}) {
  const { t } = useI18n()
  return (
    <div role="group" aria-label={t('bodyModel.chip.label')} className="flex w-[232px] flex-col rounded-lg border border-subtle bg-background pr-1 pl-3 text-foreground">
      <div className="flex h-11 shrink-0 items-center gap-2">
        <span aria-hidden className={cn('size-2.5 shrink-0 rounded-pill', swatch)} />
        <span className="min-w-0 flex-1 truncate type-body-strong">{title}</span>
        <button
          type="button"
          aria-label={t('bodyModel.chip.clear')}
          onClick={onClear}
          className="flex size-11 shrink-0 items-center justify-center rounded-pill text-muted-foreground outline-none focus-visible:outline-2 focus-visible:outline-foreground"
        >
          <Icon name="mbyll-vrull" size={18} />
        </button>
      </div>
      <p className="truncate pr-2 text-sm leading-5 font-semibold tabular-nums">{lines[0]}</p>
      <p className="truncate pr-2 text-sm leading-5 text-muted-foreground tabular-nums">{lines[1]}</p>
      <button
        type="button"
        aria-label={`${others ? `${more} ${others}` : more}. ${moreLabel}`}
        onClick={onOpen}
        className="mt-2 flex h-11 shrink-0 items-center justify-between gap-2 border-t border-border pr-2.5 text-left text-sm font-semibold outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground"
      >
        <span className="flex min-w-0 gap-1">
          <span className="min-w-0 truncate">{more}</span>
          {others ? <span className="shrink-0">{others}</span> : null}
        </span>
        <Icon name="hap" size={16} className="shrink-0 text-muted-foreground" />
      </button>
    </div>
  )
}
