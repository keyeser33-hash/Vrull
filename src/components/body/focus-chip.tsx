import { Icon } from '@/components/ui/icons'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'

// Emri i muskulit të fokusuar mbi modelin 3D (SPEC §11; bordi "Trupi"): një shirit 46 px me pikën
// e ngjyrës së tij, "emri · vlera" në një rresht, shigjeta kur ka fletë për të ("Më shumë") dhe "×"
// që heq fokusin. Sfondi i faqes me kufi `subtle`, që të lexohet mbi modelin në çdo temë.

export function FocusChip({
  title,
  detail,
  swatch,
  onOpen,
  openLabel,
  onClear,
}: {
  title: string
  detail?: string
  /** Klasa e ngjyrës së pikës (p.sh. `bg-volume-2`); pa të, pa pikë. */
  swatch?: string
  /** Hap fletën e grupit; pa të, emri nuk preket. */
  onOpen?: () => void
  /** Emri i veprimit "Më shumë" për lexuesin e ekranit. */
  openLabel?: string
  onClear: () => void
}) {
  const { t } = useI18n()
  const text = detail ? `${title} · ${detail}` : title
  const body = (
    <>
      {swatch ? <span aria-hidden className={cn('size-2.5 shrink-0 rounded-pill', swatch)} /> : null}
      <span className="min-w-0 truncate text-sm leading-5 font-semibold tabular-nums">{text}</span>
      {onOpen ? <Icon name="hap" size={16} className="shrink-0 text-muted-foreground" /> : null}
    </>
  )
  return (
    <div
      role="group"
      aria-label={t('bodyModel.chip.label')}
      className="flex h-[46px] w-full max-w-[360px] items-center rounded-pill border border-subtle bg-background text-foreground"
    >
      {onOpen ? (
        <button
          type="button"
          aria-label={openLabel ? `${text}. ${openLabel}` : undefined}
          onClick={onOpen}
          className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-pill pr-0.5 pl-3 text-left outline-none focus-visible:outline-2 focus-visible:outline-foreground"
        >
          {body}
        </button>
      ) : (
        <span className="flex h-11 min-w-0 flex-1 items-center gap-2 pr-0.5 pl-3">{body}</span>
      )}
      <button
        type="button"
        aria-label={t('bodyModel.chip.clear')}
        onClick={onClear}
        className="flex size-11 shrink-0 items-center justify-center rounded-pill text-muted-foreground outline-none focus-visible:outline-2 focus-visible:outline-foreground"
      >
        <Icon name="mbyll-vrull" size={18} />
      </button>
    </div>
  )
}
