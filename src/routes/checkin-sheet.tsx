import { useState } from 'react'
import { BodyFigure } from '@/components/body/body-figure'
import { Sheet } from '@/components/layout/sheet'
import { Button } from '@/components/ui/button'
import { store, useLocalQuery } from '@/data/app-data'
import { type CheckInAnswers, type DailyState, normalizeCheckIn, saveDailyState, skipCheckIn } from '@/data/daily-state'
import { readProfile } from '@/data/profile'
import { checkInContext } from '@/data/readiness-view'
import type { TodayView } from '@/data/today'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import { capitalize } from './history-format'
import { CHIP_LABEL, chipsOf, ENERGY, groupsOf, keysOfGroups, MOOD, profileSleepMinutes, QUALITY, SORE_CHIPS, SORENESS, type SoreChip, stepSleep } from './readiness-format'

// Fleta e check-in-it (V50, V2-E3-04; bordi "Gjendja e ditës"): katër pyetjet me 5 segmente, gjumi në orë, dhe nga
// "Pak" e lart figura me çipat e grupeve. "Ruaj" ruan me gatishmërinë e atij çasti; "Ndrysho gjendjen" e hap të mbushur.

export function Segments({ legend, options, selected, onSelect }: { legend: string; options: readonly string[]; selected: number; onSelect: (index: number) => void }) {
  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className="mb-2 p-0 type-label text-muted-foreground">{legend}</legend>
      <div className="grid grid-cols-5 overflow-hidden rounded-md border border-surface-border bg-surface-2">
        {options.map((label, index) => (
          <button
            key={label}
            type="button"
            aria-pressed={index === selected}
            onClick={() => onSelect(index)}
            className={cn(
              'min-h-[52px] min-w-0 px-[3px] text-center font-display text-sm leading-[1.05] font-bold uppercase outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground',
              index > 0 && 'border-l border-surface-border',
              index === selected ? 'bg-foreground font-extrabold text-background' : 'text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

export function CheckInSheet({ view, state, onClose, onChanged }: { view: TodayView; state: DailyState | null; onClose: () => void; onChanged?: () => void }) {
  const profile = useLocalQuery(() => readProfile(store), [])
  if (!profile) return null
  return <CheckInForm view={view} state={state} sleepTime={profile.sleepTime} wakeTime={profile.wakeTime} onClose={onClose} onChanged={onChanged} />
}

function CheckInForm({
  view,
  state,
  sleepTime,
  wakeTime,
  onClose,
  onChanged,
}: {
  view: TodayView
  state: DailyState | null
  sleepTime: string
  wakeTime: string
  onClose: () => void
  onChanged?: () => void
}) {
  const { t, fmt, lang } = useI18n()
  const [mood, setMood] = useState<number>(state?.mood ?? 3)
  const [energy, setEnergy] = useState<number>(state?.energy ?? 3)
  const [sleepMinutes, setSleepMinutes] = useState(state?.sleepMinutes ?? profileSleepMinutes(sleepTime, wakeTime))
  const [quality, setQuality] = useState<number>(state?.sleepQuality ?? 3)
  const [soreness, setSoreness] = useState<number>(state?.soreness ?? 0)
  const [chips, setChips] = useState<SoreChip[]>(chipsOf(state?.soreGroups ?? []))
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  const chipNames = chips.map((chip) => t(CHIP_LABEL[chip]))
  const toggle = (chip: SoreChip) => setChips((current) => (current.includes(chip) ? current.filter((item) => item !== chip) : [...current, chip]))
  const answers = (): CheckInAnswers =>
    normalizeCheckIn({
      mood: mood as CheckInAnswers['mood'],
      energy: energy as CheckInAnswers['energy'],
      sleepMinutes,
      sleepQuality: quality as CheckInAnswers['sleepQuality'],
      soreness: soreness as CheckInAnswers['soreness'],
      soreGroups: groupsOf(chips),
    })

  async function save() {
    setBusy(true)
    setFailed(false)
    try {
      const values = answers()
      await saveDailyState(store, view.date, values, checkInContext(view, values))
      onChanged?.()
      onClose()
    } catch {
      setFailed(true)
      setBusy(false)
    }
  }

  async function skip() {
    setBusy(true)
    try {
      await skipCheckIn(store, view.date)
      onClose()
    } catch {
      setFailed(true)
      setBusy(false)
    }
  }

  const date = capitalize(fmt.date(new Date(`${view.date}T12:00:00`)), lang)
  const groupKeys = keysOfGroups(groupsOf(chips))
  return (
    <Sheet
      title={t('checkin.sheet.title')}
      description={t('checkin.sheet.sub', { date })}
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-2">
          {failed ? (
            <p role="alert" className="text-sm text-danger">
              {t('checkin.failed')}
            </p>
          ) : null}
          <Button variant="primary" size="xl" disabled={busy} onClick={() => void save()}>
            {t('checkin.save')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {state ? null : (
          <div className="-mt-2 flex justify-end">
            <Button variant="ghost" disabled={busy} onClick={() => void skip()} className="-mr-2 text-base font-semibold text-muted-foreground normal-case underline underline-offset-4">
              {t('checkin.skip')}
            </Button>
          </div>
        )}
        <Segments legend={t('checkin.mood.legend')} options={MOOD.map((key) => t(key))} selected={mood - 1} onSelect={(index) => setMood(index + 1)} />
        <Segments legend={t('checkin.energy.legend')} options={ENERGY.map((key) => t(key))} selected={energy - 1} onSelect={(index) => setEnergy(index + 1)} />
        <section aria-labelledby="checkin-sleep" className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between gap-2">
            <h3 id="checkin-sleep" className="type-label text-muted-foreground">
              {t('checkin.sleep.title')}
            </h3>
            <span className="type-caption text-muted-foreground tabular-nums">{t('checkin.sleep.from', { from: sleepTime, to: wakeTime })}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <output className="font-display text-5xl leading-none font-extrabold tabular-nums" aria-live="polite">
              {t('checkin.sleep.hours', { count: sleepMinutes / 60 })}
            </output>
            <div className="flex gap-2">
              <button
                type="button"
                aria-label={t('checkin.sleep.less')}
                onClick={() => setSleepMinutes((value) => stepSleep(value, -1))}
                className="h-[52px] w-[72px] rounded-md bg-surface-2 font-display text-[22px] font-bold tabular-nums"
              >
                −{fmt.number(0.5, { minDigits: 1 })}
              </button>
              <button
                type="button"
                aria-label={t('checkin.sleep.more')}
                onClick={() => setSleepMinutes((value) => stepSleep(value, 1))}
                className="h-[52px] w-[72px] rounded-md bg-surface-2 font-display text-[22px] font-bold tabular-nums"
              >
                +{fmt.number(0.5, { minDigits: 1 })}
              </button>
            </div>
          </div>
          <Segments legend={t('checkin.sleep.quality.legend')} options={QUALITY.map((key) => t(key))} selected={quality - 1} onSelect={(index) => setQuality(index + 1)} />
        </section>
        <section aria-label={t('checkin.soreness.legend')} className="flex flex-col gap-3">
          <Segments legend={t('checkin.soreness.legend')} options={SORENESS.map((key) => t(key))} selected={soreness} onSelect={setSoreness} />
          {soreness > 0 ? (
            <div className="flex flex-col gap-3">
              <span className="type-caption text-muted-foreground">{t('checkin.sore.where')}</span>
              <BodyFigure
                primary={[]}
                scale={1}
                label={chipNames.length > 0 ? t('checkin.figure.some', { groups: chipNames.join(', ') }) : t('checkin.figure.none')}
                paint={(keys) => (keys.some((key) => groupKeys.has(key)) ? 'fill-ember' : null)}
                className="self-center"
              />
              <div role="group" aria-label={t('checkin.sore.groups')} className="flex flex-wrap gap-2">
                {SORE_CHIPS.map((chip) => {
                  const on = chips.includes(chip.id)
                  return (
                    <button
                      key={chip.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggle(chip.id)}
                      className={cn(
                        'h-touch rounded-pill border px-4 font-display text-base font-bold uppercase',
                        on ? 'border-foreground bg-foreground text-background' : 'border-surface-border bg-surface-2 text-foreground',
                      )}
                    >
                      {t(CHIP_LABEL[chip.id])}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </Sheet>
  )
}
