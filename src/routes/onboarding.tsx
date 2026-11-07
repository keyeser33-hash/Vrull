import { type ReactNode, useId, useState } from 'react'
import { BodyFigure } from '@/components/body/body-figure'
import { DayPicker } from '@/components/forms/day-picker'
import { TimeStepper } from '@/components/forms/time-stepper'
import { ValueStepper } from '@/components/forms/value-stepper'
import { WEEK_DAYS } from '@/components/forms/week-days'
import { FocusLayout } from '@/components/layout/focus-layout'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button-variants'
import { Icon } from '@/components/ui/icons'
import { store } from '@/data/app-data'
import { completeOnboarding, DEFAULT_PROFILE, isTime, parseWeight } from '@/data/profile'
import { firstWeek } from '@/program/schedule'
import { SHORTCUT_TO_SIZE } from '@/program/shortcut-to-size'
import { cn } from '@/lib/cn'
import { kg } from './training-format'

// Hapat e hyrjes së parë (SPEC §3a, hapat 2–5): pesha, stërvitja, orari, programi. Varianti A
// i aprovuar më 07.11.2026: një vlerë e madhe me − dhe + në çdo hap, si te seanca; oraret
// gjithmonë 24 orë. Çdo vlerë ndryshohet më vonë te Cilësimet. Lejet e njoftimeve nuk kërkohen këtu.

const STEPS = 4
const WEIGHT_STEP = 0.5
const WEIGHT_START = 80

const STS_DAYS = [...SHORTCUT_TO_SIZE.program.days].sort((a, b) => a.position - b.position).map((day) => day.name)
const STS_BLOCKS = [...SHORTCUT_TO_SIZE.program.blocks].sort((a, b) => a.position - b.position)
const BLOCK_NOTES: Record<string, string> = {
  'Java 0': 'Teknika dhe gjetja e peshave, pa dështim',
  'Faza 1': 'Përsëritjet ulen çdo javë, pesha rritet',
  'Faza 2': 'Ushtrime të reja ndihmëse, më shumë peshë',
  'Faza 3': 'Faza e fundit, peshat më të larta',
}
// Muskujt e të gjithë programit, gri: figura e hapit të fundit (pa amber, që nuk është veprim).
const ALL_MUSCLES = [...new Set(SHORTCUT_TO_SIZE.exercises.flatMap((exercise) => exercise.primary))]

function Progress({ step }: { step: number }) {
  return (
    <div>
      <p className="text-sm leading-5 text-muted-foreground tabular-nums">
        Hapi {step + 1} nga {STEPS}
      </p>
      <div aria-hidden className="mt-2 grid grid-cols-4 gap-1.5">
        {Array.from({ length: STEPS }, (_, index) => (
          <span key={index} className={cn('h-1 rounded-full', index <= step ? 'bg-brand' : 'bg-chart-track')} />
        ))}
      </div>
    </div>
  )
}

function StepTitle({ children, lead }: { children: ReactNode; lead: ReactNode }) {
  return (
    <div className="mt-8 mb-8">
      <h1 className="text-3xl font-semibold tracking-tight">{children}</h1>
      <p className="mt-2 text-base leading-6 text-muted-foreground">{lead}</p>
    </div>
  )
}

export function OnboardingPage() {
  const daysLabel = useId()
  const daysHint = useId()
  const weightError = useId()
  const weekId = useId()
  const [step, setStep] = useState(0)
  const [weight, setWeight] = useState<number | null>(null)
  const [weightText, setWeightText] = useState('')
  const [days, setDays] = useState<number[]>(DEFAULT_PROFILE.trainingDays)
  const [trainingTime, setTrainingTime] = useState(DEFAULT_PROFILE.trainingTime)
  const [wakeTime, setWakeTime] = useState(DEFAULT_PROFILE.wakeTime)
  const [sleepTime, setSleepTime] = useState(DEFAULT_PROFILE.sleepTime)
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function setWeightValue(value: number) {
    const rounded = Math.round(value * 100) / 100
    setWeight(rounded)
    setWeightText(kg(rounded))
    setProblem(null)
  }

  function validate(): string | null {
    if (step === 0 && (weight === null || parseWeight(String(weight)) === null)) {
      return 'Shkruaj një peshë mes 30 dhe 300 kg, p.sh. 80,5.'
    }
    if (step === 1 && days.length === 0) return 'Zgjidh të paktën një ditë stërvitjeje.'
    if (step === 1 && !isTime(trainingTime)) return 'Zgjidh orën e stërvitjes.'
    if (step === 2 && (!isTime(wakeTime) || !isTime(sleepTime))) return 'Zgjidh orën e zgjimit dhe të gjumit.'
    return null
  }

  async function next() {
    const error = validate()
    setProblem(error)
    if (error) return
    if (step < STEPS - 1) {
      setStep(step + 1)
      return
    }
    setBusy(true)
    try {
      await completeOnboarding(store, { weightKg: weight!, trainingDays: days, trainingTime, wakeTime, sleepTime })
      // Porta (gate.tsx) e sheh profilin e plotësuar dhe e hap Sot vetë.
    } catch {
      setProblem('Ruajtja nuk u krye. Provo përsëri.')
      setBusy(false)
    }
  }

  const footer = (
    <>
      {problem && step !== 0 ? (
        <p role="alert" className="mb-3 text-sm leading-5 text-destructive">
          {problem}
        </p>
      ) : null}
      <Button variant="brand" size="xl" disabled={busy} onClick={() => void next()}>
        {step === STEPS - 1 ? (busy ? 'Po ruhet' : 'Fillo programin') : 'Vazhdo'}
      </Button>
    </>
  )

  const week = firstWeek(days, STS_DAYS.length)

  return (
    <FocusLayout footer={footer}>
      <div className="flex min-h-11 items-center">
        {step > 0 ? (
          <button
            type="button"
            aria-label="Kthehu te hapi i mëparshëm"
            onClick={() => {
              setProblem(null)
              setStep(step - 1)
            }}
            className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), '-ml-3')}
          >
            <Icon name="chevron-majtas" size={22} />
          </button>
        ) : null}
      </div>
      <Progress step={step} />

      {step === 0 ? (
        <>
          <StepTitle lead="Përdoret për objektivat e ushqimit. E ndryshon kur të duash te Cilësimet.">
            Sa peshon sot?
          </StepTitle>
          <ValueStepper
            variant="hero"
            label="Pesha"
            text={weightText}
            unit="kg"
            placeholder="80,5"
            inputMode="decimal"
            minusLabel={`Ul peshën me ${kg(WEIGHT_STEP)} kg`}
            plusLabel={`Rrit peshën me ${kg(WEIGHT_STEP)} kg`}
            onMinus={() => setWeightValue(weight === null ? WEIGHT_START : weight - WEIGHT_STEP)}
            onPlus={() => setWeightValue(weight === null ? WEIGHT_START : weight + WEIGHT_STEP)}
            onCommit={(text) => {
              const parsed = Number(text.trim().replace(',', '.'))
              if (text.trim() && Number.isFinite(parsed)) setWeightValue(parsed)
            }}
            invalid={Boolean(problem)}
            describedBy={problem ? weightError : undefined}
          />
          {problem ? (
            <p id={weightError} className="mt-3 text-center text-sm leading-5 text-destructive">
              {problem}
            </p>
          ) : null}
        </>
      ) : null}

      {step === 1 ? (
        <>
          <StepTitle lead="Shortcut to Size ka 4 stërvitje në javë. Radha ecën vetëm kur mbyll një stërvitje.">
            Kur stërvitesh?
          </StepTitle>
          <p id={daysLabel} className="mb-1.5 text-sm leading-5 font-medium">
            Ditët e stërvitjes
          </p>
          <DayPicker value={days} onChange={setDays} labelledBy={daysLabel} describedBy={daysHint} />
          <p id={daysHint} className="mt-1.5 text-sm leading-5 text-muted-foreground tabular-nums">
            {days.length === 4
              ? '4 ditë në javë, si programi.'
              : `${days.length} ditë në javë. Me më pak se 4, programi zgjat më shumë se 13 javë.`}
          </p>
          {week.length > 0 ? (
            <ul aria-label="Java e parë" className="mt-3">
              {week.map(({ day, workout }) => (
                <li key={day} className="flex min-h-11 items-center gap-3 border-t border-border-subtle text-sm leading-5">
                  <span className="w-20 shrink-0 font-medium">{WEEK_DAYS.find((entry) => entry.value === day)?.name}</span>
                  <span className="text-muted-foreground">
                    Stërvitja {workout} · {STS_DAYS[workout - 1]}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-8">
            <TimeStepper label="Ora e zakonshme e stërvitjes" short="Ora e stërvitjes" value={trainingTime} onChange={setTrainingTime} />
          </div>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <StepTitle lead="Rikujtuesit e vakteve dhe të suplementeve ndjekin këto orë.">Kur zgjohesh dhe kur fle?</StepTitle>
          <div className="space-y-8">
            <TimeStepper label="Zgjimi" short="Zgjimi" value={wakeTime} onChange={setWakeTime} />
            <TimeStepper label="Gjumi" short="Gjumi" value={sleepTime} onChange={setSleepTime} />
          </div>
        </>
      ) : null}

      {step === 3 ? (
        <>
          <StepTitle lead="Programi nis nga Java 0. Ushtrimet dhe peshat e sugjeruara shfaqen te Sot.">
            Programi yt
          </StepTitle>
          <section
            aria-labelledby={weekId}
            className="flex flex-col gap-4 rounded-xl border border-panel-border bg-panel p-5 text-panel-foreground"
          >
            <div className="flex items-start gap-3">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-xs leading-4 font-medium text-panel-muted-foreground">Jim Stoppani</span>
                <h2 id={weekId} className="text-2xl leading-8 font-bold tracking-[-0.02em]">
                  Shortcut to Size
                </h2>
                <span className="text-sm leading-5 text-panel-muted-foreground tabular-nums">13 javë · 4 stërvitje në javë</span>
              </div>
              <BodyFigure primary={[]} secondary={ALL_MUSCLES} scale={0.75} />
            </div>
            <ol className="flex flex-col">
              {STS_BLOCKS.map((block) => (
                <li key={block.id} className="flex min-h-12 items-center gap-3 border-t border-panel-border tabular-nums">
                  <span className="w-16 shrink-0 text-sm leading-5 font-semibold">{block.name}</span>
                  <span className="flex-1 text-sm leading-5 text-panel-muted-foreground">{BLOCK_NOTES[block.name]}</span>
                  <span className="text-xs leading-4 text-panel-muted-foreground">
                    {block.weeks} javë
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </>
      ) : null}
    </FocusLayout>
  )
}
