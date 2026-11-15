import { type ReactNode, useRef, useState } from 'react'
import { BodyFigure } from '@/components/body/body-figure'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icons'
import { ProgressTrack } from '@/components/ui/progress-bar'
import { type StoryPage, StoryViewer } from '@/components/ui/story-viewer'
import { store, useLocalQuery } from '@/data/app-data'
import { readCheckInDraft, saveCheckInAnswers } from '@/data/checkin-draft'
import { chooseLighter, keepUsual, postponeWorkout } from '@/data/day-choice'
import { type CheckInAnswers, type DailyState, readinessOfState, skipCheckIn } from '@/data/daily-state'
import { readProfile } from '@/data/profile'
import { checkInContext, readinessView } from '@/data/readiness-view'
import type { Readiness } from '@/readiness/readiness'
import { isTrainingMode, type TodayView } from '@/data/today'
import { programDayName } from '@/i18n/domain'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import { type Draft, completeAnswers, draftOf, firstOpenQuestion, QUESTIONS } from '@/today/checkin-flow'
import { capitalize } from './history-format'
import { CHIP_LABEL, chipsOf, ENERGY, groupsOf, keysOfGroups, LEVEL_TONE, levelLabel, MOOD, profileSleepMinutes, QUALITY, SORE_CHIPS, SORENESS, type SoreChip, stepSleep } from './readiness-format'
import { PART, partValue } from './readiness-parts'
import { useSuggestion } from './readiness-suggestion-state'
import { costText, whyText } from './readiness-suggestion-text'

// Gjendja e ditës si story (V57, SPEC §0.3f; bordet "Story · Gjendja", "Story · Gjumi", "Story · Gati"): katër pyetjet e
// §0.3d, secila në ekran të plotë, dhe e 5-ta me gatishmërinë dhe, kur është e ulët, sugjerimin e seancës. Një zgjedhje
// ruhet dhe kalon vetë te tjetra; përgjigja duket menjëherë (gjendja e ekranit, jo leximi i bazës), ruajtja vjen pas.
// Ruajtja: `saveCheckInAnswers`, që mbi `saveDailyState` shkruan rreshtin kur janë të katërta. Sugjerimi përdor
// rrjedhën ekzistuese (`day-choice.ts`, `readiness-suggestion-*`).

interface Loaded {
  state: DailyState | null
  draft: Draft
  sleepTime: string
  wakeTime: string
}

const READY = QUESTIONS.length
const same = (a: CheckInAnswers, b: DailyState) =>
  a.mood === b.mood && a.energy === b.energy && a.sleepMinutes === b.sleepMinutes && a.sleepQuality === b.sleepQuality && a.soreness === b.soreness && a.soreGroups.join() === b.soreGroups.join()

export interface CheckInStoriesProps {
  view: TodayView
  /** `gati`: hapet story i 5-të; `gjendja`: pyetja e parë pa përgjigje. */
  start: 'gjendja' | 'gati'
  /** `ready`: u arrit story i 5-të (rrethi "Gati N%" bëhet i shikuar). */
  onClose: (seen: { ready: boolean }) => void
}

export function CheckInStories(props: CheckInStoriesProps) {
  const [first, setFirst] = useState<Loaded | null>(null)
  const loaded = useLocalQuery(async (): Promise<Loaded> => {
    const [rv, draft, profile] = await Promise.all([readinessView(store, props.view.date), readCheckInDraft(store, props.view.date), readProfile(store)])
    return { state: rv.state, draft, sleepTime: profile.sleepTime, wakeTime: profile.wakeTime }
  }, [props.view.date])
  // Vetëm leximi i parë: pas çdo përgjigjeje baza rilexohet, por ekrani mban përgjigjet e veta.
  if (loaded && !first) setFirst(loaded)
  if (!first) return null
  return <Flow {...props} loaded={first} />
}

function Flow({ view, start, onClose, loaded }: CheckInStoriesProps & { loaded: Loaded }) {
  const { t, fmt, lang } = useI18n()
  const [answers, setAnswers] = useState<Draft>(() => draftOf(loaded.state, loaded.draft))
  const [index, setIndex] = useState(() => (start === 'gati' ? Math.min(READY, firstOpenQuestion(draftOf(loaded.state, loaded.draft))) : firstOpenQuestion(draftOf(loaded.state, loaded.draft))))
  const [failed, setFailed] = useState(false)
  const reached = useRef(index === READY)
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const done = completeAnswers(answers)
  const suggestion = useSuggestion(view)
  const stored = useLocalQuery(() => readinessView(store, view.date), [view.date])

  const persist = (next: Draft) => {
    queue.current = queue.current
      .then(() => saveCheckInAnswers(store, view.date, next, (values) => checkInContext(view, values)))
      .then(
        () => setFailed(false),
        () => setFailed(true),
      )
  }
  /** Dhënia e një përgjigjeje: ekrani e shfaq dhe kalon menjëherë, ruajtja vazhdon pas. */
  const answer = (patch: Draft, advance = true) => {
    const next = { ...answers, ...patch }
    setAnswers(next)
    persist(next)
    if (advance) go(index + 1)
  }
  const go = (target: number) => {
    if (target >= READY) reached.current = true
    setIndex(Math.min(target, READY))
  }
  const close = () => onClose({ ready: reached.current })

  const ctx = done ? checkInContext(view, done) : null
  const live: DailyState | null = done && ctx ? { ...done, ...ctx, date: view.date, readiness: null } : null
  // Pas plotësimit e njëjta vlerë si rrethi: rreshti i ruajtur (ka rikuperimin e çastit), përndryshe llogaritja menjëherë.
  const state = done && stored?.state && same(done, stored.state) ? stored.state : live
  const readiness = state ? readinessOfState(state) : null

  const date = capitalize(fmt.date(new Date(`${view.date}T12:00:00`)), lang)
  const pages: StoryPage[] = [
    {
      key: 'mood',
      label: t('checkin.mood.legend'),
      open: answers.mood === undefined,
      children: (
        <Levels
          heading={t('sot.q.mood')}
          options={MOOD.map((key) => t(key))}
          selected={answers.mood}
          lit={(value) => value}
          onPick={(value) => answer({ mood: value as 1 })}
          failed={failed}
          hint
          footer={
            loaded.state ? null : (
              <Button
                variant="ghost"
                className="font-sans text-[15px] font-semibold tracking-normal normal-case underline underline-offset-[3px]"
                onClick={() => {
                  void skipCheckIn(store, view.date)
                  close()
                }}
              >
                {t('checkin.skip')}
              </Button>
            )
          }
        />
      ),
    },
    {
      key: 'energy',
      label: t('checkin.energy.legend'),
      open: answers.energy === undefined,
      children: <Levels heading={t('sot.q.energy')} options={ENERGY.map((key) => t(key))} selected={answers.energy} lit={(value) => value} onPick={(value) => answer({ energy: value as 1 })} failed={failed} hint />,
    },
    {
      key: 'sleep',
      label: t('checkin.sleep.title'),
      open: answers.sleepMinutes === undefined || answers.sleepQuality === undefined,
      children: <Sleep initial={answers} loaded={loaded} failed={failed} onNext={(patch) => answer(patch)} />,
    },
    {
      key: 'soreness',
      label: t('checkin.soreness.legend'),
      open: answers.soreness === undefined,
      children: <Soreness initial={answers} failed={failed} onNext={(patch) => answer(patch)} />,
    },
    {
      key: 'ready',
      label: t('readiness.sheet.title'),
      open: suggestion?.kind === 'suggest',
      children:
        readiness && state ? (
          <Ready
            view={view}
            state={state}
            readiness={readiness}
            suggestion={suggestion}
            failed={failed}
            onChoice={async (action) => {
              try {
                await action()
                close()
              } catch {
                setFailed(true)
              }
            }}
          />
        ) : null,
    },
  ]
  return <StoryViewer title={t('checkin.title')} subtitle={date} counter={index < READY ? `${index + 1} / ${READY}` : undefined} pages={pages} index={index} onIndex={go} onClose={close} />
}

/** Kutia e një story: titulli sipër, pjesa e poshtme (zgjedhjet) poshtë. */
function Frame({ heading, failed, children, footer }: { heading: string; failed: boolean; children: ReactNode; footer?: ReactNode }) {
  const { t } = useI18n()
  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 pt-2">
        <h1 className="m-0 font-display text-[40px] leading-[0.95] font-extrabold uppercase">{heading}</h1>
        {failed ? (
          <p role="alert" className="text-sm text-danger">
            {t('checkin.failed')}
          </p>
        ) : null}
        {children}
      </div>
      {footer ? <div className="flex shrink-0 flex-col items-center px-4 pt-3 pb-7">{footer}</div> : null}
    </>
  )
}

/** Pyetje me shkallë: rreshta 64 px me shufra që ndizen; një prekje ruan dhe kalon. */
function Levels({
  heading,
  options,
  selected,
  lit,
  onPick,
  failed,
  hint,
  footer,
}: {
  heading: string
  options: string[]
  selected: number | undefined
  lit: (value: number) => number
  onPick: (value: number) => void
  failed: boolean
  hint?: boolean
  footer?: ReactNode
}) {
  const { t } = useI18n()
  return (
    <Frame
      heading={heading}
      failed={failed}
      footer={
        <>
          {hint ? <span className="text-center text-[13px] text-muted-foreground">{t('sot.q.hint')}</span> : null}
          {footer}
        </>
      }
    >
      <div role="group" aria-label={heading} className="mt-auto flex flex-col gap-2.5 pb-3.5">
        {options.map((label, position) => {
          const value = position + 1
          return (
            <button
              key={label}
              type="button"
              aria-pressed={selected === value}
              aria-label={t('sot.q.level', { label, n: position + 1 })}
              onClick={() => onPick(value)}
              className={cn(
                'box-border flex w-full items-center gap-3 rounded-lg border px-3.5 text-left text-[19px] font-semibold outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground',
                'h-16',
                selected === value ? 'border-foreground bg-surface-2' : 'border-surface-border bg-surface',
              )}
            >
              <Bars on={lit(value)} />
              <span>{label}</span>
            </button>
          )
        })}
      </div>
    </Frame>
  )
}

function Bars({ on }: { on: number }) {
  return (
    <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center gap-[3px]">
      {[1, 2, 3, 4, 5].map((bar) => (
        <span key={bar} className={cn('h-[18px] w-[3px] rounded-sm', bar <= on ? 'bg-foreground' : 'bg-subtle')} />
      ))}
    </span>
  )
}

function NextButton({ onClick }: { onClick: () => void }) {
  const { t } = useI18n()
  return (
    <Button variant="primary" size="xl" onClick={onClick}>
      {t('sot.q.next')}
    </Button>
  )
}

/** Gjumi: orët me hap 0,5 dhe cilësia; "Tjetra" i ruan të dyja. */
function Sleep({ initial, loaded, failed, onNext }: { initial: Draft; loaded: Loaded; failed: boolean; onNext: (patch: Draft) => void }) {
  const { t, fmt } = useI18n()
  const [minutes, setMinutes] = useState(initial.sleepMinutes ?? profileSleepMinutes(loaded.sleepTime, loaded.wakeTime))
  const [quality, setQuality] = useState<number>(initial.sleepQuality ?? 3)
  const hours = t('checkin.sleep.hours', { count: minutes / 60 })
  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-7 px-4 pt-2">
        <h1 className="m-0 font-display text-[40px] leading-[0.95] font-extrabold uppercase">{t('sot.q.sleep')}</h1>
        {failed ? (
          <p role="alert" className="text-sm text-danger">
            {t('checkin.failed')}
          </p>
        ) : null}
        <section aria-labelledby="gjumi-oret" className="flex flex-col gap-3.5">
          <h2 id="gjumi-oret" className="m-0 type-label text-muted-foreground">
            {t('sot.q.hours')}
          </h2>
          <div className="flex items-center justify-between gap-3">
            <button type="button" aria-label={t('checkin.sleep.less')} onClick={() => setMinutes((value) => stepSleep(value, -1))} className="flex size-14 shrink-0 items-center justify-center rounded-lg border border-surface-border bg-surface-2">
              <svg aria-hidden viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <path d="M6 12h12" />
              </svg>
            </button>
            <output aria-live="polite" className="font-display text-[56px] leading-[0.9] font-extrabold whitespace-nowrap tabular-nums">
              {hours}
            </output>
            <button type="button" aria-label={t('checkin.sleep.more')} onClick={() => setMinutes((value) => stepSleep(value, 1))} className="flex size-14 shrink-0 items-center justify-center rounded-lg border border-surface-border bg-surface-2">
              <Icon name="plus" size={24} />
            </button>
          </div>
          <span className="text-center text-[13px] text-muted-foreground">{t('sot.q.hoursFrom')}</span>
          <span className="sr-only">{fmt.number(minutes / 60)}</span>
        </section>
        <section aria-labelledby="gjumi-cilesia" className="flex flex-col gap-3">
          <h2 id="gjumi-cilesia" className="m-0 type-label text-muted-foreground">
            {t('sot.q.quality')}
          </h2>
          <div role="group" aria-labelledby="gjumi-cilesia" className="flex flex-wrap gap-2">
            {QUALITY.map((key, position) => (
              <Chip key={key} on={quality === position + 1} onClick={() => setQuality(position + 1)}>
                {t(key)}
              </Chip>
            ))}
          </div>
        </section>
      </div>
      <div className="shrink-0 px-4 pt-3 pb-7">
        <NextButton onClick={() => onNext({ sleepMinutes: minutes, sleepQuality: quality as 1 })} />
      </div>
    </>
  )
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        'box-border flex h-12 items-center gap-1.5 rounded-pill border-2 px-4 text-base',
        on ? 'border-foreground bg-surface-2 font-bold' : 'border-surface-border bg-surface font-medium',
      )}
    >
      {on ? <Icon name="zgjedhur" size={16} /> : null}
      {children}
    </button>
  )
}

/** Dhimbjet: "Asnjë" ruan dhe kalon; nga "Pak" e lart zgjidhen grupet te figura dhe "Tjetra" i ruan. */
function Soreness({ initial, failed, onNext }: { initial: Draft; failed: boolean; onNext: (patch: Draft) => void }) {
  const { t } = useI18n()
  const [level, setLevel] = useState<number | undefined>(initial.soreness)
  const [chips, setChips] = useState<SoreChip[]>(chipsOf(initial.soreGroups ?? []))
  const names = chips.map((chip) => t(CHIP_LABEL[chip]))
  const groupKeys = keysOfGroups(groupsOf(chips))
  const toggle = (chip: SoreChip) => setChips((current) => (current.includes(chip) ? current.filter((item) => item !== chip) : [...current, chip]))
  const options = SORENESS.map((key) => t(key))
  const sore = level !== undefined && level > 0
  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 pt-2">
        <h1 className="m-0 font-display text-[40px] leading-[0.95] font-extrabold uppercase">{t('sot.q.soreness')}</h1>
        {failed ? (
          <p role="alert" className="text-sm text-danger">
            {t('checkin.failed')}
          </p>
        ) : null}
        <div role="group" aria-label={t('checkin.soreness.legend')} className={cn('flex flex-col gap-2', !sore && 'mt-auto pb-3.5')}>
          {options.map((label, position) => (
            <button
              key={label}
              type="button"
              aria-pressed={level === position}
              aria-label={t('sot.q.level', { label, n: position + 1 })}
              onClick={() => (position === 0 ? onNext({ soreness: 0, soreGroups: [] }) : setLevel(position))}
              className={cn(
                'box-border flex min-h-touch w-full items-center gap-3 rounded-lg border px-3.5 text-left text-[17px] font-semibold',
                sore ? 'h-12' : 'h-14',
                level === position ? 'border-foreground bg-surface-2' : 'border-surface-border bg-surface',
              )}
            >
              <Bars on={position} />
              <span>{label}</span>
            </button>
          ))}
        </div>
        {sore ? (
          <section aria-label={t('checkin.sore.groups')} className="flex min-h-0 flex-col gap-2">
            <span className="type-caption text-muted-foreground">{t('checkin.sore.where')}</span>
            <div className="flex items-start gap-3">
              <div role="group" aria-label={t('checkin.sore.groups')} className="flex flex-1 flex-wrap gap-2">
                {SORE_CHIPS.map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    aria-pressed={chips.includes(chip.id)}
                    onClick={() => toggle(chip.id)}
                    className={cn('h-touch rounded-pill border px-4 type-label', chips.includes(chip.id) ? 'border-foreground bg-foreground text-background' : 'border-surface-border bg-surface-2 text-foreground')}
                  >
                    {t(CHIP_LABEL[chip.id])}
                  </button>
                ))}
              </div>
              <BodyFigure
                primary={[]}
                scale={0.55}
                label={names.length > 0 ? t('checkin.figure.some', { groups: names.join(', ') }) : t('checkin.figure.none')}
                paint={(keys) => (keys.some((key) => groupKeys.has(key)) ? 'fill-sand' : null)}
                className="shrink-0"
              />
            </div>
          </section>
        ) : null}
      </div>
      {sore ? (
        <div className="shrink-0 px-4 pt-3 pb-7">
          <NextButton onClick={() => onNext({ soreness: level as 1, soreGroups: groupsOf(chips) })} />
        </div>
      ) : null}
    </>
  )
}

/** Story i 5-të: gatishmëria me pjesët dhe, kur është e ulët, sugjerimi i seancës (rrjedha e V50). */
function Ready({
  view,
  state,
  readiness,
  suggestion,
  failed,
  onChoice,
}: {
  view: TodayView
  state: DailyState
  readiness: Readiness
  suggestion: ReturnType<typeof useSuggestion>
  failed: boolean
  onChoice: (action: () => Promise<unknown>) => Promise<void>
}) {
  const i18n = useI18n()
  const { t, fmt, lang } = i18n
  const [busy, setBusy] = useState(false)
  const level = levelLabel(t, readiness.level)
  const percent = fmt.number(readiness.percent)
  const line = readiness.level === 'low' ? t('sot.q.ready.low') : readiness.level === 'high' ? t('daymode.energetic') : t('sot.q.ready.normal')
  const plan = isTrainingMode(view) && view.workout ? view.snapshot?.plan : null
  const date = suggestion?.date ?? view.date
  const act = async (action: () => Promise<unknown>) => {
    setBusy(true)
    await onChoice(action)
    setBusy(false)
  }
  const cost = suggestion?.kind === 'suggest' ? costText(i18n, suggestion.cost) : ''
  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 pt-2">
        <section aria-label={t('readiness.sheet.aria', { percent, level })} className="flex flex-col gap-2">
          <span aria-hidden className="font-display text-[140px] leading-[0.85] font-extrabold -tracking-[0.02em] tabular-nums">
            {percent}%
          </span>
          <span aria-hidden className="flex items-center gap-2 text-[17px] leading-[1.3]">
            <span className={cn('size-2 rounded-pill', LEVEL_TONE[readiness.level])} />
            <span>
              <strong className="font-bold">{level}</strong> · {line}
            </span>
          </span>
        </section>
        {failed ? (
          <p role="alert" className="text-sm text-danger">
            {t('checkin.failed')}
          </p>
        ) : null}
        <section aria-labelledby="gati-pjeset">
          <h2 id="gati-pjeset" className="m-0 mb-1.5 type-label text-muted-foreground">
            {t('readiness.parts.title')}
          </h2>
          <ul className="m-0 flex list-none flex-col p-0">
            {readiness.parts.map((part) => (
              <li key={part.key} className="flex flex-col gap-2 border-t border-border py-2.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 text-[15px] leading-[1.3] font-semibold">
                    {t(PART[part.key])} <span className="text-[13px] font-normal text-muted-foreground">· {partValue(i18n, part, view, state)}</span>
                  </span>
                  <span className="shrink-0 text-[13px] text-muted-foreground tabular-nums">
                    <span className="font-display text-[22px] font-extrabold text-foreground">{Math.round(part.score)}</span> {t('readiness.points', { count: Math.round(part.score) }).replace(/^\d+\s*/, '')} · {fmt.number(Math.round(part.weight * 100))}%
                  </span>
                </div>
                <ProgressTrack ratio={part.score / 100} tone="data" ground="page" />
              </li>
            ))}
          </ul>
        </section>
        {suggestion?.kind === 'suggest' ? (
          <section aria-label={t('lighter.card')} className="mt-auto flex flex-col gap-2 pb-1.5">
            <p className="m-0 type-body">{whyText(i18n, suggestion.reasons)}</p>
            <Button variant="primary" tired size="lg" className="h-auto min-h-14 w-full flex-col gap-0.5 py-2" disabled={busy} onClick={() => void act(() => chooseLighter(store, date))}>
              <span>{t('lighter.title')}</span>
              {cost ? <span className="font-sans text-[13px] leading-[1.2] font-semibold tracking-normal normal-case tabular-nums">{cost}</span> : null}
            </Button>
            <Button variant="secondary" ground="page" size="lg" className="w-full" disabled={busy} onClick={() => void act(() => postponeWorkout(store, date))}>
              {t('lighter.postpone')}
            </Button>
            <Button variant="ghost" className="self-center font-sans text-[15px] font-semibold tracking-normal normal-case underline underline-offset-[3px]" disabled={busy} onClick={() => void act(() => keepUsual(store, date))}>
              {t('lighter.skip')}
            </Button>
          </section>
        ) : null}
      </div>
      {plan ? (
        <p className="m-0 shrink-0 px-4 pb-7 text-center text-[13px] text-muted-foreground">
          {t('sot.q.workout', { name: capitalize(programDayName(t, plan.dayName), lang), count: view.workout?.exercises ?? 0 })}
        </p>
      ) : (
        <div className="h-7 shrink-0" />
      )}
    </>
  )
}
