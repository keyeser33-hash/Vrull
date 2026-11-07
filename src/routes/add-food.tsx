import { useEffect, useId, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { ValueStepper } from '@/components/forms/value-stepper'
import { Group, Row } from '@/components/layout/list-group'
import { BackButton } from '@/components/layout/page'
import { Sheet } from '@/components/layout/sheet'
import { Button } from '@/components/ui/button'
import { inputClass } from '@/components/ui/field-styles'
import { Icon } from '@/components/ui/icons'
import { store, useLocalQuery } from '@/data/app-data'
import { localDate } from '@/data/dates'
import { createCustomFood, type Food, foodById, recentFoods, saveExternalFood, searchFoods } from '@/data/foods'
import { logFood } from '@/data/nutrition'
import { macrosFor } from '@/nutrition/jim'
import { MEAL_LABEL, type MealKey } from '@/nutrition/meals'
import { type ExternalFood, offProduct, offSearch } from '@/nutrition/off'
import { cn } from '@/lib/cn'
import { grams, kcal, macrosLine } from './nutrition-format'

// Shto ushqim te një vakt (TH-15), varianti A (07.11.2026; referencat nga Mobbin: Fitbit, Yazio,
// Garmin): kërkimi me butonin e barkodit; pa kërkim, ushqimet e përdorura së fundi; me kërkim,
// ushqimet e tua dhe pastaj Open Food Facts. Ushqimi hapet në fletën e sasisë (?ushqimi=id).

const per100 = (food: { kcal: number; brand?: string | null }) => [food.brand, `${kcal(food.kcal)} kcal / 100 g`].filter(Boolean).join(' · ')

type Remote = { state: 'idle' } | { state: 'loading' } | { state: 'done'; foods: ExternalFood[] } | { state: 'offline' } | { state: 'error' }

/** Kërkimi te Open Food Facts pasi ndalon shkrimi; pa internet thuhet qartë. */
function useOffSearch(query: string): Remote {
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
      offSearch(trimmed, controller.signal)
        .then((foods) => setRemote({ state: 'done', foods }))
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

export function AddFoodPage() {
  const { meal = 'lunch' } = useParams() as { meal: MealKey }
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [added, setAdded] = useState<string | null>(null)
  const searchId = useId()
  const recent = useLocalQuery(() => recentFoods(store), [])
  const local = useLocalQuery(() => searchFoods(store, query), [query])
  const remote = useOffSearch(query)
  const sheet = params.get('ndrysho')
  const foodId = params.get('ushqimi')
  const open = (name: string, extra: Record<string, string> = {}) => setParams({ ndrysho: name, ...extra })
  const close = () => navigate(-1)
  const label = MEAL_LABEL[meal] ?? 'Vakti'

  async function openExternal(food: ExternalFood) {
    const id = await saveExternalFood(store, food)
    open('sasia', { ushqimi: id })
  }

  const searching = query.trim().length > 0
  return (
    <div className="flex flex-col gap-5">
      <header className="flex min-h-11 items-center">
        <BackButton label="Kthehu te ushqimi" />
      </header>
      <h1 className="text-3xl leading-9 font-bold tracking-[-0.025em]">Shto te {label}</h1>

      <div className="flex gap-2">
        <label htmlFor={searchId} className="sr-only">
          Kërko ushqimin
        </label>
        <input
          id={searchId}
          type="search"
          autoComplete="off"
          placeholder="Kërko ushqimin"
          value={query}
          onChange={(event) => (setQuery(event.currentTarget.value), setAdded(null))}
          className={cn(inputClass, 'min-w-0 flex-1 appearance-none')}
        />
        <Button variant="outline" size="icon" aria-label="Kërko me barkod" onClick={() => open('barkodi')}>
          <Icon name="barkodi" size={20} />
        </Button>
      </div>

      {added ? (
        <p role="status" className="-mt-2 text-sm leading-5 text-success">
          U shtua: {added}
        </p>
      ) : null}

      {searching ? (
        <>
          {local && local.length > 0 ? (
            <Group title="Ushqimet e tua">
              {local.map((food) => (
                <Row key={food.id} label={food.name} detail={per100(food)} onClick={() => open('sasia', { ushqimi: food.id })} />
              ))}
            </Group>
          ) : null}
          <RemoteResults remote={remote} onPick={(food) => void openExternal(food)} />
        </>
      ) : recent === undefined ? (
        <div aria-hidden className="h-48 rounded-xl bg-skeleton" />
      ) : recent.length > 0 ? (
        <Group title="Të përdorura së fundi">
          {recent.map((food) => (
            <Row key={food.id} label={food.name} detail={per100(food)} onClick={() => open('sasia', { ushqimi: food.id })} />
          ))}
        </Group>
      ) : (
        <p className="text-sm leading-5 text-muted-foreground">Ushqimet që regjistron dalin këtu, edhe pa internet.</p>
      )}

      <Button variant="outline" className="w-full" onClick={() => open('i-ri')}>
        <Icon name="shto" size={20} />
        Ushqim i ri
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

function RemoteResults({ remote, onPick }: { remote: Remote; onPick: (food: ExternalFood) => void }) {
  if (remote.state === 'idle') return <p className="text-sm leading-5 text-muted-foreground">Shkruaj të paktën 3 shkronja për të kërkuar te Open Food Facts.</p>
  if (remote.state === 'loading') return <p className="text-sm leading-5 text-muted-foreground">Po kërkohet te Open Food Facts</p>
  if (remote.state === 'offline') return <p className="text-sm leading-5 text-muted-foreground">Pa internet. Dalin vetëm ushqimet e tua.</p>
  if (remote.state === 'error') return <p className="text-sm leading-5 text-muted-foreground">Open Food Facts nuk po përgjigjet. Provo përsëri pas pak.</p>
  if (remote.foods.length === 0) return <p className="text-sm leading-5 text-muted-foreground">Asnjë produkt me këtë emër te Open Food Facts.</p>
  return (
    <Group title="Open Food Facts">
      {remote.foods.map((food) => (
        <Row key={food.sourceId} label={food.name} detail={per100(food)} onClick={() => onPick(food)} />
      ))}
    </Group>
  )
}

function AmountSheet({ foodId, meal, onClose, onAdded }: { foodId: string; meal: MealKey; onClose: () => void; onAdded: (text: string) => void }) {
  const food = useLocalQuery(() => foodById(store, foodId), [foodId])
  if (food === undefined) return null
  if (food === null) {
    return (
      <Sheet title="Ushqimi" onClose={onClose}>
        <p className="text-sm leading-5 text-muted-foreground">Ky ushqim nuk gjendet më.</p>
      </Sheet>
    )
  }
  return <AmountForm food={food} meal={meal} onClose={onClose} onAdded={onAdded} />
}

function AmountForm({ food, meal, onClose, onAdded }: { food: Food; meal: MealKey; onClose: () => void; onAdded: (text: string) => void }) {
  const [amount, setAmount] = useState(food.servingG ?? 100)
  const [busy, setBusy] = useState(false)
  const macros = macrosFor(food, amount)
  const step = amount < 50 ? 5 : 10
  async function add() {
    setBusy(true)
    await logFood(store, { date: localDate(new Date()), meal, foodId: food.id, grams: amount })
    onAdded(`${food.name}, ${grams(amount)}`)
  }
  return (
    <Sheet title={food.name} onClose={onClose}>
      <p className="text-sm leading-5 text-muted-foreground">{per100(food)}</p>
      <ValueStepper
        label="Sasia"
        hideLabel
        variant="hero"
        text={String(amount).replace('.', ',')}
        unit="g"
        inputMode="decimal"
        minusLabel={`${step} g më pak`}
        plusLabel={`${step} g më shumë`}
        onMinus={() => setAmount((value) => Math.max(1, value - step))}
        onPlus={() => setAmount((value) => Math.min(2000, value + step))}
        onCommit={(text) => {
          const value = Number(text.replace(',', '.'))
          if (Number.isFinite(value) && value > 0 && value <= 2000) setAmount(Math.round(value * 10) / 10)
        }}
      />
      {food.servingG ? (
        <Button variant="outline" onClick={() => setAmount(food.servingG!)}>
          1 porcion{food.servingLabel ? ` (${food.servingLabel})` : ` (${grams(food.servingG)})`}
        </Button>
      ) : null}
      <p className="text-center text-sm leading-5 text-muted-foreground tabular-nums">
        <b className="font-semibold text-foreground">{kcal(macros.kcal)} kcal</b> · {macrosLine(macros)}
      </p>
      <Button variant="brand" size="xl" disabled={busy} onClick={() => void add()}>
        Shto te {MEAL_LABEL[meal]}
      </Button>
    </Sheet>
  )
}

const FIELDS = [
  { key: 'kcal', label: 'Kcal' },
  { key: 'proteinG', label: 'Proteina, g' },
  { key: 'carbsG', label: 'Karbohidrate, g' },
  { key: 'fatG', label: 'Yndyrë, g' },
] as const

function CustomFoodSheet({ initialName, onClose, onCreated }: { initialName: string; onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState(initialName)
  const [values, setValues] = useState<Record<(typeof FIELDS)[number]['key'], string>>({ kcal: '', proteinG: '', carbsG: '', fatG: '' })
  const [serving, setServing] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const nameId = useId()
  const servingId = useId()
  const parse = (text: string) => (text.trim() === '' ? Number.NaN : Number(text.trim().replace(',', '.')))

  async function save() {
    if (!name.trim()) return setProblem('Shkruaj emrin e ushqimit.')
    const numbers = Object.fromEntries(FIELDS.map((field) => [field.key, parse(values[field.key])])) as Record<(typeof FIELDS)[number]['key'], number>
    if (Object.values(numbers).some((value) => !Number.isFinite(value) || value < 0)) return setProblem('Shkruaj kcal dhe makrot për 100 g, si numra.')
    if (numbers.kcal > 900 || numbers.proteinG + numbers.carbsG + numbers.fatG > 100) return setProblem('Vlerat janë për 100 g: kcal deri në 900 dhe makrot bashkë deri në 100 g.')
    const servingG = serving.trim() === '' ? null : parse(serving)
    if (servingG !== null && (!Number.isFinite(servingG) || servingG <= 0)) return setProblem('Porcioni duhet të jetë në gramë, ose bosh.')
    const id = await createCustomFood(store, { name, ...numbers, servingG })
    onCreated(id)
  }

  return (
    <Sheet title="Ushqim i ri" onClose={onClose}>
      <label htmlFor={nameId} className="text-sm leading-5 font-medium">
        Emri
      </label>
      <input id={nameId} value={name} maxLength={120} autoComplete="off" onChange={(event) => (setName(event.currentTarget.value), setProblem(null))} className={inputClass} />
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm leading-5 font-semibold">Për 100 g</legend>
        <div className="grid grid-cols-2 gap-2">
          {FIELDS.map((field) => (
            <NumberInput key={field.key} label={field.label} value={values[field.key]} onChange={(value) => (setValues((current) => ({ ...current, [field.key]: value })), setProblem(null))} />
          ))}
        </div>
      </fieldset>
      <label htmlFor={servingId} className="text-sm leading-5 font-medium">
        Një porcion, g
      </label>
      <input id={servingId} inputMode="decimal" autoComplete="off" placeholder="pa porcion" value={serving} onChange={(event) => setServing(event.currentTarget.value)} className={inputClass} />
      {problem ? (
        <p role="alert" className="text-sm leading-5 text-destructive">
          {problem}
        </p>
      ) : null}
      <Button onClick={() => void save()}>Ruaj ushqimin</Button>
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

function BarcodeSheet({ onClose, onFound, onMissing }: { onClose: () => void; onFound: (id: string) => void; onMissing: () => void }) {
  const [code, setCode] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'missing' | 'offline' | 'error'>('idle')
  const codeId = useId()
  async function lookUp() {
    const value = code.replace(/\D/g, '')
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
  const message = {
    idle: null,
    busy: null,
    missing: 'Ky kod nuk gjendet te Open Food Facts. Mund ta shtosh si ushqim të ri.',
    offline: 'Pa internet. Barkodi kërkohet te Open Food Facts kur të ketë lidhje.',
    error: 'Shkruaj të gjitha shifrat e barkodit (8 deri në 14).',
  }[state]
  return (
    <Sheet title="Barkodi" onClose={onClose}>
      <label htmlFor={codeId} className="text-sm leading-5 font-medium">
        Shifrat poshtë vijave
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
        <p role="alert" className={cn('text-sm leading-5', state === 'error' ? 'text-destructive' : 'text-muted-foreground')}>
          {message}
        </p>
      ) : null}
      {state === 'missing' ? (
        <Button variant="outline" onClick={onMissing}>
          Shto si ushqim të ri
        </Button>
      ) : null}
      <Button disabled={state === 'busy'} onClick={() => void lookUp()}>
        {state === 'busy' ? 'Po kërkohet' : 'Kërko'}
      </Button>
    </Sheet>
  )
}
