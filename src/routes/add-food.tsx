import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { AmountSheet, type LeftToday } from '@/components/food/amount-sheet'
import { BarcodeSheet } from '@/components/food/barcode-sheet'
import { BasketBar } from '@/components/food/basket-bar'
import { BasketSheet } from '@/components/food/basket-sheet'
import { CustomFoodSheet } from '@/components/food/custom-food-sheet'
import { portionLabel, sourceKey } from '@/components/food/food-labels'
import { PickRow, PickSection } from '@/components/food/food-pick'
import { logWithUndo } from '@/components/food/meal-actions'
import { MealChip, MealPicker } from '@/components/food/meal-chip'
import { type BasketApi, useBasket } from '@/components/food/use-basket'
import { useMealPhoto } from '@/components/food/use-meal-photo'
import { Sheet } from '@/components/layout/sheet'
import { BackButton } from '@/components/layout/page'
import { Button } from '@/components/ui/button'
import { Icon, type IconName } from '@/components/ui/icons'
import { searchUsda, store, useLocalQuery } from '@/data/app-data'
import { type BasketItem, basketItemFromFood, basketItemFromPortion, itemMacros, logBasket } from '@/data/basket'
import { type Food, foodById, foodsById, saveExternalFood, searchFoods } from '@/data/foods'
import { currentFoodDate, nutritionDay, planFoodId, type TemplateLine } from '@/data/nutrition'
import { favoriteFoods, type Portion, recentPortions, yesterdayMeal } from '@/data/quick-food'
import { foodName, mealName, portionText } from '@/i18n/domain'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import { macrosFor } from '@/nutrition/jim'
import type { MealKey } from '@/nutrition/meals'
import { type ExternalFood, offSearch } from '@/nutrition/off'
import { QuickMacrosSheet } from './meal-quick'
import { kcalText } from './nutrition-format'

// Shto ushqim (V59, SPEC §0.3h, V2-E3-28b; bordet "Ushqimi · Kërko", "Sasia", "Shporta"): kreu me kërkimin, barkodin dhe
// çipin e vaktit; pa shkrim mjetet (Barkodi, Foto, Makrot, Ushqim i ri) dhe Si dje, Plani im, të preferuarat, të fundit,
// secili me "+" te shporta; me shkrim ushqimet e tua (në telefon), USDA pas pushimit dhe Open Food Facts vetëm me prekjen
// "Kërko te produktet e paketuara" (kufi 10 kërkime në minutë, jo gjatë shkrimit). Fletat hapen me `?ndrysho=` (sasia
// `&ushqimi=`, `&redakto=1` nga rishikimi), që butoni mbrapa i Android-it t'i mbyllë; `?barkod=1` hap barkodin, `?q=` mbush kërkimin.
// Shporta ruhet në telefon; shtimi regjistron çdo artikull dhe kthen te Ushqimi me njoftimin "U shtua te <vakti>" (`location.state`).

type Remote = { state: 'idle' } | { state: 'loading' } | { state: 'done'; foods: ExternalFood[] } | { state: 'offline' } | { state: 'error' }

/** USDA pas pushimit të shkrimit; pa internet ose me gabim thuhet qartë. Open Food Facts nuk kalon këtu (V59). */
function useUsdaSearch(query: string): Remote {
  const [remote, setRemote] = useState<Remote>({ state: 'idle' })
  const trimmed = query.trim()
  useEffect(() => {
    if (trimmed.length < 3) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      if (!navigator.onLine) {
        setRemote({ state: 'offline' })
        return
      }
      setRemote({ state: 'loading' })
      searchUsda(trimmed)
        .then((foods) => {
          if (!controller.signal.aborted) setRemote({ state: 'done', foods })
        })
        .catch(() => {
          if (!controller.signal.aborted) setRemote({ state: navigator.onLine ? 'error' : 'offline' })
        })
    }, 450)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [trimmed])
  return trimmed.length < 3 ? { state: 'idle' } : remote
}

/** Open Food Facts: një kërkim për çdo prekje; një tekst tjetër e kthen në gjendjen e parë (rezultati mban tekstin e vet). */
function usePackagedSearch(query: string) {
  const [stored, setStored] = useState<{ query: string; remote: Remote }>({ query: '', remote: { state: 'idle' } })
  const controller = useRef<AbortController | null>(null)
  const trimmed = query.trim()
  const search = () => {
    if (trimmed.length < 2) return
    const set = (remote: Remote) => setStored({ query: trimmed, remote })
    if (!navigator.onLine) return set({ state: 'offline' })
    controller.current?.abort()
    const next = new AbortController()
    controller.current = next
    set({ state: 'loading' })
    offSearch(trimmed, next.signal)
      .then((foods) => {
        if (!next.signal.aborted) set({ state: 'done', foods })
      })
      .catch(() => {
        if (!next.signal.aborted) set({ state: navigator.onLine ? 'error' : 'offline' })
      })
  }
  return { remote: stored.query === trimmed ? stored.remote : ({ state: 'idle' } as Remote), search }
}

/** Ushqimi i jashtëm ruhet (një herë sipas burimit dhe kodit) dhe bëhet artikull me porcionin e tij. */
async function externalItem(food: ExternalFood): Promise<BasketItem | null> {
  const saved = await foodById(store, await saveExternalFood(store, food))
  return saved ? basketItemFromFood(saved) : null
}

const amountOf = (item: BasketItem) => item.grams ?? item.servings ?? 0
const sameFood = (foodId: string) => (item: BasketItem) => item.foodId === foodId
const none = () => false

export function AddFoodPage() {
  const i18n = useI18n()
  const { t, fmt, lang } = i18n
  const { meal: routeMeal = 'lunch' } = useParams() as { meal: MealKey }
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const [pickedMeal, setPickedMeal] = useState<MealKey>(routeMeal)
  const [query, setQuery] = useState(params.get('q') ?? '')
  const [busy, setBusy] = useState(false)
  const basket = useBasket()
  const field = useRef<HTMLInputElement>(null)
  const searchId = useId()
  const fromTool = params.get('barkod') === '1'
  const sheet = params.get('ndrysho') ?? (fromTool ? 'barkodi' : null)
  const foodId = params.get('ushqimi')

  // Dita, vaktet dhe ajo që lexohet nga telefoni; rilexohet pas çdo shkrimi (shtimi te favoritët, regjistrimet).
  const view = useLocalQuery(async () => {
    const now = store.now()
    const date = await currentFoodDate(store, now)
    const day = await nutritionDay(store, date, now)
    const meal = (day.meals.find((entry) => entry.meal === pickedMeal) ?? day.next ?? day.meals[0]).meal
    const [yesterday, favorites, recent, foods] = await Promise.all([yesterdayMeal(store, date, meal), favoriteFoods(store), recentPortions(store, 8), foodsById(store)])
    return { date, day, meal, yesterday, favorites, recent, foods }
  }, [pickedMeal])
  const meal = view?.meal ?? pickedMeal
  const slot = view?.day.meals.find((entry) => entry.meal === meal)
  const photo = useMealPhoto(view?.date ?? '', meal)

  const trimmed = query.trim()
  const searching = trimmed.length > 0
  const local = useLocalQuery(() => searchFoods(store, query, (food) => foodName(t, food)), [query, lang])
  const usda = useUsdaSearch(query)
  const packaged = usePackagedSearch(query)

  useEffect(() => {
    if (!fromTool) field.current?.focus()
    // Vetëm kur hapet ekrani.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const open = (name: string, extra: Record<string, string> = {}) => setParams({ ndrysho: name, ...extra })
  // Kalim nga një fletë te tjetra pa shtuar hyrje në histori; `barkod=1` mbetet, që mbyllja të kthejë te faqja pa hyrë mbrapa.
  const swap = (name: string, extra: Record<string, string> = {}) => setParams({ ...(fromTool ? { barkod: '1' } : {}), ndrysho: name, ...extra }, { replace: true })
  const close = () => (fromTool ? setParams({}, { replace: true }) : navigate(-1))

  const left: LeftToday | null = view?.day.targets
    ? { kcal: view.day.targets.kcal - view.day.totals.kcal, proteinG: view.day.targets.proteinG - view.day.totals.proteinG }
    : null

  async function addPortions(portions: Portion[]) {
    for (const portion of portions) {
      const item = await basketItemFromPortion(store, portion)
      if (item) basket.add(item)
    }
  }

  async function addPlan() {
    for (const line of slot?.template ?? []) {
      const item = await planItem(line)
      if (item) basket.add(item)
    }
  }

  async function planItem(line: TemplateLine) {
    const food = await foodById(store, await planFoodId(store, line.food))
    return food ? basketItemFromFood(food, line.grams) : null
  }

  async function submit() {
    if (busy || !view || basket.items.length === 0) return
    setBusy(true)
    const items = basket.items
    try {
      const { kcal, ids } = await logWithUndo(store, view.date, meal, () => logBasket(store, view.date, meal, items))
      basket.clear()
      navigate('/ushqimi', { replace: true, state: { added: { meal, kcal: Math.round(kcal), ids } } })
    } finally {
      setBusy(false)
    }
  }

  const rowDetail = (portion: string, kcal: number, proteinG: number) => t('foodsearch.detail', { portion, kcal: kcalText(i18n, kcal), protein: fmt.number(Math.round(proteinG)) })

  /** Një rresht nga një porcion i fundit ose i preferuar. */
  const portionRow = (portion: Portion) => {
    const food = view?.foods.get(portion.foodId)
    const text = portionLabel(i18n, { grams: portion.grams, servings: portion.servings, servingG: food?.servingG ?? null, servingLabel: food?.servingLabel ?? null })
    return (
      <PickRow
        key={portion.foodId}
        name={foodName(t, portion)}
        tag={t(sourceKey({ source: food?.source ?? null, sourceId: portion.sourceId }))}
        detail={rowDetail(text, portion.kcal, portion.proteinG)}
        basket={basket}
        match={sameFood(portion.foodId)}
        unit={portion.grams ?? portion.servings ?? 1}
        resolve={() => basketItemFromPortion(store, portion)}
        onOpen={(id) => open('sasia', { ushqimi: id })}
      />
    )
  }

  /** Një rresht nga ushqimet e tua (në telefon). */
  const foodRow = (food: Food) => {
    const item = basketItemFromFood(food)
    const macros = itemMacros(item)
    return (
      <PickRow
        key={food.id}
        name={foodName(t, food)}
        tag={t(sourceKey(food))}
        detail={rowDetail(portionLabel(i18n, item), macros.kcal, macros.proteinG)}
        size="lg"
        basket={basket}
        match={sameFood(food.id)}
        unit={amountOf(item)}
        resolve={async () => item}
        onOpen={(id) => open('sasia', { ushqimi: id })}
      />
    )
  }

  /** Një rresht nga një burim i jashtëm (USDA, Open Food Facts): ruhet kur shtohet ose hapet. */
  const externalRow = (food: ExternalFood) => {
    const grams = food.servingG ?? 100
    const macros = macrosFor(food, grams)
    return (
      <PickRow
        key={`${food.source}-${food.sourceId}`}
        name={food.name}
        tag={food.brand ?? undefined}
        detail={rowDetail(portionLabel(i18n, { grams, servings: null, servingG: food.servingG, servingLabel: food.servingLabel }), macros.kcal, macros.proteinG)}
        size="lg"
        basket={basket}
        match={(item) => item.source === food.source && item.sourceId === food.sourceId}
        unit={grams}
        resolve={() => externalItem(food)}
        onOpen={(id) => open('sasia', { ushqimi: id })}
      />
    )
  }

  const mealLabel = mealName(t, meal)
  const tools: { key: string; icon: IconName; text: string; disabled?: boolean; onClick: () => void }[] = [
    { key: 'barcode', icon: 'barkodi-vija', text: t('foodsearch.tool.barcode'), onClick: () => open('barkodi') },
    { key: 'photo', icon: 'kamera', text: t('foodsearch.tool.photo'), disabled: !view || photo.disabled, onClick: photo.open },
    { key: 'macros', icon: 'laps', text: t('foodsearch.tool.macros'), disabled: !slot, onClick: () => open('makrot') },
    { key: 'new', icon: 'shto', text: t('foodsearch.tool.newFood'), onClick: () => open('i-ri') },
  ]
  const plan = slot && slot.status !== 'done' ? slot.template : []

  return (
    <div className={cn('flex flex-col gap-3.5', basket.items.length > 0 && 'pb-36')}>
      <h1 className="sr-only">{t('foodsearch.title', { meal: mealLabel })}</h1>
      <header className="flex items-center gap-1">
        <BackButton label={t('foodsearch.back')} fallback="/ushqimi" className="-ml-2" />
        <span className="flex h-12 min-w-0 flex-1 items-center gap-2 rounded-md border border-foreground bg-surface pr-1 pl-3">
          <Icon name="kerko" size={18} className="shrink-0 text-muted-foreground" />
          <label htmlFor={searchId} className="sr-only">
            {t('foodsearch.field')}
          </label>
          {/* Pa "×"-in blu të shfletuesit (ngjyrë jashtë tokenave); kërkimi fshihet me butonin e vet. */}
          <input
            id={searchId}
            ref={field}
            type="search"
            autoComplete="off"
            enterKeyHint="search"
            placeholder={t('foodsearch.field')}
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            className="h-11 min-w-0 flex-1 appearance-none bg-transparent text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none [&::-webkit-search-cancel-button]:appearance-none"
          />
          {query ? (
            <button
              type="button"
              aria-label={t('foodsearch.clear')}
              onClick={() => {
                setQuery('')
                field.current?.focus()
              }}
              className="flex size-11 shrink-0 items-center justify-center text-muted-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground"
            >
              <Icon name="mbyll-vrull" size={18} />
            </button>
          ) : null}
        </span>
        <Button variant="outline" size="icon" className="size-12 shrink-0 rounded-md" aria-label={t('foodsearch.barcode')} onClick={() => open('barkodi')}>
          <Icon name="barkodi-vija" size={20} />
        </Button>
      </header>

      <div className="flex items-center justify-between gap-2">
        {slot ? <MealChip meal={meal} time={slot.time} onClick={() => open('vakti')} /> : <span aria-hidden className="h-11" />}
        {searching ? <span className="text-[13px] text-muted-foreground">{t('foodsearch.worksOffline')}</span> : null}
      </div>

      {searching ? (
        <div className="flex flex-col gap-3.5">
          {local === undefined ? null : local.length > 0 ? (
            <PickSection title={t('foodsearch.mine')}>{local.map(foodRow)}</PickSection>
          ) : (
            <p className="type-caption text-muted-foreground">{t('foodsearch.noMine', { query: trimmed })}</p>
          )}
          {usda.state === 'done' && usda.foods.length > 0 ? <PickSection title={t('foodsearch.usda')}>{usda.foods.map(externalRow)}</PickSection> : null}
          {usda.state === 'error' ? <p className="type-caption text-muted-foreground">{t('foodsearch.usdaError')}</p> : null}
          {packaged.remote.state === 'done' && packaged.remote.foods.length > 0 ? (
            <PickSection title={t('foodsearch.packaged.results')}>{packaged.remote.foods.map(externalRow)}</PickSection>
          ) : (
            <PackagedRow query={trimmed} state={packaged.remote.state} onSearch={packaged.search} />
          )}
        </div>
      ) : view === undefined ? (
        <div aria-hidden className="h-72 rounded-lg bg-surface" />
      ) : (
        <>
          <div role="group" aria-label={t('foodsearch.tools')} className="grid grid-cols-4 gap-2">
            {tools.map((tool) => (
              <button
                key={tool.key}
                type="button"
                disabled={tool.disabled}
                onClick={tool.onClick}
                className="flex min-h-16 min-w-0 flex-col items-center justify-center gap-1.5 rounded-lg border border-surface-border bg-surface px-1 text-[13px] leading-none font-semibold text-foreground disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
              >
                <Icon name={tool.icon} size={22} className="text-muted-foreground" />
                {tool.text}
              </button>
            ))}
          </div>
          {photo.input}
          {view.yesterday ? (
            <PickSection title={t('foodsearch.yesterday', { meal: mealLabel })} onAddAll={() => void addPortions(view.yesterday!.items)} addAllLabel={t('foodsearch.addAllLabel', { section: t('foodsearch.yesterday', { meal: mealLabel }) })}>
              <PickRow
                name={view.yesterday.items.map((item) => foodName(t, item)).join(', ')}
                detail={t('foodsearch.yesterdayRow', { count: view.yesterday.items.length, kcal: kcalText(i18n, view.yesterday.kcal), protein: fmt.number(Math.round(view.yesterday.items.reduce((sum, item) => sum + item.proteinG, 0))) })}
                basket={basket}
                match={none}
                unit={0}
                resolve={async () => null}
                onOpen={() => undefined}
                onAdd={() => void addPortions(view.yesterday!.items)}
                addLabel={t('foodsearch.addYesterday', { meal: mealLabel })}
              />
            </PickSection>
          ) : null}
          {plan.length > 0 ? (
            <PickSection title={t('foodsearch.plan', { meal: mealLabel })} onAddAll={() => void addPlan()} addAllLabel={t('foodsearch.addAllLabel', { section: t('foodsearch.plan', { meal: mealLabel }) })}>
              {plan.map((line, index) => (
                <PickRow
                  key={`${line.food}-${index}`}
                  name={foodName(t, { name: line.name, sourceId: line.sourceId })}
                  detail={rowDetail(portionText(t, fmt, line.portion), line.kcal, line.proteinG)}
                  basket={basket}
                  match={(item) => (line.food.startsWith('food:') ? item.foodId === line.food.slice('food:'.length) : item.sourceId === line.sourceId)}
                  unit={line.grams}
                  resolve={() => planItem(line)}
                  onOpen={(id) => open('sasia', { ushqimi: id })}
                />
              ))}
            </PickSection>
          ) : null}
          {view.favorites.length > 0 ? <PickSection title={t('foodsearch.favorites')}>{view.favorites.map(portionRow)}</PickSection> : null}
          {view.recent.length > 0 ? <PickSection title={t('foodsearch.recent')}>{view.recent.map(portionRow)}</PickSection> : null}
        </>
      )}

      {basket.items.length > 0 ? (
        <BasketBar items={basket.items} meal={meal} busy={busy} onOpen={() => open('shporta')} onRemove={basket.remove} onSubmit={() => void submit()} />
      ) : null}

      {sheet === 'sasia' && foodId ? <AmountEntry key={foodId} foodId={foodId} edit={params.get('redakto') === '1'} basket={basket} left={left} onClose={close} /> : null}
      {sheet === 'shporta' && view ? (
        <BasketSheet
          items={basket.items}
          day={view.day}
          meal={meal}
          time={slot?.time ?? ''}
          busy={busy}
          onClose={close}
          onChangeMeal={() => open('vakti')}
          onEdit={(id) => open('sasia', { ushqimi: id, redakto: '1' })}
          onRemove={(id) => {
            basket.remove(id)
            if (basket.items.length <= 1) close()
          }}
          onSubmit={() => void submit()}
          onClear={() => {
            basket.clear()
            close()
          }}
        />
      ) : null}
      {sheet === 'vakti' && view ? (
        <MealPicker
          meals={view.day.meals.map((entry) => ({ meal: entry.meal, time: entry.time }))}
          selected={meal}
          onPick={(next) => {
            setPickedMeal(next)
            close()
          }}
          onClose={close}
        />
      ) : null}
      {sheet === 'i-ri' ? <CustomFoodSheet initialName={trimmed} onClose={close} onCreated={(id) => swap('sasia', { ushqimi: id })} /> : null}
      {sheet === 'barkodi' ? <BarcodeSheet onClose={close} onFound={(id) => swap('sasia', { ushqimi: id })} onMissing={() => swap('i-ri')} /> : null}
      {sheet === 'makrot' && view && slot ? <QuickMacrosSheet date={view.date} meal={slot} onClose={close} onSaved={() => navigate('/ushqimi', { replace: true })} /> : null}
    </div>
  )
}

/** "Kërko “…” te produktet e paketuara" me gjendjet e Open Food Facts: kërkon vetëm kur preket. */
function PackagedRow({ query, state, onSearch }: { query: string; state: Remote['state']; onSearch: () => void }) {
  const { t } = useI18n()
  const note = state === 'loading' ? 'foodsearch.packaged.loading' : state === 'offline' ? 'foodsearch.packaged.offline' : state === 'error' ? 'foodsearch.packaged.error' : state === 'done' ? 'foodsearch.packaged.empty' : null
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={state === 'loading'}
        onClick={onSearch}
        className="flex min-h-14 items-center gap-3 rounded-md border border-dashed border-subtle px-3 text-left disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
      >
        <Icon name="kerko" size={20} className="shrink-0 text-muted-foreground" />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="type-body-strong">{t('foodsearch.packaged', { query })}</span>
          <span className="text-[13px] text-muted-foreground">{t('foodsearch.packagedDetail')}</span>
        </span>
      </button>
      {note ? (
        <p role="status" className="type-caption text-muted-foreground">
          {t(note, { query })}
        </p>
      ) : null}
    </div>
  )
}

/** Fleta e sasisë: ushqimi nga baza (shtim) ose artikulli i shportës (ndryshim nga rishikimi). */
function AmountEntry({ foodId, edit, basket, left, onClose }: { foodId: string; edit: boolean; basket: BasketApi; left: LeftToday | null; onClose: () => void }) {
  const { t } = useI18n()
  const food = useLocalQuery(() => foodById(store, foodId), [foodId])
  const existing = basket.items.find((item) => item.foodId === foodId)
  const item = useMemo(() => (edit ? existing : food ? basketItemFromFood(food) : null), [edit, existing, food])
  if (edit ? !existing : food === undefined) return null
  if (!item) {
    return (
      <Sheet title={t('foodsearch.amount.title')} onClose={onClose}>
        <p className="type-caption text-muted-foreground">{t('foodsearch.amount.missing')}</p>
      </Sheet>
    )
  }
  return (
    <AmountSheet
      item={item}
      mode={edit ? 'edit' : 'add'}
      left={left}
      onClose={onClose}
      onSubmit={(result) => {
        if (edit) basket.setAmount(foodId, result.grams !== null ? { grams: result.grams } : { servings: result.servings ?? 1 })
        else basket.add(result)
        onClose()
      }}
    />
  )
}
