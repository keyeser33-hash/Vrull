import { type FormEvent, useId, useState } from 'react'
import { useNavigate } from 'react-router'
import { Icon } from '@/components/ui/icons'
import type { NutritionDay } from '@/data/nutrition'
import { useI18n } from '@/i18n/use-i18n'
import { FoodToastBar } from './food-toast'
import type { FoodToast } from './use-food-toast'
import { useMealPhoto } from './use-meal-photo'

// Fusha "Çfarë hëngre?" poshtë, mbi tab-bar-in (SPEC §0.3h, Q2; bordi "Ushqimi · Dita"): Enter te tastiera çon te kërkimi i
// vaktit të radhës (`?q=`); "Dërgo" hap Kutinë e AI-së me tekstin; barkodi dhe fotoja punojnë për vaktin e radhës.
// Njoftimi me "Zhbëj" del mbi të.

/** Vakti ku shkon fusha: i radhësi, ndryshe vakti i fundit i ditës (dita e kaluar ose e mbaruar). */
const askMeal = (day: NutritionDay) => day.next?.meal ?? day.meals.at(-1)!.meal

export function AskDock({ day, toast, onClearToast }: { day: NutritionDay; toast: FoodToast | null; onClearToast: () => void }) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const id = useId()
  const [text, setText] = useState('')
  const meal = askMeal(day)
  const photo = useMealPhoto(day.date, meal)
  const value = text.trim()
  const search = (event: FormEvent) => {
    event.preventDefault()
    if (value) navigate(`/ushqimi/shto/${meal}?q=${encodeURIComponent(value)}`)
  }
  const icon = 'flex size-touch shrink-0 items-center justify-center rounded-md text-muted-foreground disabled:opacity-50'
  return (
    <div className="fixed inset-x-0 bottom-[calc(var(--spacing-tab-bar)+var(--safe-bottom))] z-20 flex flex-col gap-2 border-t border-border bg-background px-4 pt-2.5 pb-2.5">
      <FoodToastBar toast={toast} onClear={onClearToast} />
      <form aria-label={t('box.dock.label')} onSubmit={search} className="mx-auto flex w-full max-w-[448px] items-center gap-2">
        <span className="relative flex min-h-[52px] min-w-0 flex-1 items-center rounded-lg border border-subtle bg-surface py-1 pr-0.5 pl-10.5">
          <Icon name="shkendija" size={18} className="absolute top-4 left-3.5 text-data" />
          <label htmlFor={id} className="sr-only">
            {t('foodday.ask.label')}
          </label>
          <input
            id={id}
            type="text"
            enterKeyHint="search"
            autoComplete="off"
            value={text}
            placeholder={t('foodday.ask.label')}
            onChange={(event) => setText(event.target.value)}
            className="h-11 min-w-0 flex-1 border-0 bg-transparent type-body-l text-foreground placeholder:text-muted-foreground"
          />
          <button type="button" aria-label={t('foodday.ask.barcode')} className={icon} onClick={() => navigate(`/ushqimi/shto/${meal}?barkod=1`)}>
            <Icon name="barkodi-vija" size={20} />
          </button>
          <button type="button" aria-label={t('foodday.ask.photo')} className={icon} disabled={photo.disabled} onClick={photo.open}>
            <Icon name="kamera" size={20} />
          </button>
        </span>
        <button
          type="button"
          aria-label={t('foodday.ask.send')}
          disabled={!value}
          onClick={() => navigate('/kutia', { state: { text: value } })}
          className="flex size-[52px] shrink-0 items-center justify-center rounded-lg border border-surface-border bg-surface text-muted-foreground disabled:opacity-50"
        >
          <Icon name="dergo" size={22} />
        </button>
      </form>
      {photo.input}
    </div>
  )
}
