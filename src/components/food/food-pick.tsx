import type { ReactNode } from 'react'
import { Icon } from '@/components/ui/icons'
import type { BasketItem } from '@/data/basket'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import { FoodTile } from './food-tile'
import type { BasketApi } from './use-basket'

// Rreshtat e kërkimit të ushqimit (V59, SPEC §0.3h; bordet "Ushqimi · Kërko"): pllaka, emri me burimin e shkurtër,
// porcioni me kcal dhe proteinë, dhe "+" që e shton në shportë me atë porcion; kur është aty, "+" bëhet − N +.
// Prekja e emrit hap sasinë.

const touch = 'flex size-11 shrink-0 items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground'

/** Seksioni me titullin `type-label` dhe, opsionalisht, "+ Të gjitha". */
export function PickSection({ title, onAddAll, addAllLabel, children }: { title: string; onAddAll?: () => void; addAllLabel?: string; children: ReactNode }) {
  const { t } = useI18n()
  return (
    <section aria-label={title} className="flex flex-col">
      <div className="flex min-h-11 items-center justify-between gap-3">
        <h2 className="type-label text-muted-foreground">{title}</h2>
        {onAddAll ? (
          <button type="button" aria-label={addAllLabel} onClick={onAddAll} className="flex min-h-11 items-center px-0.5 type-body-strong text-ember-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground">
            {t('foodsearch.addAll')}
          </button>
        ) : null}
      </div>
      <ul className="flex flex-col">{children}</ul>
    </section>
  )
}

export function PickRow({
  name,
  aside,
  asideLang = 'en',
  note,
  tag,
  detail,
  size = 'md',
  basket,
  match,
  unit,
  resolve,
  onOpen,
  onAdd,
  addLabel,
}: {
  name: string
  /** Emri anglisht krahas emrit shqip të pakontrolluar (Lista e Vrullit, SPEC §0.3h). */
  aside?: string
  /** Gjuha e `aside` (parazgjedhje anglisht; pjatat shqiptare në anglisht kanë emrin shqip krahas). */
  asideLang?: 'sq' | 'en'
  /** Rreshti i shenjave poshtë porcionit ("vlerësim", "recetë e lexuesve"; pjatat shqiptare, V65). */
  note?: string
  tag?: string
  detail: string
  size?: 'md' | 'lg'
  basket: BasketApi
  /** Artikulli i shportës që i përket këtij rreshti. */
  match: (item: BasketItem) => boolean
  /** Sasia e një porcioni të rreshtit (gramë, ose porcione për makrot e shpejta). */
  unit: number
  /** Artikulli me porcionin e rreshtit (ruan ushqimin e jashtëm, krijon ushqimin e planit); null kur ushqimi nuk ekziston më. */
  resolve: () => Promise<BasketItem | null>
  /** Prekja e emrit: hap sasinë e ushqimit me id-në e dhënë. */
  onOpen: (foodId: string) => void
  /** Nëse jepet, "+" thërret këtë në vend të shtimit të një artikulli (rreshti që shton disa ushqime). */
  onAdd?: () => void
  /** Emri i butonit "+" kur `onAdd` jepet. */
  addLabel?: string
}) {
  const { t, fmt } = useI18n()
  const current = basket.items.find(match)
  const amount = current ? (current.grams ?? current.servings ?? 0) : 0
  const count = current && unit > 0 ? Math.max(0.5, Math.round((amount / unit) * 2) / 2) : 0
  const add = async () => {
    if (onAdd) return onAdd()
    const item = await resolve()
    if (item) basket.add(item)
  }
  const height = size === 'lg' ? 'min-h-[68px]' : 'min-h-[60px]'
  const body = 'flex min-w-0 flex-1 items-center gap-3 text-left'
  const content = (
    <>
      <FoodTile size={size === 'lg' ? 'lg' : 'md'} names={[aside, name]} />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="flex items-center gap-2">
          <span className="truncate type-body-strong">{name}</span>
          {tag ? <span className="shrink-0 text-xs font-semibold text-muted-foreground">{tag}</span> : null}
        </span>
        {aside ? <span lang={asideLang} className="truncate text-[13px] leading-[18px] text-muted-foreground">{aside}</span> : null}
        <span className="text-[13px] leading-[18px] text-muted-foreground tabular-nums">{detail}</span>
        {note ? <span className="text-[13px] leading-[18px] font-semibold text-muted-foreground">{note}</span> : null}
      </span>
    </>
  )
  return (
    <li className={cn('flex items-center gap-3 border-t border-border', height)}>
      {onAdd ? (
        <div className={cn(body, height)}>{content}</div>
      ) : (
        <button
          type="button"
          onClick={async () => {
            const item = await resolve()
            if (item) onOpen(item.foodId)
          }}
          className={cn(body, height, 'outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground')}
        >
          {content}
        </button>
      )}
      {count > 0 && !onAdd ? (
        <span role="group" aria-label={t('foodsearch.inBasket', { food: name, count })} className="flex h-11 shrink-0 items-center rounded-md bg-foreground text-background tabular-nums">
          <button type="button" aria-label={t('foodsearch.less', { food: name })} onClick={() => basket.step(match, unit, -1)} className={cn(touch, 'rounded-l-md')}>
            <Icon name="hiq" size={20} />
          </button>
          <span className="min-w-6 text-center text-sm font-semibold">{fmt.number(count)}</span>
          <button type="button" aria-label={t('foodsearch.more', { food: name })} onClick={() => void add()} className={cn(touch, 'rounded-r-md')}>
            <Icon name="shto" size={20} />
          </button>
        </span>
      ) : (
        <button type="button" aria-label={addLabel ?? t('foodsearch.add', { food: name })} onClick={() => void add()} className={cn(touch, 'rounded-md border border-subtle text-foreground')}>
          <Icon name="shto" size={20} />
        </button>
      )}
    </li>
  )
}
