import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { TimeField } from '@/components/forms/time-field'
import { Sheet } from '@/components/layout/sheet'
import { Button } from '@/components/ui/button'
import { inputClass } from '@/components/ui/field-styles'
import { store, useLocalQuery } from '@/data/app-data'
import { postponeWorkout } from '@/data/day-choice'
import { decisionDate } from '@/data/lighter-day'
import { readSchedule, setTrainingTime, trainingTimeOn } from '@/data/schedule-settings'
import { trainingSnapshot } from '@/data/training'
import { useI18n } from '@/i18n/use-i18n'
import { localDate } from '@/lib/calendar'
import { cn } from '@/lib/cn'

// Ora e stërvitjes së sotme (V76, V77; bordi "23 · Ora e stërvitjes" te kanavaca "Vrull - Propozimi UX"): butoni
// "18:00 · Ndrysho" te Sot dhe te Programi hap fletën (adresa `?ora=1`, që butoni mbrapa e mbyll). Ora ruhet vetëm për
// sot ose për çdo javë në atë ditë; "Nuk shkoj sot, shtyje për nesër" është e njëjta shtyrje si te karta e
// gatishmërisë (V50), e mundshme deri në setin e parë.

const SHEET_PARAM = 'ora'

export function TrainingTimeButton({ className }: { className?: string }) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const open = params.get(SHEET_PARAM) === '1'
  const view = useLocalQuery(async () => {
    const date = localDate(store.now())
    const [schedule, snapshot] = await Promise.all([readSchedule(store), trainingSnapshot(store)])
    const weekday = ((new Date(`${date}T12:00:00`).getDay() + 6) % 7) + 1
    return { date, time: trainingTimeOn(schedule, date), weekly: schedule.trainingDays.includes(weekday), started: (snapshot?.session?.sets.length ?? 0) > 0 }
  }, [])
  if (!view) return null
  return (
    <>
      <button
        type="button"
        aria-label={t('trainTime.changeLabel', { time: view.time })}
        onClick={() => setParams((current) => ({ ...Object.fromEntries(current), [SHEET_PARAM]: '1' }))}
        className={cn(
          'min-h-touch self-start rounded-md text-sm font-medium text-muted-foreground tabular-nums underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground',
          className,
        )}
      >
        {t('trainTime.change', { time: view.time })}
      </button>
      {open ? <TrainingTimeSheet {...view} onClose={() => navigate(-1)} /> : null}
    </>
  )
}

function TrainingTimeSheet({ date, time, weekly, started, onClose }: { date: string; time: string; weekly: boolean; started: boolean; onClose: () => void }) {
  const { t, fmt } = useI18n()
  const [value, setValue] = useState(time)
  const [scope, setScope] = useState<'day' | 'weekday'>('day')
  const [busy, setBusy] = useState(false)
  const weekday = fmt.weekday(new Date(`${date}T12:00:00`))

  const run = (action: () => Promise<unknown>) => {
    if (busy) return
    setBusy(true)
    void action()
      .then(onClose)
      .finally(() => setBusy(false))
  }

  return (
    <Sheet
      title={t('trainTime.title')}
      description={t('trainTime.intro')}
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-2">
          <Button variant="primary" size="xl" className="w-full" disabled={busy} onClick={() => run(() => setTrainingTime(store, date, value, scope))}>
            {t('trainTime.save')}
          </Button>
          {started ? null : (
            <Button variant="ghost" size="lg" className="w-full normal-case" disabled={busy} onClick={() => run(async () => postponeWorkout(store, await decisionDate(store)))}>
              {t('trainTime.postpone')}
            </Button>
          )}
        </div>
      }
    >
      <label className="flex shrink-0 items-center justify-between gap-3">
        <span className="type-body-strong">{t('trainTime.time')}</span>
        <TimeField value={value} onChange={setValue} label={t('trainTime.time')} className={cn(inputClass, 'w-[112px] shrink-0 px-2 font-display text-2xl font-extrabold')} />
      </label>
      {weekly ? (
        <div role="group" aria-label={t('trainTime.scope')} className="flex shrink-0 flex-col gap-2">
          <span className="type-label text-muted-foreground">{t('trainTime.scope')}</span>
          <div className="grid grid-cols-2 gap-2">
            {(['day', 'weekday'] as const).map((option) => (
              <Button key={option} variant={scope === option ? 'secondary' : 'outline'} aria-pressed={scope === option} className="normal-case" onClick={() => setScope(option)}>
                {option === 'day' ? t('trainTime.onlyToday') : t('trainTime.everyWeek', { weekday })}
              </Button>
            ))}
          </div>
        </div>
      ) : null}
    </Sheet>
  )
}
