import { addMinutes, parseTimeInput } from '@/lib/time'
import { ValueStepper } from './value-stepper'

// Ora 24 orësh me − dhe + nga 15 minuta, ose e shkruar ("1930", "7", "6.45").
const TIME_STEP = 15

export function TimeStepper({
  label,
  short,
  value,
  onChange,
  hideLabel,
}: {
  label: string
  /** "Ora e stërvitjes", për etiketat e butonave. */
  short: string
  value: string
  onChange: (value: string) => void
  hideLabel?: boolean
}) {
  return (
    <ValueStepper
      variant="hero"
      hideLabel={hideLabel}
      label={label}
      text={value}
      inputMode="numeric"
      minusLabel={`${short} ${TIME_STEP} minuta më herët`}
      plusLabel={`${short} ${TIME_STEP} minuta më vonë`}
      onMinus={() => onChange(addMinutes(value, -TIME_STEP))}
      onPlus={() => onChange(addMinutes(value, TIME_STEP))}
      onCommit={(text) => {
        const parsed = parseTimeInput(text)
        if (parsed) onChange(parsed)
      }}
    />
  )
}
