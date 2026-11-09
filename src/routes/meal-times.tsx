import { useId, useState } from 'react'
import { useNavigate } from 'react-router'
import { BackHeader } from '@/components/layout/page'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icons'
import { inputClass } from '@/components/ui/field-styles'
import { store, useLocalQuery } from '@/data/app-data'
import { mealPlanOn, readSchedule, saveSchedule, type ScheduleSettings } from '@/data/schedule-settings'
import { mealName } from '@/i18n/domain'
import { useI18n } from '@/i18n/use-i18n'
import { localDate } from '@/lib/calendar'
import { cn } from '@/lib/cn'
import type { MealKey } from '@/nutrition/meals'
import { MEAL_REMOVAL_ORDER, type MealPlan, mealSchedule, withMealCount } from '@/nutrition/schedule'
import { EditorFooter, Segmented, StepButton } from './builder-parts'

// Ushqimi › Oraret e vakteve (V35, V2-E2-06, bordi "Oraret e vakteve"): zgjimi, gjumi, ora e
// stërvitjes për çdo ditë, sa vakte dhe ora e secilit. Vaktet e reja vlejnë nga nesër.

type Preview = 'training' | 'rest'
const WORKOUT: readonly MealKey[] = ['pre_workout', 'post_workout']

const tomorrowOf = (date: string) => {
  const [year, month, day] = date.split('-').map(Number)
  return localDate(new Date(year, month - 1, day + 1))
}

export function MealTimesPage() {
  const [today] = useState(() => localDate(new Date()))
  const schedule = useLocalQuery(() => readSchedule(store), [])
  const { t } = useI18n()
  if (!schedule) {
    return (
      <div className="flex flex-col gap-5">
        <BackHeader title={t('food.schedule.title')} back={t('tab.food')} fallback="/ushqimi" />
        <div aria-hidden className="h-64 rounded-xl bg-surface" />
      </div>
    )
  }
  return <MealTimesEditor schedule={schedule} today={today} />
}

interface Draft {
  wakeTime: string
  sleepTime: string
  trainingTimes: Record<number, string>
  plan: MealPlan
}

function MealTimesEditor({ schedule, today }: { schedule: ScheduleSettings; today: string }) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [draft, setDraft] = useState<Draft>(() => ({
    wakeTime: schedule.wakeTime,
    sleepTime: schedule.sleepTime,
    trainingTimes: { ...schedule.trainingTimes },
    plan: mealPlanOn(schedule.plan, tomorrowOf(today)),
  }))
  const [preview, setPreview] = useState<Preview>(schedule.trainingDays.length > 0 ? 'training' : 'rest')
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const firstDay = schedule.trainingDays[0]
  const trainingTime = preview === 'training' && firstDay !== undefined ? (draft.trainingTimes[firstDay] ?? null) : null
  const base = { wakeTime: draft.wakeTime, sleepTime: draft.sleepTime, trainingTime }
  const defaults = mealSchedule(base)
  const meals = mealSchedule({ ...base, plan: draft.plan })
  const available = defaults.map((entry) => entry.meal)
  const removed = draft.plan.removed.filter((meal) => available.includes(meal))
  const order = MEAL_REMOVAL_ORDER.filter((meal) => available.includes(meal))
  const setPlan = (plan: MealPlan) => setDraft((current) => ({ ...current, plan }))
  const setCount = (count: number) => {
    const other = draft.plan.removed.filter((meal) => !available.includes(meal))
    setPlan({ ...draft.plan, removed: [...other, ...withMealCount(removed, available.length, count, order)] })
  }
  const setMealTime = (meal: MealKey, time: string) => {
    const times = { ...draft.plan.times }
    const original = defaults.find((entry) => entry.meal === meal)?.time
    if (!time || time === original) delete times[meal]
    else times[meal] = time
    setPlan({ ...draft.plan, times })
  }
  const lateSleep = draft.sleepTime < draft.wakeTime

  async function save() {
    setBusy(true)
    setFailed(false)
    try {
      await saveSchedule(store, draft, today)
      navigate(-1)
    } catch {
      setFailed(true)
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <BackHeader title={t('food.schedule.title')} back={t('tab.food')} fallback="/ushqimi" />

      <section aria-labelledby="times-day" className="flex flex-col">
        <h2 id="times-day" className="mb-1 type-label text-muted-foreground">
          {t('food.schedule.yourDay')}
        </h2>
        <TimeRow label={t('profile.wake')} value={draft.wakeTime} onChange={(wakeTime) => setDraft((current) => ({ ...current, wakeTime }))} />
        <TimeRow
          label={t('profile.sleep')}
          detail={lateSleep ? t('food.schedule.afterMidnight') : undefined}
          value={draft.sleepTime}
          onChange={(sleepTime) => setDraft((current) => ({ ...current, sleepTime }))}
          last
        />
      </section>

      {schedule.trainingDays.length > 0 ? (
        <section aria-labelledby="times-training" className="flex flex-col gap-2">
          <h2 id="times-training" className="type-label text-muted-foreground">
            {t('profile.trainingTime')}
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {schedule.trainingDays.map((day) => (
              <DayTime
                key={day}
                day={t(`day.${day}` as 'day.1')}
                value={draft.trainingTimes[day] ?? ''}
                onChange={(time) => setDraft((current) => ({ ...current, trainingTimes: { ...current.trainingTimes, [day]: time } }))}
              />
            ))}
          </div>
          <span className="text-[13px] text-muted-foreground">{t('food.schedule.trainingHint')}</span>
        </section>
      ) : null}

      <section aria-labelledby="times-meals" className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <h2 id="times-meals" className="type-label text-muted-foreground">
            {t('food.schedule.meals')}
          </h2>
          <span className="flex items-center gap-1.5">
            <StepButton label={t('food.schedule.countDown')} sign="−" disabled={meals.length <= 3} onClick={() => setCount(meals.length - 1)} />
            <span aria-live="polite" className="min-w-[76px] text-center text-[15px] tabular-nums">
              {t('food.schedule.count', { count: meals.length })}
            </span>
            <StepButton label={t('food.schedule.countUp')} sign="+" disabled={meals.length >= available.length} onClick={() => setCount(meals.length + 1)} />
          </span>
        </div>
        {schedule.trainingDays.length > 0 ? (
          <Segmented
            label={t('food.schedule.dayType')}
            value={preview}
            onChange={setPreview}
            options={[
              { value: 'training', label: t('food.schedule.dayTraining', { time: firstDay !== undefined ? (draft.trainingTimes[firstDay] ?? '') : '' }) },
              { value: 'rest', label: t('food.schedule.dayRest') },
            ]}
          />
        ) : null}
        <ol aria-label={t('food.schedule.meals')} className="m-0 flex list-none flex-col p-0">
          {meals.map((entry, index) => {
            const original = defaults.find((item) => item.meal === entry.meal)?.time
            const linked = WORKOUT.includes(entry.meal)
            const moved = !linked && draft.plan.times[entry.meal] !== undefined && original !== entry.time
            const name = mealName(t, entry.meal)
            return (
              <li key={entry.meal} className={cn('flex min-h-14 items-center gap-2.5 py-1.5', index < meals.length - 1 && 'border-b border-border')}>
                {linked ? (
                  <span className="flex h-touch min-w-[84px] items-center justify-center font-display text-[19px] font-extrabold text-muted-foreground tabular-nums">{entry.time}</span>
                ) : (
                  <input
                    type="time"
                    aria-label={t('food.schedule.mealTime', { meal: name })}
                    value={entry.time}
                    onChange={(event) => setMealTime(entry.meal, event.target.value)}
                    className={cn(inputClass, 'w-[84px] px-2 text-center font-display text-[19px] font-extrabold tabular-nums', moved && 'border-2 border-ember-text')}
                  />
                )}
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-base">{name}</span>
                  {linked ? (
                    <span className="text-[13px] text-data">{t(entry.meal === 'pre_workout' ? 'food.schedule.pre' : 'food.schedule.post')}</span>
                  ) : moved ? (
                    <button
                      type="button"
                      onClick={() => setMealTime(entry.meal, original ?? '')}
                      className="-my-3 flex min-h-touch items-center self-start text-left text-[13px] text-ember-text underline underline-offset-2"
                    >
                      {t('food.schedule.moved', { time: original ?? '' })} · {t('food.schedule.reset')}
                    </button>
                  ) : null}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t('food.schedule.remove', { meal: name })}
                  disabled={meals.length <= 3}
                  className="text-muted-foreground"
                  onClick={() => setPlan({ ...draft.plan, removed: [...draft.plan.removed, entry.meal] })}
                >
                  <Icon name="mbyll-vrull" size={18} />
                </Button>
              </li>
            )
          })}
        </ol>
        {removed.length > 0 ? (
          <div className="flex flex-col gap-2 pt-1">
            <span className="text-[13px] text-muted-foreground">{t('food.schedule.removed')}</span>
            <div className="flex flex-wrap gap-2">
              {removed.map((meal) => (
                <Button key={meal} variant="outline" onClick={() => setPlan({ ...draft.plan, removed: draft.plan.removed.filter((item) => item !== meal) })}>
                  {t('food.schedule.restore', { meal: mealName(t, meal) })}
                </Button>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <EditorFooter>
        {failed ? (
          <p role="alert" className="text-sm text-danger">
            {t('food.schedule.saveFailed')}
          </p>
        ) : null}
        <Button variant="primary" size="xl" disabled={busy} onClick={save}>
          {t('food.schedule.save')}
        </Button>
        <span className="text-center text-[13px] text-muted-foreground">{t('food.schedule.saveNote')}</span>
      </EditorFooter>
    </div>
  )
}

function TimeRow({ label, detail, value, onChange, last }: { label: string; detail?: string; value: string; onChange: (time: string) => void; last?: boolean }) {
  const id = useId()
  return (
    <div className={cn('flex min-h-14 items-center justify-between gap-3 py-1.5', !last && 'border-b border-border')}>
      <label htmlFor={id} className="flex min-w-0 flex-col gap-0.5">
        <span className="text-base">{label}</span>
        {detail ? <span className="text-[13px] leading-[1.35] text-muted-foreground">{detail}</span> : null}
      </label>
      <input
        id={id}
        type="time"
        value={value}
        onChange={(event) => event.target.value && onChange(event.target.value)}
        className={cn(inputClass, 'w-[96px] shrink-0 px-2 text-center font-display text-xl font-extrabold tabular-nums')}
      />
    </div>
  )
}

function DayTime({ day, value, onChange }: { day: string; value: string; onChange: (time: string) => void }) {
  const id = useId()
  return (
    <label htmlFor={id} className="flex flex-col gap-1 rounded-md border border-border bg-surface px-3 py-2">
      <span className="text-[13px] text-muted-foreground">{day}</span>
      <input
        id={id}
        type="time"
        value={value}
        onChange={(event) => event.target.value && onChange(event.target.value)}
        className="h-touch w-full bg-transparent font-display text-xl font-extrabold text-foreground tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
      />
    </label>
  )
}
