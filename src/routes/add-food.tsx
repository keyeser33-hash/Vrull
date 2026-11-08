import { useEffect, useId, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { ValueStepper } from '@/components/forms/value-stepper'
import { Group, Row } from '@/components/layout/list-group'
import { BackHeader } from '@/components/layout/page'
import { Sheet } from '@/components/layout/sheet'
import { Button } from '@/components/ui/button'
import { inputClass } from '@/components/ui/field-styles'
import { Icon } from '@/components/ui/icons'
import { searchUsda, store, useLocalQuery } from '@/data/app-data'
import { localDate } from '@/lib/calendar'
import { createCustomFood, type Food, foodById, recentFoods, saveExternalFood, searchFoods } from '@/data/foods'
import { logFood } from '@/data/nutrition'
import type { I18n, MessageKey } from '@/i18n'
import { foodName, mealName } from '@/i18n/domain'
import { useI18n } from '@/i18n/use-i18n'
import { macrosFor } from '@/nutrition/jim'
import type { MealKey } from '@/nutrition/meals'
import { type ExternalFood, offProduct, offSearch } from '@/nutrition/off'
import { canScanBarcode, scanBarcode } from '@/lib/barcode-native'
import { cn } from '@/lib/cn'
import { gramsText, macrosLine, parseGrams } from './nutrition-format'

// Shto ushqim te një vakt (TH-15), varianti A (07.11.2026; referencat nga Mobbin: Fitbit, Yazio,
// Garmin): kërkimi me butonin e barkodit; pa kërkim, ushqimet e përdorura së fundi; me kërkim,
// ushqimet e tua dhe pastaj Open Food Facts. Ushqimi hapet në fletën e sasisë (?ushqimi=id).
// Tekstet nga katalogu ('food.*'); ushqimet e shabllonit në gjuhën e app-it (`foodName`), ato të
// Open Food Facts, USDA dhe të përdoruesit siç janë.

/** Burimet e jashtme, me emrin e tyre në të dyja gjuhët. */
const OPEN_FOOD_FACTS = 'Open Food Facts'
const USDA = 'USDA'

/** "Ferrero · 539 kcal / 100 g". */
const per100 = (i18n: I18n, food: { kcal: number; brand?: string | null }) =>
  [food.brand, `${i18n.fmt.unit(Math.round(food.kcal), 'kcal')} / ${i18n.fmt.unit(100, 'g')}`].filter(Boolean).join(' · ')

type Remote = { state: 'idle' } | { state: 'loading' } | { state: 'done'; foods: ExternalFood[] } | { state: 'offline' } | { state: 'error' }

/** Kërkimi në një burim të jashtëm pasi ndalon shkrimi; pa internet thuhet qartë. */
function useRemoteSearch(query: string, search: (query: string, signal: AbortSignal) => Promise<ExternalFood[]>): Remote {
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
      search(trimmed, controller.signal)
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
    // `search` është një funksion i qëndrueshëm i modulit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmed])
  return trimmed.length < 3 ? { state: 'idle' } : remote
}

const usdaSearch = (query: string) => searchUsda(query)

export function AddFoodPage() {
  const i18n = useI18n()
  const { t, lang } = i18n
  const { meal = 'lunch' } = useParams() as { meal: MealKey }
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [added, setAdded] = useState<string | null>(null)
  const searchId = useId()
  const recent = useLocalQuery(() => recentFoods(store), [])
  // Ushqimet e shabllonit gjenden edhe me emrin që sheh përdoruesi (anglisht).
  const local = useLocalQuery(() => searchFoods(store, query, (food) => foodName(t, food)), [query, lang])
  const remote = useRemoteSearch(query, offSearch)
  const usda = useRemoteSearch(query, usdaSearch)
  const sheet = params.get('ndrysho')
  const foodId = params.get('ushqimi')
  const open = (name: string, extra: Record<string, string> = {}) => setParams({ ndrysho: name, ...extra })
  const close = () => navigate(-1)

  async function openExternal(food: ExternalFood) {
    const id = await saveExternalFood(store, food)
    open('sasia', { ushqimi: id })
  }

  const searching = query.trim().length > 0
  return (
    <div className="flex flex-col gap-5">
      <BackHeader title={t('food.addTo', { meal: mealName(t, meal) })} back={t('food.backToFood')} fallback="/ushqimi" />

      <div className="flex gap-2">
        <label htmlFor={searchId} className="sr-only">
          {t('food.search')}
        </label>
        {/* Pa "×"-in blu të shfletuesit (ngjyrë jashtë tokenave); kërkimi fshihet me tastierë. */}
        <input
          id={searchId}
          type="search"
          autoComplete="off"
          placeholder={t('food.search')}
          value={query}
          onChange={(event) => (setQuery(event.currentTarget.value), setAdded(null))}
          className={cn(inputClass, 'min-w-0 flex-1 appearance-none [&::-webkit-search-cancel-button]:appearance-none')}
        />
        <Button variant="outline" size="icon" aria-label={t('food.searchBarcode')} onClick={() => open('barkodi')}>
          <Icon name="barkodi" size={20} />
        </Button>
      </div>

      {added ? (
        <p role="status" className="-mt-2 type-caption text-success">
          {t('food.added', { food: added })}
        </p>
      ) : null}

      {searching ? (
        <>
          {local && local.length > 0 ? (
            <Group title={t('food.yours')}>
              {local.map((food) => (
                <Row key={food.id} label={foodName(t, food)} detail={per100(i18n, food)} onClick={() => open('sasia', { ushqimi: food.id })} />
              ))}
            </Group>
          ) : null}
          <RemoteResults source={OPEN_FOOD_FACTS} remote={remote} onPick={(food) => void openExternal(food)} />
          <RemoteResults source={USDA} remote={usda} onPick={(food) => void openExternal(food)} quiet />
        </>
      ) : recent === undefined ? (
        <div aria-hidden className="h-48 rounded-lg bg-surface" />
      ) : recent.length > 0 ? (
        <Group title={t('food.recent')}>
          {recent.map((food) => (
            <Row key={food.id} label={foodName(t, food)} detail={per100(i18n, food)} onClick={() => open('sasia', { ushqimi: food.id })} />
          ))}
        </Group>
      ) : (
        <p className="type-caption text-muted-foreground">{t('food.recentEmpty')}</p>
      )}

      <Button variant="outline" className="w-full" onClick={() => open('i-ri')}>
        <Icon name="shto" size={20} />
        {t('food.new')}
      </Button>

      {sheet === 'sasia' && foodId ? (
        <AmountSheet
          foodId={foodId}
          meal={meal}
          onClose={close}
          onAdded={(text) => {
            setAdded(text)
            close()
          }}
        />
      ) : null}
      {sheet === 'i-ri' ? (
        <CustomFoodSheet
          initialName={query.trim()}
          onClose={close}
          onCreated={(id) => setParams({ ndrysho: 'sasia', ushqimi: id }, { replace: true })}
        />
      ) : null}
      {sheet === 'barkodi' ? (
        <BarcodeSheet
          onClose={close}
          onFound={(id) => setParams({ ndrysho: 'sasia', ushqimi: id }, { replace: true })}
          onMissing={() => setParams({ ndrysho: 'i-ri' }, { replace: true })}
        />
      ) : null}
    </div>
  )
}

/** Rezultatet e një burimi të jashtëm. `quiet`: pa mesazhe për gjendjet (burimi i dytë). */
function RemoteResults({ source, remote, onPick, quiet = false }: { source: string; remote: Remote; onPick: (food: ExternalFood) => void; quiet?: boolean }) {
  const i18n = useI18n()
  const { t } = i18n
  const note = (text: string) => (quiet ? null : <p className="type-caption text-muted-foreground">{text}</p>)
  if (remote.state === 'idle') return note(t('food.remote.idle', { source }))
  if (remote.state === 'loading') return note(t('food.remote.loading', { source }))
  if (remote.state === 'offline') return note(t('food.remote.offline'))
  if (remote.state === 'error') return <p className="type-caption text-muted-foreground">{t('food.remote.error', { source })}</p>
  if (remote.foods.length === 0) return note(t('food.remote.empty', { source }))
  return (
    <Group title={source === USDA ? t('food.remote.usda') : source}>
      {remote.foods.map((food) => (
        <Row key={`${food.source}-${food.sourceId}`} label={food.name} detail={per100(i18n, food)} onClick={() => onPick(food)} />
      ))}
    </Group>
  )
}

function AmountSheet({ foodId, meal, onClose, onAdded }: { foodId: string; meal: MealKey; onClose: () => void; onAdded: (text: string) => void }) {
  const { t } = useI18n()
  const food = useLocalQuery(() => foodById(store, foodId), [foodId])
  if (food === undefined) return null
  if (food === null) {
    return (
      <Sheet title={t('food.foodTitle')} onClose={onClose}>
        <p className="type-caption text-muted-foreground">{t('food.missing')}</p>
      </Sheet>
    )
  }
  return <AmountForm food={food} meal={meal} onClose={onClose} onAdded={onAdded} />
}

function AmountForm({ food, meal, onClose, onAdded }: { food: Food; meal: MealKey; onClose: () => void; onAdded: (text: string) => void }) {
  const i18n = useI18n()
  const { t, fmt } = i18n
  const [amount, setAmount] = useState(food.servingG ?? 100)
  const [busy, setBusy] = useState(false)
  const macros = macrosFor(food, amount)
  const step = amount < 50 ? 5 : 10
  const name = foodName(t, food)
  async function add() {
    setBusy(true)
    await logFood(store, { date: localDate(new Date()), meal, foodId: food.id, grams: amount })
    onAdded(`${name}, ${gramsText(i18n, amount)}`)
  }
  return (
    <Sheet
      title={name}
      description={per100(i18n, food)}
      onClose={onClose}
      footer={
        <Button variant="primary" size="xl" disabled={busy} onClick={() => void add()}>
          {t('food.addTo', { meal: mealName(t, meal) })}
        </Button>
      }
    >
      <ValueStepper
        label={t('food.amount')}
        hideLabel
        variant="hero"
        text={fmt.number(amount, { maxDigits: 1 })}
        unit="g"
        inputMode="decimal"
        minusLabel={t('food.less', { step })}
        plusLabel={t('food.more', { step })}
        onMinus={() => setAmount((value) => Math.max(1, value - step))}
        onPlus={() => setAmount((value) => Math.min(2000, value + step))}
        onCommit={(text) => {
          const value = parseGrams(text)
          if (value !== null && value <= 2000) setAmount(Math.round(value * 10) / 10)
        }}
      />
      {food.servingG ? (
        <Button variant="outline" onClick={() => setAmount(food.servingG!)}>
          {t('food.serving', { serving: food.servingLabel ?? gramsText(i18n, food.servingG) })}
        </Button>
      ) : null}
      <p className="text-center type-caption text-muted-foreground tabular-nums">
        <b className="font-semibold text-foreground">{fmt.unit(Math.round(macros.kcal), 'kcal')}</b> · {macrosLine(i18n, macros)}
      </p>
    </Sheet>
  )
}

const FIELDS = [
  { key: 'kcal', label: 'food.field.kcal' },
  { key: 'proteinG', label: 'food.field.protein' },
  { key: 'carbsG', label: 'food.field.carbs' },
  { key: 'fatG', label: 'food.field.fat' },
] as const satisfies readonly { key: string; label: MessageKey }[]

type CustomProblem = 'food.error.name' | 'food.error.numbers' | 'food.error.range' | 'food.error.serving'

function CustomFoodSheet({ initialName, onClose, onCreated }: { initialName: string; onClose: () => void; onCreated: (id: string) => void }) {
  const { t } = useI18n()
  const [name, setName] = useState(initialName)
  const [values, setValues] = useState<Record<(typeof FIELDS)[number]['key'], string>>({ kcal: '', proteinG: '', carbsG: '', fatG: '' })
  const [serving, setServing] = useState('')
  const [problem, setProblem] = useState<CustomProblem | null>(null)
  const nameId = useId()
  const servingId = useId()
  const parse = (text: string) => (text.trim() === '' ? Number.NaN : Number(text.trim().replace(',', '.')))

  async function save() {
    if (!name.trim()) return setProblem('food.error.name')
    const numbers = Object.fromEntries(FIELDS.map((field) => [field.key, parse(values[field.key])])) as Record<(typeof FIELDS)[number]['key'], number>
    if (Object.values(numbers).some((value) => !Number.isFinite(value) || value < 0)) return setProblem('food.error.numbers')
    if (numbers.kcal > 900 || numbers.proteinG + numbers.carbsG + numbers.fatG > 100) return setProblem('food.error.range')
    const servingG = serving.trim() === '' ? null : parseGrams(serving)
    if (serving.trim() !== '' && servingG === null) return setProblem('food.error.serving')
    const id = await createCustomFood(store, { name, ...numbers, servingG })
    onCreated(id)
  }

  return (
    <Sheet
      title={t('food.new')}
      onClose={onClose}
      footer={
        <Button variant="primary" size="xl" onClick={() => void save()}>
          {t('food.saveFood')}
        </Button>
      }
    >
      <label htmlFor={nameId} className="text-sm leading-5 font-medium">
        {t('food.name')}
      </label>
      <input id={nameId} value={name} maxLength={120} autoComplete="off" onChange={(event) => (setName(event.currentTarget.value), setProblem(null))} className={inputClass} />
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm leading-5 font-semibold">{t('food.per100')}</legend>
        <div className="grid grid-cols-2 gap-2">
          {FIELDS.map((field) => (
            <NumberInput key={field.key} label={t(field.label)} value={values[field.key]} onChange={(value) => (setValues((current) => ({ ...current, [field.key]: value })), setProblem(null))} />
          ))}
        </div>
      </fieldset>
      <label htmlFor={servingId} className="text-sm leading-5 font-medium">
        {t('food.servingField')}
      </label>
      <input id={servingId} inputMode="decimal" autoComplete="off" placeholder={t('food.noServing')} value={serving} onChange={(event) => setServing(event.currentTarget.value)} className={inputClass} />
      {problem ? (
        <p role="alert" className="type-caption text-danger">
          {t(problem)}
        </p>
      ) : null}
    </Sheet>
  )
}

function NumberInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm leading-5 font-medium">
        {label}
      </label>
      <input id={id} inputMode="decimal" autoComplete="off" value={value} onChange={(event) => onChange(event.currentTarget.value)} className={inputClass} />
    </div>
  )
}

type BarcodeState = 'idle' | 'busy' | 'missing' | 'offline' | 'error' | 'installing' | 'scan-error'

const BARCODE_MESSAGE: Record<BarcodeState, MessageKey | null> = {
  idle: null,
  busy: null,
  missing: 'food.barcode.missing',
  offline: 'food.barcode.offline',
  error: 'food.barcode.error',
  installing: 'food.barcode.installing',
  'scan-error': 'food.barcode.scanError',
}

function BarcodeSheet({ onClose, onFound, onMissing }: { onClose: () => void; onFound: (id: string) => void; onMissing: () => void }) {
  const { t } = useI18n()
  const [code, setCode] = useState('')
  const [state, setState] = useState<BarcodeState>('idle')
  const codeId = useId()
  async function scan() {
    setState('busy')
    const result = await scanBarcode()
    if (result.state === 'found') {
      setCode(result.code)
      return lookUp(result.code)
    }
    setState(result.state === 'cancelled' ? 'idle' : result.state === 'installing' ? 'installing' : 'scan-error')
  }
  async function lookUp(scanned?: string) {
    const value = (scanned ?? code).replace(/\D/g, '')
    if (value.length < 8) return setState('error')
    if (!navigator.onLine) return setState('offline')
    setState('busy')
    try {
      const food = await offProduct(value)
      if (!food) return setState('missing')
      onFound(await saveExternalFood(store, food))
    } catch {
      setState(navigator.onLine ? 'error' : 'offline')
    }
  }
  const message = BARCODE_MESSAGE[state]
  return (
    <Sheet title={t('food.barcode')} onClose={onClose}>
      {canScanBarcode() ? (
        <Button variant="outline" size="xl" disabled={state === 'busy'} onClick={() => void scan()}>
          <Icon name="barkodi" size={22} />
          {t('food.scan')}
        </Button>
      ) : null}
      <label htmlFor={codeId} className="text-sm leading-5 font-medium">
        {canScanBarcode() ? t('food.digitsOr') : t('food.digits')}
      </label>
      <input
        id={codeId}
        inputMode="numeric"
        autoComplete="off"
        value={code}
        aria-invalid={state === 'error' ? true : undefined}
        onChange={(event) => (setCode(event.currentTarget.value), setState('idle'))}
        onKeyDown={(event) => {
          if (event.key === 'Enter') void lookUp()
        }}
        className={inputClass}
      />
      {message ? (
        <p role="alert" className={cn('type-caption', state === 'error' || state === 'scan-error' ? 'text-danger' : 'text-muted-foreground')}>
          {t(message)}
        </p>
      ) : null}
      {state === 'missing' ? (
        <Button variant="outline" onClick={onMissing}>
          {t('food.addAsNew')}
        </Button>
      ) : null}
      <Button variant="primary" size="lg" disabled={state === 'busy'} onClick={() => void lookUp()}>
        {state === 'busy' ? t('food.searching') : t('food.find')}
      </Button>
    </Sheet>
  )
}
