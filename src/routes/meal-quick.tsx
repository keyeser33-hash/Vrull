import { type ChangeEvent, type FormEvent, useId, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Sheet } from '@/components/layout/sheet'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icons'
import { aiMonth } from '@/data/ai-usage'
import { store, useLocalQuery } from '@/data/app-data'
import { logTemplateMeal, type MealSlot } from '@/data/nutrition'
import { copyYesterdayMeal, favoriteFoods, logPortion, logQuickMacros, type Portion, quickMacrosKcal, recentPortions, setFavorite, yesterdayMeal } from '@/data/quick-food'
import { foodName, mealName, nameInSentence } from '@/i18n/domain'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import { compressPhoto } from '@/lib/image'
import { useOnline } from '@/lib/use-online'

// Vakti me ≤ 2 prekje (V2-E2-16; SPEC §9 "Ushqimi më i shpejtë"; bordi V22-Vakti-Shpejt): "Si në plan" si
// veprimi kryesor, "Si dje", Foto (te kutia e AI-së), Makrot, kërkimi, të fundit dhe të preferuarat.

/** Foto e pjatës: 1 568 px, si etiketa (rreth 300 KB), pastaj te kutia e AI-së. */
const PHOTO_MAX_PX = 1568
const RECENT = 3

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  return btoa(binary)
}

export function QuickActions({ date, meal, onMacros }: { date: string; meal: MealSlot; onMacros: () => void }) {
  const i18n = useI18n()
  const { t, fmt, lang } = i18n
  const navigate = useNavigate()
  const online = useOnline()
  const photoInput = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const quick = useLocalQuery(
    async () => ({ yesterday: await yesterdayMeal(store, date, meal.meal), recent: await recentPortions(store, RECENT), favorites: await favoriteFoods(store), aiReached: (await aiMonth(store)).reached }),
    [date, meal.meal],
  )
  const run = (action: () => Promise<unknown>) => {
    setBusy(true)
    void action().finally(() => setBusy(false))
  }
  const portionText = (portion: Portion) => (portion.grams === null ? t('food.quick.serving') : fmt.unit(Math.round(portion.grams), 'g'))
  const name = (portion: Portion) => foodName(t, { name: portion.name, sourceId: portion.sourceId })
  const favoriteIds = new Set((quick?.favorites ?? []).map((item) => item.foodId))

  async function photo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const { data } = await compressPhoto(file, PHOTO_MAX_PX, 0.85)
    navigate('/kutia', { state: { photo: { mediaType: 'image/jpeg', data: toBase64(data) }, text: t('food.photo.message', { meal: nameInSentence(mealName(t, meal.meal), lang) }), target: { date, meal: meal.meal } } })
  }

  const planProtein = Math.round(meal.templateTotals.proteinG)
  return (
    <div className="flex flex-col gap-3">
      {meal.status !== 'done' && meal.template.length > 0 ? (
        <Button variant="primary" className="h-auto min-h-16 justify-between gap-3 rounded-md px-4 py-2.5 text-left normal-case" disabled={busy} onClick={() => run(() => logTemplateMeal(store, date, meal.meal))}>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-2xl leading-none uppercase">{t('food.quick.plan')}</span>
            <span className="font-text text-sm font-medium tracking-normal">{t('food.quick.planDetail', { count: meal.template.length, protein: planProtein })}</span>
          </span>
          <span className="shrink-0 text-xl tabular-nums">{fmt.unit(Math.round(meal.templateTotals.kcal), 'kcal')}</span>
        </Button>
      ) : null}
      {quick?.yesterday ? (
        <Button variant="secondary" className="h-auto min-h-16 justify-between gap-3 rounded-md px-4 py-2.5 text-left normal-case" disabled={busy} onClick={() => run(() => copyYesterdayMeal(store, date, meal.meal))}>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-xl leading-none uppercase">{t('food.quick.yesterday')}</span>
            <span className="truncate font-text text-sm font-normal tracking-normal text-muted-foreground">
              {quick.yesterday.items.map((item) => `${name(item)} ${portionText(item)}`).join(' · ')}
            </span>
          </span>
          <span className="shrink-0 text-lg tabular-nums">{fmt.unit(Math.round(quick.yesterday.kcal), 'kcal')}</span>
        </Button>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" size="lg" disabled={!online || quick?.aiReached} onClick={() => photoInput.current?.click()} className="font-text text-base font-semibold normal-case tracking-normal">
          <Icon name="kamera" size={20} />
          {t('food.quick.photo')}
        </Button>
        <Button variant="outline" size="lg" onClick={onMacros} className="font-text text-base font-semibold normal-case tracking-normal">
          <Icon name="laps" size={20} />
          {t('food.quick.macros')}
        </Button>
      </div>
      <input ref={photoInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => void photo(event)} />
      <Link to={`/ushqimi/shto/${meal.meal}`} replace className="flex h-12 shrink-0 items-center gap-2.5 rounded-md border border-subtle bg-background px-3.5 type-body text-muted-foreground">
        <Icon name="kerko" size={20} />
        {t('food.quick.search')}
      </Link>
      {quick?.recent.length ? (
        <PortionList
          title={t('food.quick.recent')}
          items={quick.recent}
          favorites={favoriteIds}
          busy={busy}
          onAdd={(item) => run(() => logPortion(store, { date, meal: meal.meal, portion: item }))}
          onStar={(item) => run(() => setFavorite(store, item.foodId, favoriteIds.has(item.foodId) ? null : (item.grams ?? 100)))}
        />
      ) : null}
      {quick?.favorites.length ? (
        <PortionList
          title={t('food.quick.favorites')}
          star
          items={quick.favorites}
          favorites={favoriteIds}
          busy={busy}
          onAdd={(item) => run(() => logPortion(store, { date, meal: meal.meal, portion: item }))}
          onStar={(item) => run(() => setFavorite(store, item.foodId, null))}
        />
      ) : null}
    </div>
  )
}

function PortionList({
  title,
  star = false,
  items,
  favorites,
  busy,
  onAdd,
  onStar,
}: {
  title: string
  star?: boolean
  items: Portion[]
  favorites: Set<string>
  busy: boolean
  onAdd: (item: Portion) => void
  onStar: (item: Portion) => void
}) {
  const { t, fmt } = useI18n()
  const id = useId()
  const portionText = (portion: Portion) => (portion.grams === null ? t('food.quick.serving') : fmt.unit(Math.round(portion.grams), 'g'))
  return (
    <section aria-labelledby={id} className="flex flex-col">
      <h3 id={id} className="m-0 mb-1 flex items-center gap-1.5 type-label text-muted-foreground">
        {star ? <span aria-hidden>★</span> : null}
        {title}
      </h3>
      <ul className="m-0 list-none p-0 tabular-nums">
        {items.map((item) => {
          const name = foodName(t, { name: item.name, sourceId: item.sourceId })
          const starred = favorites.has(item.foodId)
          return (
            <li key={item.foodId} className="flex min-h-row items-center gap-2 border-t border-border">
              <span className="flex min-w-0 flex-1 flex-col gap-px">
                <span className="truncate type-body-strong">{name}</span>
                <span className="type-caption text-muted-foreground">{t('food.quick.detail', { portion: portionText(item), kcal: Math.round(item.kcal), protein: Math.round(item.proteinG) })}</span>
              </span>
              <Button
                variant="ghost"
                size="icon"
                aria-label={starred ? t('food.quick.unstar', { food: name }) : t('food.quick.star', { food: name })}
                aria-pressed={starred}
                disabled={busy}
                onClick={() => onStar(item)}
                className={starred ? 'text-ember-text' : 'text-muted-foreground'}
              >
                <Icon name="yll" size={20} />
              </Button>
              <Button variant="outline" size="icon" aria-label={t('food.quick.add', { food: name, portion: portionText(item) })} disabled={busy} onClick={() => onAdd(item)} className="rounded-md">
                <Icon name="plus" size={20} />
              </Button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

const parse = (value: string) => {
  const number = Number(value.replace(',', '.'))
  return value.trim() && Number.isFinite(number) && number >= 0 ? number : null
}

/** Makrot e shpejta (bordi V22-Makrot): emri, kaloritë dhe makrot; kaloritë e shkruara ruhen. */
export function QuickMacrosSheet({ date, meal, onClose, onSaved }: { date: string; meal: MealSlot; onClose: () => void; onSaved: () => void }) {
  const { t, fmt } = useI18n()
  const ids = { name: useId(), kcal: useId(), protein: useId(), carbs: useId(), fat: useId() }
  const [fields, setFields] = useState({ name: '', kcal: '', protein: '', carbs: '', fat: '' })
  const [favorite, setFavoriteChecked] = useState(false)
  const [saving, setSaving] = useState(false)
  const values = { kcal: parse(fields.kcal), proteinG: parse(fields.protein) ?? 0, carbsG: parse(fields.carbs) ?? 0, fatG: parse(fields.fat) ?? 0 }
  const anyMacro = [fields.protein, fields.carbs, fields.fat].some((value) => parse(value) !== null)
  const result = quickMacrosKcal(values)
  const valid = (values.kcal !== null && values.kcal > 0) || (anyMacro && result.fromMacros > 0)
  const mealLabel = mealName(t, meal.meal)
  const numbers = { protein: fmt.number(values.proteinG), carbs: fmt.number(values.carbsG), fat: fmt.number(values.fatG) }
  const set = (key: keyof typeof fields) => (event: ChangeEvent<HTMLInputElement>) => setFields({ ...fields, [key]: event.target.value })
  async function save(event?: FormEvent) {
    event?.preventDefault()
    if (!valid) return
    setSaving(true)
    await logQuickMacros(store, { date, meal: meal.meal, name: fields.name.trim() || t('food.macros.defaultName'), ...values, favorite })
    onSaved()
  }
  const field = 'h-[52px] w-full shrink-0 rounded-md border border-subtle bg-background px-3 font-display text-2xl font-extrabold tabular-nums text-foreground'
  return (
    <Sheet
      title={t('food.macros.title')}
      description={`${mealLabel} · ${meal.time}`}
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-2">
          <Button variant="primary" size="xl" disabled={!valid || saving} onClick={() => void save()}>
            {t('food.macros.save', { meal: mealLabel })}
          </Button>
          <span className="text-center type-caption text-muted-foreground">{t('food.macros.offline')}</span>
        </div>
      }
    >
      <form onSubmit={(event) => void save(event)} className="flex flex-col gap-3.5">
        <p className="m-0 type-body text-muted-foreground">{t('food.macros.intro')}</p>
        <div className="flex shrink-0 flex-col gap-1.5">
          <label htmlFor={ids.name} className="type-body-strong">
            {t('food.macros.name')} <span className="font-normal text-muted-foreground">{t('food.macros.nameHint')}</span>
          </label>
          <input id={ids.name} value={fields.name} onChange={set('name')} placeholder={t('food.macros.defaultName')} className="h-[52px] shrink-0 rounded-md border border-subtle bg-background px-3.5 type-body-l text-foreground placeholder:text-muted-foreground" />
        </div>
        <div className="flex shrink-0 flex-col gap-1.5">
          <label htmlFor={ids.kcal} className="type-body-strong">
            {t('food.macros.kcal')}
          </label>
          <input id={ids.kcal} inputMode="numeric" value={fields.kcal} onChange={set('kcal')} placeholder={anyMacro ? fmt.number(result.fromMacros) : undefined} className={cn(field, 'h-16 text-4xl')} />
        </div>
        <div className="grid shrink-0 grid-cols-3 gap-2">
          {(
            [
              ['protein', ids.protein, 'food.macros.protein', 'bg-ember'],
              ['carbs', ids.carbs, 'food.macros.carbs', 'bg-data'],
              ['fat', ids.fat, 'food.macros.fat', 'bg-sand'],
            ] as const
          ).map(([key, id, label, dot]) => (
            <div key={key} className="flex min-w-0 flex-col gap-1.5">
              <label htmlFor={id} className="flex items-center gap-1.5 type-caption font-semibold text-foreground">
                <span aria-hidden className={cn('size-2 shrink-0 rounded-pill', dot)} />
                <span className="truncate">{t(label)}</span>
              </label>
              <input id={id} inputMode="decimal" value={fields[key]} onChange={set(key)} className={field} />
            </div>
          ))}
        </div>
        {anyMacro ? (
          <p role="status" className="m-0 rounded-md border border-border bg-surface-2 px-3.5 py-3 type-caption tabular-nums">
            {values.kcal !== null && values.kcal !== result.fromMacros
              ? t('food.macros.check', { fromMacros: result.fromMacros, kcal: values.kcal, ...numbers })
              : t('food.macros.computed', { kcal: result.fromMacros, ...numbers })}
          </p>
        ) : null}
        <label className="flex min-h-touch shrink-0 items-center gap-3 type-body">
          <input type="checkbox" checked={favorite} onChange={(event) => setFavoriteChecked(event.target.checked)} className="size-5 shrink-0 accent-current" />
          {t('food.macros.favorite')}
        </label>
      </form>
    </Sheet>
  )
}

