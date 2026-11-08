import type { Format } from './format'
import type { Language } from './language'

// Mesazhet e katalogut dhe t(): parametrat me emër ({name}), shumësi me Intl.PluralRules
// dhe shqipja si rezervë për çdo çelës që mungon.

/**
 * Format e një mesazhi me numër (`count`), sipas kategorive të Intl.PluralRules të gjuhës:
 * shqip dhe anglisht `one` dhe `other`. `=0` fiton kur numri është zero; `ordinal` zgjedh
 * rregullat e numrave rendorë (anglisht `one`, `two`, `few`, `other`: 1st, 2nd, 3rd, 4th).
 */
export type PluralForms = {
  readonly ordinal?: boolean
  readonly '=0'?: string
  readonly zero?: string
  readonly one?: string
  readonly two?: string
  readonly few?: string
  readonly many?: string
  readonly other: string
}

export type Message = string | PluralForms
export type Messages = Readonly<Record<string, Message>>
export type ParamValue = string | number
export type Params = Readonly<Record<string, ParamValue>>

/** t() pa tipe të çelësave; index.ts i jep tipet nga katalogu shqip. */
export type Translate = (key: string, params?: Params) => string

function pick(message: Message, params: Params | undefined, fmt: Format): string {
  if (typeof message === 'string') return message
  const count = params?.count
  if (typeof count !== 'number') return message.other
  if (count === 0 && message['=0'] !== undefined) return message['=0']
  return message[fmt.plural(count, message.ordinal ? 'ordinal' : 'cardinal')] ?? message.other
}

export function createTranslator(lang: Language, catalogs: Record<Language, Messages>, fmt: Format): Translate {
  return (key, params) => {
    // Tipet e kapin një çelës që mungon; këtu vetëm që ekrani të mos prishet (p.sh. çelës nga të dhënat).
    const message = catalogs[lang][key] ?? catalogs.sq[key]
    if (message === undefined) return key
    // Numrat formatohen sipas gjuhës (62,5 / 62.5); vitet dhe kodet jepen si tekst.
    return pick(message, params, fmt).replace(/\{(\w+)\}/g, (match, name: string) => {
      const value = params?.[name]
      if (value === undefined) return match
      return typeof value === 'number' ? fmt.number(value) : value
    })
  }
}
