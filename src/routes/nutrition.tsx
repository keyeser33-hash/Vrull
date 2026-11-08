import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { ScreenHeader } from '@/components/layout/screen-header'
import { Sheet } from '@/components/layout/sheet'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button-variants'
import { Icon } from '@/components/ui/icons'
import { surfaceClass } from '@/components/ui/surface'
import { store, useLocalQuery } from '@/data/app-data'
import { localDate } from '@/lib/calendar'
import { setSupplementEnabled, supplementList, toggleSupplement } from '@/data/supplements'
import { logTemplateMeal, type MealSlot, type MealStatus, type NutritionDay, nutritionDay, removeDiaryEntry, setDayType } from '@/data/nutrition'
import { MEAL_OBJECT, type MealKey } from '@/nutrition/meals'
import { EVIDENCE_LABEL } from '@/nutrition/supplements'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import { grams, kcal, macrosLine, relativeTime } from './nutrition-format'
import { dateLabel } from './training-format'

// Ushqimi i v1 në sistemin Vrull (V2-E1-05; ekrani i ri vjen me Etapën 2): kreu me butonin e
// profilit, shiriti i kcal të ditës; karta "Vakti i radhës" me artikujt e planit, "Regjistro
// <vaktin>" (veprimi kryesor, prushi) dhe "Ndrysho"; poshtë dita si orar vertikal; në fund makrot
// kundrejt objektivave. Një vakt hapet në fletë (?vakti=...), që butoni mbrapa i Android-it ta mbyllë.

/** Ora rifreskohet çdo minutë, që "Vakti i radhës" dhe "pas 20 min" të ndjekin kohën. */
function useNow() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])
  return now
}

export function NutritionPage() {
  const now = useNow()
  const date = localDate(now)
  const day = useLocalQuery(() => nutritionDay(store, date, now), [date, now.getTime()])
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const opened = params.get('vakti') as MealKey | null
  const openMeal = (meal: MealKey) => setParams({ vakti: meal })

  if (!day) {
    return (
      <div className="flex flex-col gap-4">
        <FoodHeader />
        <div aria-hidden className="h-11 rounded-md bg-surface" />
        <div aria-hidden className="h-72 rounded-xl bg-surface" />
        <div aria-hidden className="h-80 rounded-lg bg-surface" />
      </div>
    )
  }
  const meal = day.meals.find((entry) => entry.meal === opened)

  return (
    <div className="flex flex-col gap-5">
      <FoodHeader />
      <DayHeader day={day} now={now} />
      {day.next ? <NextMeal day={day} meal={day.next} now={now} onEdit={() => openMeal(day.next!.meal)} /> : <DayDone day={day} />}
      <Timeline day={day} onOpen={openMeal} />
      <Supplements day={day} onEdit={() => setParams({ ndrysho: 'suplementet' })} />
      <MacroTotals day={day} />
      {meal ? <MealSheet date={day.date} meal={meal} onClose={() => navigate(-1)} /> : null}
      {params.get('ndrysho') === 'suplementet' ? <SupplementsSheet onClose={() => navigate(-1)} /> : null}
    </div>
  )
}

function FoodHeader() {
  const { t } = useI18n()
  return <ScreenHeader title={t('tab.food')} />
}

function DayHeader({ day, now }: { day: NutritionDay; now: Date }) {
  const training = day.dayType === 'training'
  const progress = day.targets ? Math.min(100, (day.totals.kcal / day.targets.kcal) * 100) : 0
  return (
    <header className="flex flex-col gap-1">
      <div className="flex min-h-11 items-center justify-between gap-3 text-sm leading-5 text-muted-foreground tabular-nums">
        <span className="flex items-center">
          {dateLabel(now)}&nbsp;·&nbsp;
          <button
            type="button"
            aria-label={`Lloji i ditës: ${training ? 'stërvitje' : 'pushim'}. Ndrysho në ditë ${training ? 'pushimi' : 'stërvitjeje'}`}
            onClick={() => void setDayType(store, day.date, training ? 'rest' : 'training')}
            className="-mx-1 min-h-11 min-w-11 rounded-md px-1 underline decoration-dotted underline-offset-4 hover:text-foreground"
          >
            {training ? 'ditë stërvitjeje' : 'ditë pushimi'}
          </button>
        </span>
        <span>
          <b className="font-semibold text-foreground">{kcal(day.totals.kcal)}</b>
          {day.targets ? ` / ${kcal(day.targets.kcal)}` : ''} kcal
        </span>
      </div>
      <div
        role="progressbar"
        aria-label="Kalori të ditës"
        aria-valuemin={0}
        aria-valuemax={day.targets?.kcal ?? 0}
        aria-valuenow={Math.round(day.totals.kcal)}
        className="h-1.5 overflow-hidden rounded-pill bg-track"
      >
        <div className="h-full rounded-pill bg-ember" style={{ width: `${progress}%` }} />
      </div>
    </header>
  )
}

function NextMeal({ day, meal, now, onEdit }: { day: NutritionDay; meal: MealSlot; now: Date; onEdit: () => void }) {
  const [busy, setBusy] = useState(false)
  const today = day.date === localDate(now)
  return (
    <section aria-labelledby="next-meal" className={cn(surfaceClass, 'flex flex-col gap-3.5 rounded-xl p-4')}>
      <div className="flex flex-col gap-1">
        <span className="type-label text-muted-foreground">Vakti i radhës</span>
        <div className="flex flex-wrap items-baseline gap-x-2.5">
          <h2 id="next-meal" className="type-display-s">
            {meal.label}
          </h2>
          <span className="type-body text-muted-foreground tabular-nums">
            {meal.time}
            {today ? ` · ${relativeTime(meal.time, now)}` : ''}
          </span>
        </div>
      </div>
      {meal.template.length > 0 ? (
        <>
          <ul className="flex flex-col text-sm leading-5 tabular-nums">
            {meal.template.map((item) => (
              <li key={item.name} className="flex justify-between gap-2 border-t border-border py-[7px]">
                <span>{item.name}</span>
                <span className="text-muted-foreground">{item.amount}</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-between text-xs leading-4 text-muted-foreground tabular-nums">
            <span>rreth {kcal(meal.templateTotals.kcal)} kcal</span>
            <span>{macrosLine(meal.templateTotals)}</span>
          </div>
        </>
      ) : (
        <p className="type-caption text-muted-foreground">Ky vakt nuk ka artikuj në plan.</p>
      )}
      <div className="flex gap-2">
        <Button
          variant="primary"
          size="lg"
          className="min-w-0 flex-1 px-4"
          disabled={busy || meal.template.length === 0}
          onClick={() => {
            setBusy(true)
            void logTemplateMeal(store, day.date, meal.meal).finally(() => setBusy(false))
          }}
        >
          Regjistro {MEAL_OBJECT[meal.meal]}
        </Button>
        <Button variant="secondary" size="lg" className="shrink-0 px-5" onClick={onEdit}>
          Ndrysho
        </Button>
      </div>
    </section>
  )
}

function DayDone({ day }: { day: NutritionDay }) {
  return (
    <section aria-labelledby="day-done" className={cn(surfaceClass, 'flex flex-col gap-1.5 rounded-xl p-4')}>
      <h2 id="day-done" className="type-title">
        Vaktet e ditës u regjistruan
      </h2>
      <p className="type-caption text-muted-foreground tabular-nums">
        {kcal(day.totals.kcal)} kcal · {macrosLine(day.totals)}
      </p>
    </section>
  )
}

const BADGE: Record<MealStatus, string> = {
  done: 'bg-surface-2 text-success',
  next: 'bg-surface-2 text-foreground',
  todo: 'text-muted-foreground',
  missed: 'text-muted-foreground',
}

const DOT: Record<MealStatus, string> = {
  done: 'bg-foreground',
  next: 'bg-ember ring-[3px] ring-insight-border',
  todo: 'border-[1.5px] border-subtle',
  missed: 'border-[1.5px] border-dashed border-subtle',
}

function statusText(meal: MealSlot) {
  switch (meal.status) {
    case 'done':
      return `Regjistruar · ${kcal(meal.totals.kcal)} kcal`
    case 'next':
      return 'E radhës'
    case 'todo':
      return 'Në pritje'
    case 'missed':
      return 'Pa regjistruar'
  }
}

function Timeline({ day, onOpen }: { day: NutritionDay; onOpen: (meal: MealKey) => void }) {
  return (
    <section aria-labelledby="day-title" className="flex flex-col">
      <h2 id="day-title" className="mb-1 type-label text-muted-foreground">
        Dita
      </h2>
      <ol className="flex flex-col">
        {day.meals.map((meal) => (
          <li key={meal.meal}>
            <button
              type="button"
              onClick={() => onOpen(meal.meal)}
              aria-label={`${meal.label}, ${meal.time}, ${statusText(meal)}`}
              className="grid min-h-12 w-full grid-cols-[44px_20px_minmax(0,1fr)_auto] items-center gap-2 rounded-md text-left tabular-nums hover:bg-surface"
            >
              <span className="text-xs leading-4 text-muted-foreground">{meal.time}</span>
              <span aria-hidden className={cn('size-2.5 justify-self-center rounded-full', DOT[meal.status])} />
              <span className="flex min-w-0 flex-col">
                <span className={cn('truncate text-sm leading-5', meal.status === 'todo' || meal.status === 'missed' ? 'text-muted-foreground' : 'font-semibold')}>
                  {meal.label}
                </span>
                {meal.supplements.length > 0 ? (
                  <span className="truncate text-xs leading-4 text-muted-foreground">me {meal.supplements.map((item) => item.name.toLowerCase()).join(', ')}</span>
                ) : null}
              </span>
              <span className={cn('rounded-full px-2 py-1 text-xs leading-4 font-medium whitespace-nowrap', BADGE[meal.status])}>{statusText(meal)}</span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  )
}

function MacroTotals({ day }: { day: NutritionDay }) {
  // Makrot me ngjyrat e Vrullit: proteina prushi, karbohidratet vjollcë, yndyrat rërë.
  const rows = [
    { label: 'Proteina', value: day.totals.proteinG, target: day.targets?.proteinG, fill: 'bg-ember' },
    { label: 'Karbohidratet', value: day.totals.carbsG, target: day.targets?.carbsG, fill: 'bg-data' },
    { label: 'Yndyrat', value: day.totals.fatG, target: day.targets?.fatG, fill: 'bg-sand' },
  ]
  return (
    <section aria-labelledby="macros-title" className="flex flex-col gap-3">
      <h2 id="macros-title" className="type-label text-muted-foreground">
        Makrot e ditës
      </h2>
      {day.targets ? null : <p className="text-sm leading-5 text-muted-foreground">Shkruaj peshën te Cilësimet që të dalin objektivat.</p>}
      <dl className="flex flex-col gap-3 tabular-nums">
        {rows.map((row) => (
          <div key={row.label} className="flex flex-col gap-1.5">
            <div className="flex justify-between text-sm leading-5">
              <dt>{row.label}</dt>
              <dd className="text-muted-foreground">
                <b className="font-semibold text-foreground">{Math.round(row.value)}</b>
                {row.target ? ` / ${row.target}` : ''} g
              </dd>
            </div>
            {row.target ? (
              <div aria-hidden className="h-1.5 overflow-hidden rounded-pill bg-track">
                <div className={cn('h-full rounded-pill', row.fill)} style={{ width: `${Math.min(100, (row.value / row.target) * 100)}%` }} />
              </div>
            ) : null}
          </div>
        ))}
      </dl>
      <p className="text-xs leading-4 text-muted-foreground">
        Proteina e Jimit është rreth 3,3–4,1 g/kg. Studimet tregojnë se fitimi në muskul nuk rritet ndjeshëm mbi rreth 1,6–2,2 g/kg.
      </p>
      {day.outsideJimRange ? (
        <p className="text-xs leading-4 text-muted-foreground">
          Plani i Jimit është për 72,6–90,7 kg. Vaktet mbeten si në plan; objektivat janë sipas peshës tënde.
        </p>
      ) : null}
    </section>
  )
}

function MealSheet({ date, meal, onClose }: { date: string; meal: MealSlot; onClose: () => void }) {
  const [busy, setBusy] = useState(false)
  return (
    <Sheet title={`${meal.label} · ${meal.time}`} onClose={onClose}>
      {meal.entries.length > 0 ? (
        <>
          <ul className="flex flex-col tabular-nums">
            {meal.entries.map((entry) => (
              <li key={entry.id} className="flex min-h-12 items-center gap-3 border-t border-border first:border-t-0">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-base leading-6">{entry.name}</span>
                  <span className="text-xs leading-4 text-muted-foreground">
                    {entry.grams === null ? '' : `${grams(entry.grams)} · `}
                    {kcal(entry.kcal)} kcal
                  </span>
                </span>
                <Button variant="ghost" size="icon" aria-label={`Hiq ${entry.name}`} onClick={() => void removeDiaryEntry(store, entry.id)}>
                  <Icon name="fshi" size={20} />
                </Button>
              </li>
            ))}
          </ul>
          <p className="text-sm leading-5 text-muted-foreground tabular-nums">
            {kcal(meal.totals.kcal)} kcal · {macrosLine(meal.totals)}
          </p>
          <AddFoodLink meal={meal.meal} />
        </>
      ) : (
        <>
          <p className="text-sm leading-5 text-muted-foreground">Sipas planit të Jimit:</p>
          <ul className="flex flex-col tabular-nums">
            {meal.template.map((item) => (
              <li key={item.name} className="flex min-h-11 items-center justify-between gap-3 border-t border-border first:border-t-0">
                <span className="text-base leading-6">{item.name}</span>
                <span className="text-sm leading-5 text-muted-foreground">{item.amount}</span>
              </li>
            ))}
          </ul>
          <Button
            variant="secondary"
            size="lg"
            disabled={busy || meal.template.length === 0}
            onClick={() => {
              setBusy(true)
              void logTemplateMeal(store, date, meal.meal).finally(() => setBusy(false))
            }}
          >
            Regjistro sipas planit
          </Button>
          <AddFoodLink meal={meal.meal} />
        </>
      )}
    </Sheet>
  )
}

function AddFoodLink({ meal }: { meal: MealKey }) {
  return (
    <Link to={`/ushqimi/shto/${meal}`} replace className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'w-full')}>
      <Icon name="shto" size={20} />
      Shto ushqim
    </Link>
  )
}

function Supplements({ day, onEdit }: { day: NutritionDay; onEdit: () => void }) {
  const meals = day.meals.filter((meal) => meal.supplements.length > 0)
  const total = meals.reduce((count, meal) => count + meal.supplements.length, 0)
  const taken = meals.reduce((count, meal) => count + meal.supplements.filter((item) => item.taken).length, 0)
  return (
    <section aria-labelledby="supplements-title" className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <h2 id="supplements-title" className="type-label text-muted-foreground">
          Suplementet <span className="tabular-nums">· {taken} nga {total}</span>
        </h2>
        <Button variant="ghost" onClick={onEdit}>
          Ndrysho listën
        </Button>
      </div>
      {meals.length === 0 ? (
        <p className="text-sm leading-5 text-muted-foreground">Asnjë suplement aktiv për sot.</p>
      ) : (
        <div className={cn(surfaceClass, 'flex flex-col overflow-hidden rounded-lg')}>
          {meals.map((meal) => (
            <fieldset key={meal.meal} className="border-t border-border px-4 py-1 first:border-t-0">
              <legend className="sr-only">
                {meal.label}, {meal.time}
              </legend>
              <span aria-hidden className="block pt-2 text-xs leading-4 text-muted-foreground tabular-nums">
                {meal.time} · {meal.label}
              </span>
              {meal.supplements.map((item) => (
                <label key={item.id} className="flex min-h-12 cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={item.taken}
                    onChange={() => void toggleSupplement(store, { date: day.date, supplementId: item.id, meal: meal.meal })}
                    className="size-5 shrink-0 accent-current"
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className={cn('text-base leading-6', item.taken && 'text-muted-foreground line-through')}>{item.name}</span>
                    <span className="text-xs leading-4 text-muted-foreground">{item.doseText}</span>
                  </span>
                  <span className="shrink-0 rounded-pill bg-surface-2 px-2 py-1 text-xs leading-4 font-medium text-muted-foreground">
                    {EVIDENCE_LABEL[item.evidence]}
                  </span>
                </label>
              ))}
            </fieldset>
          ))}
        </div>
      )}
    </section>
  )
}

function SupplementsSheet({ onClose }: { onClose: () => void }) {
  const list = useLocalQuery(() => supplementList(store), [])
  return (
    <Sheet title="Suplementet" onClose={onClose}>
      <p className="text-sm leading-5 text-muted-foreground">Ato të çaktivizuara nuk dalin te dita. Evidenca tregon sa e mbështesin studimet.</p>
      <ul className="flex flex-col">
        {(list ?? []).map((item) => (
          <li key={item.id} className="border-t border-border first:border-t-0">
            <label className="flex min-h-14 cursor-pointer items-center gap-3 py-1.5">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-base leading-6">{item.name}</span>
                <span className="text-xs leading-4 text-muted-foreground">
                  {item.doseText} · {item.evidenceText}
                </span>
              </span>
              <input
                type="checkbox"
                role="switch"
                checked={item.enabled}
                onChange={(event) => void setSupplementEnabled(store, item.id, event.currentTarget.checked)}
                className="size-5 shrink-0 accent-current"
              />
            </label>
          </li>
        ))}
      </ul>
    </Sheet>
  )
}
