import { type ReactNode, useId, useState } from 'react'
import { DayPicker } from '@/components/forms/day-picker'
import { FocusLayout } from '@/components/layout/focus-layout'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button-variants'
import { Field } from '@/components/ui/field'
import { inputClass } from '@/components/ui/field-styles'
import { Icon } from '@/components/ui/icons'
import { store } from '@/data/app-data'
import { completeOnboarding, DEFAULT_PROFILE, isTime, parseWeight } from '@/data/profile'
import { cn } from '@/lib/cn'

// Hapat e hyrjes së parë (SPEC §3a, hapat 2–5): pesha, stërvitja, orari, programi.
// Çdo vlerë ndryshohet më vonë te Cilësimet. Lejet e njoftimeve nuk kërkohen këtu.

const STEPS = 4

function Progress({ step }: { step: number }) {
  return (
    <div>
      <p className="text-sm leading-5 text-muted-foreground tabular-nums">
        Hapi {step + 1} nga {STEPS}
      </p>
      <div aria-hidden className="mt-2 grid grid-cols-4 gap-1.5">
        {Array.from({ length: STEPS }, (_, index) => (
          <span key={index} className={cn('h-1 rounded-full', index <= step ? 'bg-brand' : 'bg-border')} />
        ))}
      </div>
    </div>
  )
}

function StepTitle({ children, lead }: { children: ReactNode; lead: ReactNode }) {
  return (
    <div className="mt-8 mb-6">
      <h1 className="text-3xl font-semibold tracking-tight">{children}</h1>
      <p className="mt-2 text-base leading-6 text-muted-foreground">{lead}</p>
    </div>
  )
}

export function OnboardingPage() {
  const daysLabel = useId()
  const daysHint = useId()
  const [step, setStep] = useState(0)
  const [weight, setWeight] = useState('')
  const [days, setDays] = useState<number[]>(DEFAULT_PROFILE.trainingDays)
  const [trainingTime, setTrainingTime] = useState(DEFAULT_PROFILE.trainingTime)
  const [wakeTime, setWakeTime] = useState(DEFAULT_PROFILE.wakeTime)
  const [sleepTime, setSleepTime] = useState(DEFAULT_PROFILE.sleepTime)
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function validate(): string | null {
    if (step === 0 && parseWeight(weight) === null) return 'Shkruaj një peshë mes 30 dhe 300 kg, p.sh. 80,5.'
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
      await completeOnboarding(store, {
        weightKg: parseWeight(weight)!,
        trainingDays: days,
        trainingTime,
        wakeTime,
        sleepTime,
      })
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
      <Button variant="brand" className="w-full" disabled={busy} onClick={() => void next()}>
        {step === STEPS - 1 ? (busy ? 'Po ruhet' : 'Fillo programin') : 'Vazhdo'}
      </Button>
    </>
  )

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
          {/* Gabimi i peshës shfaqet nën fushë; te hapat e tjerë, mbi butonin. */}
          <Field label="Pesha (kg)" error={problem}>
            {(props) => (
              <input
                {...props}
                inputMode="decimal"
                autoComplete="off"
                placeholder="80,5"
                value={weight}
                onChange={(event) => setWeight(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void next()
                }}
                className={inputClass}
              />
            )}
          </Field>
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
          <Field label="Ora e zakonshme e stërvitjes" className="mt-6">
            {(props) => (
              <input
                {...props}
                type="time"
                value={trainingTime}
                onChange={(event) => setTrainingTime(event.target.value)}
                className={inputClass}
              />
            )}
          </Field>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <StepTitle lead="Rikujtuesit e vakteve dhe të suplementeve ndjekin këto orë.">Kur zgjohesh dhe kur fle?</StepTitle>
          <div className="space-y-4">
            <Field label="Zgjimi">
              {(props) => (
                <input
                  {...props}
                  type="time"
                  value={wakeTime}
                  onChange={(event) => setWakeTime(event.target.value)}
                  className={inputClass}
                />
              )}
            </Field>
            <Field label="Gjumi">
              {(props) => (
                <input
                  {...props}
                  type="time"
                  value={sleepTime}
                  onChange={(event) => setSleepTime(event.target.value)}
                  className={inputClass}
                />
              )}
            </Field>
          </div>
        </>
      ) : null}

      {step === 3 ? (
        <>
          <StepTitle lead="Programi nis nga Java 0. Ushtrimet dhe peshat e sugjeruara shfaqen te Sot.">
            Programi yt
          </StepTitle>
          <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <h2 className="text-lg leading-7 font-semibold tracking-[-0.01em]">Shortcut to Size</h2>
            <p className="text-sm leading-5 text-muted-foreground">Jim Stoppani · 13 javë · 4 stërvitje në javë</p>
            <ul className="mt-4 space-y-2 text-sm leading-5">
              <li>
                <span className="font-medium">Java 0.</span> Teknika dhe gjetja e peshave, pa dështim.
              </li>
              <li>
                <span className="font-medium">Faza 1, 2 dhe 3.</span> Nga 4 javë, me përsëritje që ulen çdo javë dhe
                peshë që rritet.
              </li>
            </ul>
          </section>
        </>
      ) : null}
    </FocusLayout>
  )
}
