import { useId, useState } from 'react'
import { DayPicker } from '@/components/forms/day-picker'
import { Field } from '@/components/ui/field'
import { inputClass } from '@/components/ui/field-styles'
import { store, useLocalQuery } from '@/data/app-data'
import { isTime, parseWeight, type Profile, readProfile, updateProfile } from '@/data/profile'

// Profili te Cilësimet (SPEC §3a: "Çdo hap ndryshohet më vonë te cilësimet").
// Çdo ndryshim ruhet menjëherë në telefon; sinkronizimi e dërgon vetë.
export function ProfileSection() {
  const profile = useLocalQuery(() => readProfile(store), [])
  return (
    <section aria-labelledby="profile-title" className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <h2 id="profile-title" className="text-lg leading-7 font-semibold tracking-[-0.01em]">
        Profili
      </h2>
      {profile ? <ProfileForm initial={profile} /> : null}
    </section>
  )
}

const formatWeight = (value: number | null) => (value === null ? '' : String(value).replace('.', ','))

function ProfileForm({ initial }: { initial: Profile }) {
  const daysLabel = useId()
  const [weight, setWeight] = useState(formatWeight(initial.weightKg))
  const [days, setDays] = useState(initial.trainingDays)
  const [trainingTime, setTrainingTime] = useState(initial.trainingTime)
  const [wakeTime, setWakeTime] = useState(initial.wakeTime)
  const [sleepTime, setSleepTime] = useState(initial.sleepTime)
  const [weightError, setWeightError] = useState<string | null>(null)
  const [daysError, setDaysError] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  async function save(patch: Partial<Profile>) {
    try {
      await updateProfile(store, patch)
      setProblem(null)
    } catch {
      setProblem('Ndryshimi nuk u ruajt. Provo përsëri.')
    }
  }

  function saveWeight() {
    const value = parseWeight(weight)
    if (value === null) {
      setWeightError('Shkruaj një peshë mes 30 dhe 300 kg, p.sh. 80,5.')
      return
    }
    setWeightError(null)
    if (value !== initial.weightKg) void save({ weightKg: value })
  }

  function changeTime(setter: (value: string) => void, key: 'trainingTime' | 'wakeTime' | 'sleepTime') {
    return (value: string) => {
      setter(value)
      if (isTime(value)) void save({ [key]: value })
    }
  }

  return (
    <div className="mt-4 space-y-4">
      <Field label="Pesha e sotme (kg)" error={weightError} hint="Ruhet si matja e sotme. Historia e peshës shfaqet te Progresi.">
        {(props) => (
          <input
            {...props}
            inputMode="decimal"
            autoComplete="off"
            value={weight}
            onChange={(event) => setWeight(event.target.value)}
            onBlur={saveWeight}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur()
            }}
            className={inputClass}
          />
        )}
      </Field>
      <div>
        <p id={daysLabel} className="mb-1.5 text-sm leading-5 font-medium">
          Ditët e stërvitjes
        </p>
        <DayPicker
          value={days}
          labelledBy={daysLabel}
          onChange={(next) => {
            setDays(next)
            if (next.length === 0) {
              setDaysError('Zgjidh të paktën një ditë stërvitjeje.')
              return
            }
            setDaysError(null)
            void save({ trainingDays: next })
          }}
        />
        {daysError ? <p className="mt-1.5 text-sm leading-5 text-destructive">{daysError}</p> : null}
      </div>
      <Field label="Ora e stërvitjes">
        {(props) => (
          <input
            {...props}
            type="time"
            value={trainingTime}
            onChange={(event) => changeTime(setTrainingTime, 'trainingTime')(event.target.value)}
            className={inputClass}
          />
        )}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Zgjimi">
          {(props) => (
            <input
              {...props}
              type="time"
              value={wakeTime}
              onChange={(event) => changeTime(setWakeTime, 'wakeTime')(event.target.value)}
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
              onChange={(event) => changeTime(setSleepTime, 'sleepTime')(event.target.value)}
              className={inputClass}
            />
          )}
        </Field>
      </div>
      {problem ? (
        <p role="alert" className="text-sm leading-5 text-destructive">
          {problem}
        </p>
      ) : null}
    </div>
  )
}
