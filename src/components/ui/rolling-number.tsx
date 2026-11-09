import { type CSSProperties, type HTMLAttributes, useState } from 'react'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'

// Numri që rrotullohet (SPEC §0.3c, E2-23; bordi "Lëvizja e 0.23"): kur vlera ndryshon, vetëm shifrat
// që ndryshuan rrotullohen 200 ms, me 40 ms mes shifrave nga e majta; shifrat e njëjta rrinë. Teksti
// është gjithnjë ai i `fmt` (ose i `format`), si një tekst i vetëm në DOM: shifra e vjetër vizatohet
// nga `::before` me `attr(data-from)` dhe nuk është tekst, ndaj lexuesi i ekranit dhe `textContent`
// marrin vetëm vlerën e fundit. Rritja rrotullohet lart, zbritja poshtë. Me "lëvizje të reduktuar"
// shifrat e reja vetëm zbehen 120 ms (globals.css › `.roll-digit`). Lëvizja nuk vonon asgjë: vlera
// e re është në DOM që në rivizatimin e parë.

const DIGIT = /\p{Nd}/u

interface Roll {
  text: string
  value: number
  /** Teksti para ndryshimit të fundit; null para ndryshimit të parë (asgjë nuk rrotullohet). */
  from: string | null
  /** Numëruesi i ndryshimeve: çdo ndryshim rindërton kolonat, që animacioni të nisë nga e para. */
  run: number
  up: boolean
}

export interface RollingNumberProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  value: number
  /** Teksti i numrit; parazgjedhja `fmt.number(value)` sipas gjuhës ("1 380" / "1,380"). */
  format?: (value: number) => string
}

export function RollingNumber({ value, format, className, ...props }: RollingNumberProps) {
  const { fmt } = useI18n()
  const text = format ? format(value) : fmt.number(value)
  const [roll, setRoll] = useState<Roll>({ text, value, from: null, run: 0, up: true })
  // Gjendja nga vizatimi i mëparshëm (React: "storing information from previous renders").
  if (roll.text !== text) setRoll({ text, value, from: roll.text, run: roll.run + 1, up: value >= roll.value })

  return (
    <span className={cn('whitespace-nowrap tabular-nums', className)} {...props}>
      {roll.from === null || roll.text !== text ? text : columns(roll)}
    </span>
  )
}

/** Shifrat që ndryshuan si kolona që rrotullohen; pjesa tjetër tekst i thjeshtë. Shifrat krahasohen nga e djathta. */
function columns({ text, from, run, up }: Roll) {
  const chars = Array.from(text)
  const before = Array.from(from ?? '')
  const shift = before.length - chars.length
  let order = 0
  return chars.map((char, index) => {
    const old = before[index + shift] ?? ''
    if (!DIGIT.test(char) || old === char) return char
    const style = { '--roll-i': order++ } as CSSProperties
    return (
      <span key={`${run}-${index}`} className="roll-col">
        <span className="roll-digit" data-from={old} data-dir={up ? 'up' : 'down'} style={style}>
          {char}
        </span>
      </span>
    )
  })
}
