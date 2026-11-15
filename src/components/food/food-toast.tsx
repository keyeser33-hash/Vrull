import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n/use-i18n'
import type { FoodToast } from './use-food-toast'

// Njoftimi i qetë pas një veprimi të shpejtë ("U shtua te Dreka · 495 kcal · Zhbëj", SPEC §0.3h, raundi 2):
// 6 sekonda, një njoftim në çdo çast, "Zhbëj" e kthen veprimin. Rri mbi fushën "Çfarë hëngre?".

export function FoodToastBar({ toast, onClear }: { toast: FoodToast | null; onClear: () => void }) {
  const { t } = useI18n()
  if (!toast) return null
  return (
    <div role="status" className="mx-auto flex min-h-button w-full max-w-[448px] items-center justify-between gap-3 rounded-md bg-foreground py-1 pr-1.5 pl-4 text-background">
      <span className="min-w-0 text-[15px] leading-5 font-semibold tabular-nums">{toast.text}</span>
      <Button
        variant="ghost"
        className="text-background underline underline-offset-[3px]"
        onClick={async () => {
          onClear()
          await toast.undo()
        }}
      >
        {t('foodday.undo')}
      </Button>
    </div>
  )
}
