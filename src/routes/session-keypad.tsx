import { useEffect, useState } from 'react'
import { Sheet } from '@/components/layout/sheet'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icons'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import { BAR_KG, platesPerSide } from '@/program/plates'

// Tastiera numerike e seancës (bordi "Seanca · tastiera", V58): prekja e numrit të madh hap fletën me
// numrin, −/+ me hapin e pajisjes, disqet për anë te shufra (20 kg), çipat "Herën e kaluar" dhe "Pesha e
// javës", tastierën 3 × 4 dhe "Gati". Pa tastierën e sistemit: shifrat shtohen me prekje, e para zëvendëson
// vlerën; tastiera fizike punon njësoj (shifrat, presja, Backspace, Enter).

export type KeypadKind = 'weight' | 'reps' | 'seconds'

const LIMITS: Record<KeypadKind, { max: number; min: number; integer: number; decimals: number }> = {
  weight: { max: 500, min: 0, integer: 3, decimals: 2 },
  reps: { max: 200, min: 1, integer: 3, decimals: 0 },
  seconds: { max: 3600, min: 1, integer: 4, decimals: 0 },
}

const parse = (text: string) => (text === '' || text === '.' ? Number.NaN : Number(text))

export interface KeypadChip {
  label: string
  value: number
}

export function KeypadSheet({
  kind,
  description,
  value,
  step,
  chips = [],
  plates = false,
  onSave,
  onClose,
}: {
  kind: KeypadKind
  /** "Bench Press · seti 3". */
  description: string
  value: number
  /** Hapi i −/+: pesha e pajisjes, 1 përsëritje, 5 sekonda. */
  step: number
  chips?: KeypadChip[]
  /** Disqet për anë (ushtrimet me shufër). */
  plates?: boolean
  onSave: (value: number) => void
  onClose: () => void
}) {
  const { t, fmt } = useI18n()
  const limits = LIMITS[kind]
  // Teksti mbahet me pikë ("62.5") dhe shfaqet me presjen e gjuhës ("62,5" / "62.5").
  const decimal = fmt.number(1.5).charAt(1)
  const scale = 10 ** limits.decimals
  const show = (number: number) => String(Math.round(number * scale) / scale)
  const [text, setText] = useState(() => show(value))
  // Shifra e parë zëvendëson vlerën, si një fushë e zgjedhur e tëra.
  const [fresh, setFresh] = useState(true)
  const [error, setError] = useState(false)
  const parsed = parse(text)
  const unit = kind === 'weight' ? 'kg' : kind === 'seconds' ? 's' : t('ui.stepper.repsUnit', { count: Number.isFinite(parsed) ? parsed : 0 })

  const type = (key: string) => {
    setError(false)
    setText((current) => {
      const base = fresh ? '' : current
      if (key === 'back') return fresh ? '' : current.slice(0, -1)
      if (key === '.') {
        if (limits.decimals === 0 || base.includes('.')) return current
        return `${base || '0'}.`
      }
      const next = base === '0' ? key : base + key
      const [whole, part = ''] = next.split('.')
      if (whole.length > limits.integer || part.length > limits.decimals) return current
      return next
    })
    setFresh(false)
  }
  const set = (number: number) => {
    setError(false)
    setFresh(true)
    setText(show(Math.min(limits.max, Math.max(0, number))))
  }
  const submit = () => {
    if (!Number.isFinite(parsed) || parsed < limits.min || parsed > limits.max) {
      setError(true)
      return
    }
    onSave(kind === 'weight' ? Math.round(parsed * 100) / 100 : Math.round(parsed))
  }

  // Tastiera fizike (kompjuteri, provat): shifrat, presja ose pika, Backspace dhe Enter.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (/^\d$/.test(event.key)) type(event.key)
      else if (event.key === ',' || event.key === '.') type('.')
      else if (event.key === 'Backspace') type('back')
      else if (event.key === 'Enter') submit()
      else return
      event.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const title = t(kind === 'weight' ? 'session.keypad.weight' : kind === 'seconds' ? 'session.keypad.seconds' : 'session.keypad.reps')
  const split = plates && kind === 'weight' && Number.isFinite(parsed) ? platesPerSide(parsed) : null
  const stepText = fmt.number(step)
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', limits.decimals > 0 ? '.' : '', '0', 'back']

  return (
    <Sheet
      title={title}
      description={description}
      onClose={onClose}
      footer={
        <Button variant="primary" size="lg" className="w-full" onClick={submit}>
          {t('session.keypad.done')}
        </Button>
      }
    >
      <div className="grid grid-cols-[64px_minmax(0,1fr)_64px] items-center gap-2">
        <Button
          variant="secondary"
          ground="card"
          size="lg"
          aria-label={kind === 'weight' ? t('ui.stepper.lowerWeight', { step }) : kind === 'seconds' ? t('session.seconds.lower') : t('ui.stepper.lowerReps')}
          disabled={!Number.isFinite(parsed) || parsed - step < limits.min}
          onClick={() => set(parsed - step)}
          className="px-0 text-lg tabular-nums"
        >
          −{stepText}
        </Button>
        <p aria-live="polite" className="flex min-w-0 items-baseline justify-center gap-1.5">
          <span className="font-display text-[64px] leading-[0.9] font-extrabold tabular-nums">{(text || '0').replace('.', decimal)}</span>
          <span className="type-body text-muted-foreground">{unit}</span>
        </p>
        <Button
          variant="secondary"
          ground="card"
          size="lg"
          aria-label={kind === 'weight' ? t('ui.stepper.raiseWeight', { step }) : kind === 'seconds' ? t('session.seconds.raise') : t('ui.stepper.raiseReps')}
          onClick={() => set((Number.isFinite(parsed) ? parsed : 0) + step)}
          className="px-0 text-lg tabular-nums"
        >
          +{stepText}
        </Button>
      </div>

      {split ? (
        <div className="flex flex-col gap-0.5 rounded-lg bg-surface-2 px-3 py-2.5 text-sm leading-[1.35] tabular-nums">
          <span className="font-semibold">{t('session.keypad.bar', { weight: fmt.unit(BAR_KG, 'kg') })}</span>
          <span className="text-muted-foreground">
            {split.plates.length ? t('session.keypad.perSide', { plates: split.plates.map((plate) => fmt.number(plate)).join(' + ') }) : t('session.keypad.emptyBar')}
          </span>
          {split.plates.length ? (
            <span className="text-muted-foreground">
              {t('session.keypad.sum', { total: fmt.number(parsed), bar: fmt.number(split.barKg), side: fmt.number(split.perSideKg) })}
            </span>
          ) : null}
        </div>
      ) : null}

      {chips.length ? (
        <div className="grid grid-cols-2 gap-2">
          {chips.map((chip) => {
            const selected = Number.isFinite(parsed) && Math.abs(parsed - chip.value) < 0.001
            return (
              <button
                key={chip.label}
                type="button"
                aria-pressed={selected}
                onClick={() => set(chip.value)}
                className={cn(
                  'flex min-h-touch items-center justify-between gap-2 rounded-md border px-3 text-sm leading-[1.35] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground',
                  selected ? 'border-ember-text' : 'border-surface-border bg-surface-2',
                )}
              >
                <span className="truncate text-muted-foreground">{chip.label}</span>
                <span className="font-display text-lg font-bold tabular-nums">{fmt.number(chip.value)}</span>
              </button>
            )
          })}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="type-caption text-danger">
          {t('session.keypad.invalid', { count: limits.max, max: limits.max })}
        </p>
      ) : null}

      <div className="grid shrink-0 grid-cols-3 gap-2">
        {keys.map((key, index) =>
          key === '' ? (
            <span key={`empty-${index}`} />
          ) : (
            <Button
              key={key}
              variant="secondary"
              ground="card"
              size="lg"
              aria-label={key === 'back' ? t('session.keypad.delete') : key === '.' ? t('session.keypad.decimal') : undefined}
              onClick={() => type(key)}
              className="h-14 px-0 font-display text-2xl tabular-nums"
            >
              {key === 'back' ? <Icon name="fshi-shifren" size={24} /> : key === '.' ? decimal : key}
            </Button>
          ),
        )}
      </div>
    </Sheet>
  )
}
