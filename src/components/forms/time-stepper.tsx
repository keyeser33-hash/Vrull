import { useI18n } from '@/i18n/use-i18n'
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
  variant = 'hero',
}: {
  label: string
  /** "Ora e stërvitjes", për etiketat e butonave. */
  short: string
  value: string
  onChange: (value: string) => void
  hideLabel?: boolean
  /** `row` në një rresht me etiketën (disa orë në një fletë); `hero` në qendër (hapat e parë). */
  variant?: 'row' | 'hero'
}) {
  const { t } = useI18n()
  return (
    <ValueStepper
      variant={variant}
      hideLabel={hideLabel}
      label={label}
      text={value}
      inputMode="numeric"
      minusLabel={t('form.time.earlier', { label: short, minutes: TIME_STEP })}
      plusLabel={t('form.time.later', { label: short, minutes: TIME_STEP })}
      onMinus={() => onChange(addMinutes(value, -TIME_STEP))}
      onPlus={() => onChange(addMinutes(value, TIME_STEP))}
      onCommit={(text) => {
        const parsed = parseTimeInput(text)
        if (parsed) onChange(parsed)
      }}
    />
  )
}
