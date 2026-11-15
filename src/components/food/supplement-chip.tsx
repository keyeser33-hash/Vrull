import { Icon } from '@/components/ui/icons'
import type { MealSupplement } from '@/data/nutrition'
import { supplementDose, supplementName } from '@/i18n/domain'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'

// Çipi i një suplementi (bordet "Ushqimi · Dita" dhe "Fleta e vaktit"): kutia, emri dhe doza; prekja është "E mora".
// I marri mbetet i zbehur, me shenjën ✓, pa vijë mbi tekst; prekja e tij heq shenjën.

export function SupplementChip({ item, onToggle }: { item: MealSupplement; onToggle: () => void }) {
  const { t, fmt } = useI18n()
  const name = supplementName(t, item.name)
  const dose = supplementDose(t, item.name, item.doseText, { amount: item.doseAmount, unit: item.doseUnit, fmt })
  return (
    <button
      type="button"
      aria-pressed={item.taken}
      aria-label={t(item.taken ? 'foodday.supp.taken' : 'foodday.supp.take', { name })}
      onClick={onToggle}
      className={cn(
        'flex min-h-touch items-center gap-2.5 rounded-md border border-subtle bg-surface-2 py-1 pr-3.5 pl-3 text-left whitespace-nowrap',
        item.taken && 'opacity-60',
      )}
    >
      <span aria-hidden className={cn('flex size-5 shrink-0 items-center justify-center rounded-[6px] border-2', item.taken ? 'border-foreground bg-foreground text-background' : 'border-muted-foreground')}>
        {item.taken ? <Icon name="zgjedhur" size={12} /> : null}
      </span>
      <span className="text-[15px] leading-5 font-semibold">{name}</span>
      <span className="text-sm leading-5 text-muted-foreground tabular-nums">{dose}</span>
    </button>
  )
}
