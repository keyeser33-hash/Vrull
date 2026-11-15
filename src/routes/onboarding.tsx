import { useId, useState } from 'react'
import { useNavigate, useOutlet, useSearchParams } from 'react-router'
import { DayPicker } from '@/components/forms/day-picker'
import { Sheet } from '@/components/layout/sheet'
import { Button } from '@/components/ui/button'
import { Icon, type IconName } from '@/components/ui/icons'
import { surfaceClass } from '@/components/ui/surface'
import { store } from '@/data/app-data'
import { chooseLanguage } from '@/data/language'
import { completeOnboarding, DEFAULT_PROFILE, isTime, parseWeight } from '@/data/profile'
import { EMPTY_TARGETS_PROFILE, isComplete, personalTargets, saveTargetsProfile, type TargetsInput } from '@/data/targets-profile'
import type { MessageKey } from '@/i18n'
import { programBlockName } from '@/i18n/domain'
import { LANGUAGE_NAMES, LANGUAGES, LOCALES } from '@/i18n/language'
import { useI18n } from '@/i18n/use-i18n'
import { localDate } from '@/lib/calendar'
import { cn } from '@/lib/cn'
import type { Sex } from '@/nutrition/calculator'
import { addMinutes, parseTimeInput } from '@/lib/time'
import { SHORTCUT_TO_SIZE } from '@/program/shortcut-to-size'
import { Segmented } from './builder-parts'
import { ONBOARDING_BUILD, type OnboardingBuild } from './editor-nav'
import { DEFAULT_GOAL, GOAL_ORDER } from './targets-format'
import { ActivityPicker } from './targets-parts'

// Hapat e parë (SPEC §3a, V2-E1-17; bordet "Gjuha dhe pesha", "Ditët dhe oraret", "Programi"): katër
// hapa në tri ekrane, ditët dhe oraret bashkë si hapat 2 dhe 3. Ekrani është në adresë (`?hapi=`) dhe
// zëvendësohet pa shtuar histori, që pas hapave butoni mbrapa i Android-it te Sot të mos kalojë nëpër
// hapat e mbyllur; fleta e orës (`&ora=`) shton një hap historie, që butoni mbrapa ta mbyllë. Çdo vlerë
// ndryshohet më vonë te Cilësimet; lejet e njoftimeve nuk kërkohen këtu. "Ndërto timin" (V2-E1-10) hap
// ndërtuesin brenda kësaj faqeje (`/fillimi/programi/…`, rrugët fëmijë te router.tsx), që pesha, ditët
// dhe oraret të mbeten këtu deri te "Ruaj programin", që i mbyll hapat me programin e ndërtuar.

type Screen = 'gjuha' | 'ditet' | 'objektivat' | 'programi'
type TimeKey = 'fillimi' | 'zgjimi' | 'gjumi'
type Times = Record<TimeKey, string>

const STEPS = 5
/** Hapat e çdo ekrani, për rreshtin "Hapi 1 nga 5" dhe shiritin e përparimit. */
const SCREEN_STEPS: Record<Screen, readonly number[]> = { gjuha: [1], ditet: [2, 3], objektivat: [4], programi: [5] }
const PREVIOUS: Record<Screen, Screen | null> = { gjuha: null, ditet: 'gjuha', objektivat: 'ditet', programi: 'objektivat' }
const isScreen = (value: string | null): value is Screen => value !== null && Object.hasOwn(SCREEN_STEPS, value)
const isTimeKey = (value: string | null): value is TimeKey => value === 'fillimi' || value === 'zgjimi' || value === 'gjumi'

const WEIGHT_STEP = 0.5
const WEIGHT_START = 80
const TIME_STEP = 15
const TIME_LABELS: Record<TimeKey, MessageKey> = { fillimi: 'profile.trainingTime', zgjimi: 'profile.wake', gjumi: 'profile.sleep' }

// Shortcut to Size si e thotë karta: Java 0, pastaj fazat; stërvitjet në javë janë ditët e programit.
const STS_AUTHOR = 'Jim Stoppani'
const [STS_WEEK_0, ...STS_PHASES] = [...SHORTCUT_TO_SIZE.program.blocks].sort((a, b) => a.position - b.position)
const STS_PHASE_WEEKS = STS_PHASES.reduce((sum, block) => sum + block.weeks, 0)
const STS_WEEKS = STS_WEEK_0.weeks + STS_PHASE_WEEKS
const STS_WORKOUTS = SHORTCUT_TO_SIZE.program.days.length
/** Pamja e modelit 3D të app-it me volumin e një jave të programit (public/anatomy/LICENSE.txt). */
const STS_IMAGE = '/anatomy/shortcut-to-size.webp'

/**
 * Mënyrat e tjera të nisjes, poshtë "Ose nis vetë": "Ndërto timin" (E1-10) dhe "Importo nga PDF" (E1-11).
 * Para profilit porta (gate.tsx) lejon vetëm `/fillimi` dhe adresat nën të, ndaj `to` është një adresë
 * brenda hapave (`/fillimi/…`). Pa asnjë, seksioni nuk shfaqet.
 */
const OWN_STARTS: readonly { to: string; icon: IconName; title: MessageKey; text: MessageKey }[] = [
  { to: ONBOARDING_BUILD, icon: 'nderto', title: 'builder.onboarding.title', text: 'builder.onboarding.text' },
  { to: '/fillimi/importo', icon: 'skedari', title: 'ai.entry.import', text: 'ai.entry.importText' },
]

export function OnboardingPage() {
  const { t } = useI18n()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const [weight, setWeight] = useState<number | null>(null)
  const [weightProblem, setWeightProblem] = useState(false)
  const [days, setDays] = useState<number[]>(DEFAULT_PROFILE.trainingDays)
  const [times, setTimes] = useState<Times>({
    fillimi: DEFAULT_PROFILE.trainingTime,
    zgjimi: DEFAULT_PROFILE.wakeTime,
    gjumi: DEFAULT_PROFILE.sleepTime,
  })
  const [targets, setTargets] = useState<TargetsInput>({ ...EMPTY_TARGETS_PROFILE, goal: DEFAULT_GOAL })
  const [problem, setProblem] = useState<MessageKey | null>(null)
  const [busy, setBusy] = useState(false)

  const weightValid = weight !== null && parseWeight(String(weight)) !== null
  const profile = () => ({ weightKg: weight!, trainingDays: days, trainingTime: times.fillimi, wakeTime: times.zgjimi, sleepTime: times.gjumi })
  // "Ndërto timin": ndërtuesi brenda hapave; "Ruaj programin" i mbyll me programin e ndërtuar si aktiv.
  // Pa peshë (p.sh. app-i u rihap në mes të ndërtimit) hapat nisin nga e para; drafti mbetet te Programet.
  const build: OnboardingBuild = {
    finish: async (programId) => {
      if (!weightValid) {
        navigate('/fillimi', { replace: true })
        return
      }
      await finish(programId)
    },
  }
  const child = useOutlet(build)
  // Objektivat e hapit 4 ruhen vetëm kur janë të plota; "Më vonë" i lë te plani i Jimit (V32).
  async function finish(programId?: string) {
    await completeOnboarding(store, profile(), undefined, programId)
    if (isComplete(targets)) await saveTargetsProfile(store, targets, localDate(new Date()))
  }
  // Pa peshë të vlefshme (p.sh. kur app-i rihapet në mes) hapat nisin nga e para.
  const requested = params.get('hapi')
  const screen: Screen = weightValid && isScreen(requested) ? requested : 'gjuha'
  const sheet = screen === 'ditet' && isTimeKey(params.get('ora')) ? (params.get('ora') as TimeKey) : null
  const steps = SCREEN_STEPS[screen]

  const go = (next: Screen) => {
    setProblem(null)
    setParams({ hapi: next }, { replace: true })
  }
  const previous = PREVIOUS[screen]

  function changeWeight(next: number | null) {
    setWeight(next === null ? null : Math.round(next * 100) / 100)
    setWeightProblem(false)
  }

  async function next() {
    if (screen === 'gjuha') {
      if (!weightValid) return setWeightProblem(true)
      return go('ditet')
    }
    if (screen === 'ditet') {
      if (days.length === 0) return setProblem('profile.daysInvalid')
      return go('objektivat')
    }
    if (screen === 'objektivat') return go('programi')
    setBusy(true)
    setProblem(null)
    try {
      await finish()
      // Porta (gate.tsx) e sheh profilin e plotësuar dhe e hap Sot vetë.
    } catch {
      setProblem('entry.saveFailed')
      setBusy(false)
    }
  }

  const stepText = steps.length === 1 ? t('entry.steps.one', { step: steps[0], total: STEPS }) : t('entry.steps.two', { first: steps[0], second: steps[1], total: STEPS })
  const last = steps[steps.length - 1]

  if (child) {
    // Ndërtuesi, me kornizën e ekraneve pa tab-bar (si AppShell).
    return (
      <div className="relative isolate min-h-dvh bg-background pt-[var(--safe-top)] text-foreground">
        <div aria-hidden className="fixed inset-x-0 top-0 z-30 h-[var(--safe-top)] bg-background" />
        <main className="mx-auto w-full max-w-[480px] px-4 pt-5 pb-[calc(var(--safe-bottom)+24px)]">{child}</main>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background pt-[var(--safe-top)] pb-[var(--safe-bottom)] text-foreground">
      <div aria-hidden className="fixed inset-x-0 top-0 z-30 h-[var(--safe-top)] bg-background" />
      <div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col">
        <header className="flex shrink-0 flex-col gap-2.5">
          <div className={cn('flex h-14 items-center gap-1', previous ? 'px-2' : 'px-4')}>
            {previous ? (
              <Button variant="ghost" size="icon" aria-label={t('common.back')} className="rounded-pill" onClick={() => go(previous)}>
                <Icon name="mbrapa" size={22} />
              </Button>
            ) : null}
            <span className="type-caption text-muted-foreground tabular-nums">{stepText}</span>
            {screen === 'objektivat' ? (
              <Button
                variant="ghost"
                className="ml-auto text-muted-foreground"
                onClick={() => {
                  setTargets({ ...EMPTY_TARGETS_PROFILE, goal: DEFAULT_GOAL })
                  go('programi')
                }}
              >
                {t('entry.targets.later')}
              </Button>
            ) : null}
          </div>
          <div
            role="progressbar"
            aria-label={t('entry.steps.label')}
            aria-valuemin={1}
            aria-valuemax={STEPS}
            aria-valuenow={last}
            aria-valuetext={stepText}
            className="grid grid-cols-5 gap-1.5 px-4"
          >
            {Array.from({ length: STEPS }, (_, index) => (
              <span key={index} className={cn('h-1 rounded-pill', index < last ? 'bg-ember' : 'bg-track')} />
            ))}
          </div>
        </header>

        <main className={cn('flex flex-1 flex-col px-4 pt-6', screen === 'programi' ? 'gap-4' : 'gap-7')}>
          {screen === 'gjuha' ? <LanguageAndWeight weight={weight} invalid={weightProblem} onWeight={changeWeight} /> : null}
          {screen === 'ditet' ? (
            <DaysAndTimes days={days} times={times} onDays={(next) => (setDays(next), setProblem(null))} onOpenTime={(key) => setParams({ hapi: 'ditet', ora: key })} />
          ) : null}
          {screen === 'objektivat' ? <TargetsStep targets={targets} weightKg={weight!} sessionsPerWeek={days.length} onChange={setTargets} /> : null}
          {screen === 'programi' ? <ChooseProgramme /> : null}
        </main>

        <footer className="shrink-0 px-4 pt-3 pb-6">
          {problem ? (
            <p role="alert" className="mb-3 flex items-start gap-2 type-caption text-danger">
              <Icon name="paralajmerim" size={18} />
              {t(problem)}
            </p>
          ) : null}
          <Button variant="primary" size="xl" disabled={busy} onClick={() => void next()}>
            {screen !== 'programi' ? t('entry.continue') : t(busy ? 'entry.programme.saving' : 'entry.programme.start')}
          </Button>
        </footer>
      </div>

      {sheet ? (
        <TimeSheet
          title={t(TIME_LABELS[sheet])}
          value={times[sheet]}
          onClose={() => navigate(-1)}
          onSave={(value) => {
            setTimes((current) => ({ ...current, [sheet]: value }))
            navigate(-1)
          }}
        />
      ) : null}
    </div>
  )
}

/** Hapi 1: gjuha (ndryshon menjëherë tekstet) dhe pesha e sotme, me numrin e madh që shkruhet ose ndryshon me 0,5 kg. */
function LanguageAndWeight({ weight, invalid, onWeight }: { weight: number | null; invalid: boolean; onWeight: (weight: number | null) => void }) {
  const { t, fmt, lang } = useI18n()
  const legend = useId()
  const inputId = useId()
  const hintId = useId()
  const errorId = useId()
  // Teksti gjatë shkrimit; jashtë fokusit numri shfaqet sipas gjuhës (80,5 / 80.5).
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft ?? (weight === null ? '' : fmt.number(weight, { minDigits: 1 }))

  function commit() {
    if (draft === null) return
    const text = draft.trim()
    const parsed = Number(text.replace(',', '.'))
    if (!text) onWeight(null)
    else if (Number.isFinite(parsed)) onWeight(parsed)
    setDraft(null)
  }

  const step = (delta: number) => onWeight(weight === null ? WEIGHT_START : weight + delta)

  return (
    <>
      <h1 className="type-display-m">{t('entry.language.title')}</h1>

      <div role="group" aria-labelledby={legend} className="flex flex-col gap-2.5">
        <h2 id={legend} className="type-label text-muted-foreground">
          {t('settings.language')}
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {LANGUAGES.map((option) => {
            const pressed = lang === option
            return (
              <button
                key={option}
                type="button"
                lang={LOCALES[option]}
                aria-pressed={pressed}
                onClick={() => void chooseLanguage(store, option)}
                className={cn(
                  'flex h-14 items-center justify-center gap-2 rounded-md border font-display text-[22px] font-bold uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground',
                  pressed ? 'border-foreground bg-foreground text-background' : 'border-subtle bg-surface text-foreground',
                )}
              >
                {pressed ? <Icon name="zgjedhur" size={20} /> : null}
                {LANGUAGE_NAMES[option]}
              </button>
            )
          })}
        </div>
      </div>

      <div className={cn(surfaceClass, 'flex flex-col gap-4 rounded-xl p-4')}>
        <label htmlFor={inputId} className="type-label text-muted-foreground">
          {t('settings.weightToday')}
        </label>
        <div className="flex flex-col items-center gap-1.5">
          <input
            id={inputId}
            inputMode="decimal"
            autoComplete="off"
            enterKeyHint="done"
            placeholder="–"
            value={shown}
            aria-invalid={invalid ? true : undefined}
            aria-describedby={invalid ? `${errorId} ${hintId}` : hintId}
            onFocus={(event) => {
              setDraft(shown)
              event.currentTarget.select()
            }}
            onChange={(event) => setDraft(event.currentTarget.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                event.currentTarget.blur()
              }
            }}
            className={cn('h-[100px] w-full min-w-0 rounded-md bg-transparent text-center type-display-hero', invalid && 'text-danger')}
          />
          <span id={hintId} className="type-body text-muted-foreground">
            {weight === null ? t('entry.weight.hintEmpty') : t('entry.weight.hint')}
          </span>
          {invalid ? (
            <span id={errorId} className="text-center type-caption text-danger">
              {t('profile.weightInvalid')}
            </span>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" size="xl" aria-label={t('ui.stepper.lowerWeight', { step: WEIGHT_STEP })} onClick={() => step(-WEIGHT_STEP)}>
            {`−${fmt.number(WEIGHT_STEP)}`}
          </Button>
          <Button variant="secondary" size="xl" aria-label={t('ui.stepper.raiseWeight', { step: WEIGHT_STEP })} onClick={() => step(WEIGHT_STEP)}>
            {`+${fmt.number(WEIGHT_STEP)}`}
          </Button>
        </div>
      </div>

      <p className="type-caption text-muted-foreground">{t('entry.weight.note')}</p>
    </>
  )
}

/** Hapat 2 dhe 3: ditët e stërvitjes, ora e stërvitjes (e njëjta për çdo ditë), zgjimi dhe gjumi. */
function DaysAndTimes({ days, times, onDays, onOpenTime }: { days: number[]; times: Times; onDays: (days: number[]) => void; onOpenTime: (key: TimeKey) => void }) {
  const { t } = useI18n()
  const daysLabel = useId()
  const daysHint = useId()
  const trainingTitle = useId()
  const restTitle = useId()

  const count = days.length
  const hint =
    count === 0
      ? t('profile.daysInvalid')
      : count === STS_WORKOUTS
        ? t('entry.days.match', { count, programme: SHORTCUT_TO_SIZE.name })
        : t(count < STS_WORKOUTS ? 'entry.days.fewer' : 'entry.days.more', { count, workouts: STS_WORKOUTS, weeks: STS_WEEKS })

  return (
    <>
      <h1 className="type-display-m">{t('entry.days.title')}</h1>

      <div className="flex flex-col gap-2.5">
        <h2 id={daysLabel} className="type-label text-muted-foreground">
          {t('settings.trainingDays')}
        </h2>
        <DayPicker value={days} onChange={onDays} labelledBy={daysLabel} describedBy={daysHint} dayLabel={(day) => t(`entry.days.letter.${day}` as 'entry.days.letter.1')} />
        <p id={daysHint} className="type-caption text-muted-foreground tabular-nums">
          {hint}
        </p>
      </div>

      <section aria-labelledby={trainingTitle} className="flex flex-col gap-2.5">
        <h2 id={trainingTitle} className="type-label text-muted-foreground">
          {t('profile.trainingTime')}
        </h2>
        <div className={cn(surfaceClass, 'overflow-hidden rounded-lg')}>
          <TimeRow label={t('entry.times.start')} detail={t('entry.times.startDetail', { count })} value={times.fillimi} onClick={() => onOpenTime('fillimi')} />
        </div>
      </section>

      <section aria-labelledby={restTitle} className="flex flex-col gap-2.5">
        <h2 id={restTitle} className="type-label text-muted-foreground">
          {t('entry.times.wakeSleep')}
        </h2>
        <div className={cn(surfaceClass, 'flex flex-col divide-y divide-border overflow-hidden rounded-lg')}>
          <TimeRow label={t('profile.wake')} value={times.zgjimi} onClick={() => onOpenTime('zgjimi')} />
          <TimeRow label={t('profile.sleep')} value={times.gjumi} onClick={() => onOpenTime('gjumi')} />
        </div>
        <p className="type-caption text-muted-foreground">{t('entry.times.note')}</p>
      </section>
    </>
  )
}

/** Rreshti i një ore: emri (dhe fjalia poshtë) majtas, ora e madhe djathtas; e gjithë rreshti hap fletën. */
function TimeRow({ label, detail, value, onClick }: { label: string; detail?: string; value: string; onClick: () => void }) {
  const detailId = useId()
  return (
    <button
      type="button"
      aria-label={`${label}, ${value}`}
      aria-describedby={detail ? detailId : undefined}
      onClick={onClick}
      className={cn('flex w-full items-center justify-between gap-3 py-2 pr-3.5 pl-4 text-left', detail ? 'min-h-[72px] py-3' : 'min-h-row')}
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="type-body-strong">{label}</span>
        {detail ? (
          <span id={detailId} className="type-caption text-muted-foreground">
            {detail}
          </span>
        ) : null}
      </span>
      <span className="shrink-0 type-display-s tabular-nums">{value}</span>
    </button>
  )
}

/** Fleta e një ore: ora e madhe (24 orë) që shkruhet ("1930", "7", "6.45") ose ndryshon me 15 minuta. */
function TimeSheet({
  title,
  value,
  onClose,
  onSave,
}: {
  title: string
  value: string
  onClose: () => void
  onSave: (value: string) => void
}) {
  const { t, fmt } = useI18n()
  const inputId = useId()
  const hintId = useId()
  const [time, setTime] = useState(value)
  const [draft, setDraft] = useState<string | null>(null)

  function commit() {
    if (draft === null) return
    const parsed = parseTimeInput(draft)
    if (parsed) setTime(parsed)
    setDraft(null)
  }

  const footer = (
    <Button variant="primary" size="xl" disabled={!isTime(time)} onClick={() => onSave(time)}>
      {t('common.save')}
    </Button>
  )
  return (
    <Sheet title={title} onClose={onClose} footer={footer}>
      <div className="flex flex-col items-center gap-1.5">
        <label htmlFor={inputId} className="sr-only">
          {title}
        </label>
        <input
          id={inputId}
          inputMode="numeric"
          autoComplete="off"
          enterKeyHint="done"
          value={draft ?? time}
          aria-describedby={hintId}
          onFocus={(event) => {
            setDraft(time)
            event.currentTarget.select()
          }}
          onChange={(event) => setDraft(event.currentTarget.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              event.currentTarget.blur()
            }
          }}
          className="h-[88px] w-full min-w-0 rounded-md bg-transparent text-center type-display-xl"
        />
        <span id={hintId} className="type-body text-muted-foreground">
          {t('entry.times.hint')}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" size="xl" aria-label={t('form.time.earlier', { label: title, minutes: TIME_STEP })} onClick={() => setTime(addMinutes(time, -TIME_STEP))}>
          {`−${fmt.unit(TIME_STEP, 'min')}`}
        </Button>
        <Button variant="secondary" size="xl" aria-label={t('form.time.later', { label: title, minutes: TIME_STEP })} onClick={() => setTime(addMinutes(time, TIME_STEP))}>
          {`+${fmt.unit(TIME_STEP, 'min')}`}
        </Button>
      </div>
    </Sheet>
  )
}

/** Hapi 4: programi. Sot vetëm Shortcut to Size; programet e ndara nga miqtë vijnë me Etapën 4. */
function ChooseProgramme() {
  const { t } = useI18n()
  const ownTitle = useId()
  const firstBlock = programBlockName(t, STS_WEEK_0.name)
  return (
    <>
      <h1 className="type-display-m">{t('entry.programme.title')}</h1>

      <div role="radiogroup" aria-label={t('tab.programme')} className="flex flex-col gap-2">
        <button
          type="button"
          role="radio"
          aria-checked
          className="relative flex min-h-[220px] w-full flex-col items-start gap-2 overflow-hidden rounded-xl border-2 border-foreground bg-surface p-4 text-left"
        >
          <img src={STS_IMAGE} alt="" aria-hidden className="pointer-events-none absolute top-2.5 -right-11 h-60 w-auto opacity-90" />
          <span className="relative flex items-center gap-2">
            <span aria-hidden className="flex size-6 items-center justify-center rounded-pill bg-foreground text-background">
              <Icon name="zgjedhur" size={16} />
            </span>
            <span className="flex h-7 items-center rounded-pill bg-surface-2 px-2.5 text-[13px] leading-[1.2] font-semibold">{t('entry.programme.recommended')}</span>
          </span>
          <span className="relative mt-1 max-w-[200px] type-display-s">{SHORTCUT_TO_SIZE.name}</span>
          <span className="relative max-w-[210px] type-caption text-muted-foreground tabular-nums">
            {t('entry.programme.stsMeta', { weeks: STS_PHASE_WEEKS, firstBlock, author: STS_AUTHOR })}
          </span>
          <span className="relative max-w-[196px] type-body tabular-nums">
            {t('entry.programme.stsText', { firstBlock, phases: STS_PHASES.length, phaseWeeks: STS_PHASES[0].weeks, workouts: STS_WORKOUTS })}
          </span>
        </button>
      </div>

      {OWN_STARTS.length > 0 ? (
        <section aria-labelledby={ownTitle} className="flex flex-col gap-2.5">
          <h2 id={ownTitle} className="type-label text-muted-foreground">
            {t('entry.programme.orStartOwn')}
          </h2>
          <OwnStarts />
        </section>
      ) : null}

      <p className="type-caption text-muted-foreground">{t('entry.programme.footnote', { firstBlock })}</p>
    </>
  )
}

/** "Ndërto timin" dhe "Importo nga PDF" si pllaka (bordi "Programi"). */
function OwnStarts() {
  const { t } = useI18n()
  const navigate = useNavigate()
  return (
    <div className="grid grid-cols-2 gap-2">
      {OWN_STARTS.map((option) => (
        <button
          key={option.to}
          type="button"
          onClick={() => navigate(option.to)}
          className={cn(surfaceClass, 'flex min-h-[100px] flex-col items-start justify-between gap-3 rounded-lg p-3.5 text-left')}
        >
          <Icon name={option.icon} size={24} />
          <span className="flex flex-col gap-1">
            <span className="type-title">{t(option.title)}</span>
            <span className="type-caption text-muted-foreground">{t(option.text)}</span>
          </span>
        </button>
      ))}
    </div>
  )
}

/**
 * Hapi 4 (V32, bordi "Hapat e parë · Objektivat"): gjinia, viti i lindjes, gjatësia, aktiviteti dhe
 * qëllimi, me objektivat që dalin menjëherë. Pesha vjen nga hapi 1, seancat nga ditët e hapit 2.
 */
function TargetsStep({ targets, weightKg, sessionsPerWeek, onChange }: { targets: TargetsInput; weightKg: number; sessionsPerWeek: number; onChange: (next: TargetsInput) => void }) {
  const { t, fmt } = useI18n()
  const yearId = useId()
  const heightId = useId()
  const [yearText, setYearText] = useState(targets.birthYear === null ? '' : String(targets.birthYear))
  const [heightText, setHeightText] = useState(targets.heightCm === null ? '' : String(targets.heightCm))
  const [today] = useState(() => localDate(new Date()))
  const year = Number(today.slice(0, 4))
  const set = (patch: Partial<TargetsInput>) => onChange({ ...targets, ...patch })
  const result = personalTargets(targets, { weightKg, sessionsPerWeek, date: today })
  const fieldClass = 'h-[50px] w-full rounded-md border border-border bg-surface-2 px-3 font-display text-[22px] font-extrabold tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <h1 className="type-display-m">{t('entry.targets.title')}</h1>
        <p className="type-body text-muted-foreground">{t('entry.targets.text')}</p>
      </div>
      <div className="grid grid-cols-[1.1fr_1fr_1fr] items-end gap-2">
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] text-muted-foreground">{t('food.targets.sex')}</span>
          <Segmented<Sex>
            label={t('food.targets.sex')}
            value={targets.sex ?? ('' as Sex)}
            onChange={(sex) => set({ sex })}
            options={[
              { value: 'male', label: t('food.targets.male') },
              { value: 'female', label: t('food.targets.female') },
            ]}
          />
        </div>
        <label htmlFor={yearId} className="flex flex-col gap-1.5 text-[13px] text-muted-foreground">
          {t('food.targets.birthYear')}
          <input
            id={yearId}
            inputMode="numeric"
            maxLength={4}
            placeholder={String(year - 30)}
            value={yearText}
            onChange={(event) => {
              const next = event.target.value.replace(/\D/g, '')
              setYearText(next)
              const parsed = Number(next)
              set({ birthYear: next.length === 4 && parsed >= year - 100 && parsed <= year - 14 ? parsed : null })
            }}
            className={fieldClass}
          />
        </label>
        <label htmlFor={heightId} className="flex flex-col gap-1.5 text-[13px] text-muted-foreground">
          {t('entry.targets.height')}
          <input
            id={heightId}
            inputMode="numeric"
            maxLength={3}
            placeholder="175"
            value={heightText}
            onChange={(event) => {
              const next = event.target.value.replace(/\D/g, '')
              setHeightText(next)
              const parsed = Number(next)
              set({ heightCm: parsed >= 120 && parsed <= 230 ? parsed : null })
            }}
            className={fieldClass}
          />
        </label>
      </div>
      <ActivityPicker
        columns={2}
        legend={<span className="text-[13px] text-muted-foreground">{t('entry.targets.activity')}</span>}
        value={targets.activity}
        onChange={(activity) => set({ activity })}
      />
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] text-muted-foreground">{t('food.targets.goal')}</span>
        <Segmented
          label={t('food.targets.goal')}
          value={targets.goal ?? DEFAULT_GOAL}
          onChange={(goal) => set({ goal, ratePct: null })}
          options={GOAL_ORDER.map((value) => ({ value, label: t(`food.targets.goal.${value}`) }))}
        />
      </div>
      {result ? (
        <section aria-label={t('entry.targets.title')} className="grid grid-cols-3 gap-2 rounded-lg border border-border bg-surface p-3.5 tabular-nums">
          {[
            { label: t('food.targets.trainingShort'), value: fmt.number(result.training.kcal), unit: 'kcal' },
            { label: t('food.targets.restShort'), value: fmt.number(result.rest.kcal), unit: 'kcal' },
            { label: t('food.protein'), value: fmt.unit(result.rest.proteinG, 'g'), unit: t('entry.targets.everyDay') },
          ].map((item, index) => (
            <span key={item.label} className={cn('flex flex-col gap-0.5', index > 0 && 'border-l border-border pl-2.5')}>
              <span className="text-xs text-muted-foreground">{item.label}</span>
              <span className="font-display text-[30px] leading-none font-extrabold">{item.value}</span>
              <span className="text-xs text-muted-foreground">{item.unit}</span>
            </span>
          ))}
        </section>
      ) : null}
      <p className="text-[13px] leading-[1.4] text-muted-foreground">{t('entry.targets.note', { weight: weightKg })}</p>
    </div>
  )
}
