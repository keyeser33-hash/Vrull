import { type Language, LOCALES } from './language'

// Formatet sipas gjuhës (SPEC §0.3a, Gjuhët): numrat, datat, orët dhe shumësi me Intl.
// Shqip: 62,5 · 2 900 · "e diel, 8 nëntor" · 17:00. Anglisht (britanike): 62.5 · 2,900 ·
// "Sunday, 8 November" · 17:00. Numri dhe njësia lidhen me hapësirë që nuk thyhet.

/** Hapësira që nuk thyhet: mes numrit dhe njësisë, dhe te mijëshet e shqipes. */
export const NBSP = '\u00A0'

export interface NumberOptions {
  /** Shifrat dhjetore minimale (parazgjedhje 0). */
  minDigits?: number
  /** Shifrat dhjetore maksimale (parazgjedhje 2, si peshat 22,25 kg). */
  maxDigits?: number
}

export interface DateOptions {
  /** Dita e javës para datës (parazgjedhje po): "e diel, 8 nëntor". */
  weekday?: boolean
  /** Viti pas muajit: "8 nëntor 2026". */
  year?: boolean
}

export interface Format {
  /** Etiketa BCP 47 e Intl-it: "sq" ose "en-GB". */
  locale: string
  /** 62,5 · 2 900 / 62.5 · 2,900; mijëshet ndahen edhe te numrat me katër shifra. */
  number(value: number, options?: NumberOptions): string
  /** Numri dhe njësia me hapësirë që nuk thyhet: "62,5 kg", "2 900 kcal". */
  unit(value: number, unit: string, options?: NumberOptions): string
  /** "e diel, 8 nëntor" / "Sunday, 8 November", sipas ditës së telefonit. */
  date(date: Date, options?: DateOptions): string
  /** "08.11.2026" / "08/11/2026" */
  numericDate(date: Date): string
  /** "17:05" në të dyja gjuhët (24 orë). */
  time(date: Date): string
  /** Emri i plotë i ditës: "e diel" / "Sunday" (edhe për lexuesin e ekranit). */
  weekday(date: Date): string
  /** Kategoria e shumësit për `count`, sipas gjuhës; "ordinal" për numrat rendorë. */
  plural(count: number, type?: Intl.PluralRuleType): Intl.LDMLPluralRule
}

export interface FormatOptions {
  /**
   * A i ka Intl-i të dhënat e gjuhës. Chrome (edhe 153) nuk e ka shqipen në ICU dhe do të
   * kthente anglisht; atëherë shqipja ndërtohet nga emrat dhe rregullat më poshtë (CLDR).
   */
  localeData?: boolean
}

// Emrat dhe rregullat e shumësit të shqipes si te CLDR, kur Intl-i nuk ka të dhënat e saj.
const SQ_WEEKDAYS = ['e diel', 'e hënë', 'e martë', 'e mërkurë', 'e enjte', 'e premte', 'e shtunë']
const SQ_MONTHS = ['janar', 'shkurt', 'mars', 'prill', 'maj', 'qershor', 'korrik', 'gusht', 'shtator', 'tetor', 'nëntor', 'dhjetor']

function albanianPlural(count: number, type: Intl.PluralRuleType): Intl.LDMLPluralRule {
  const n = Math.abs(count)
  if (n === 1) return 'one'
  if (type === 'ordinal' && n % 10 === 4 && n % 100 !== 14) return 'many'
  return 'other'
}

const pad = (value: number) => String(value).padStart(2, '0')

const hasLocaleData = (locale: string) => Intl.DateTimeFormat.supportedLocalesOf([locale]).length > 0

export function createFormat(lang: Language, options: FormatOptions = {}): Format {
  const locale = LOCALES[lang]
  const intl = options.localeData ?? hasLocaleData(locale)
  // Pa të dhënat e gjuhës: anglishtja kalon te "en" (gjithmonë në ICU), shqipja te emrat e app-it.
  const albanian = !intl && lang === 'sq'
  const intlLocale = intl ? locale : 'en'
  const numberFormats = new Map<string, Intl.NumberFormat>()
  const pluralRules = new Map<Intl.PluralRuleType, Intl.PluralRules>()

  function numberFormat(minDigits: number, maxDigits: number) {
    const key = `${minDigits}:${maxDigits}`
    let format = numberFormats.get(key)
    if (!format) {
      // Pa të dhënat e shqipes: formati i anglishtes me shenjat e këmbyera (2,900.5 → 2 900,5).
      format = new Intl.NumberFormat(intlLocale, {
        useGrouping: 'always',
        minimumFractionDigits: minDigits,
        maximumFractionDigits: Math.max(minDigits, maxDigits),
      })
      numberFormats.set(key, format)
    }
    return format
  }

  const swapSeparators = (text: string) => text.replace(/[,.]/g, (mark) => (mark === ',' ? NBSP : ','))

  function number(value: number, { minDigits = 0, maxDigits = 2 }: NumberOptions = {}) {
    const text = numberFormat(minDigits, maxDigits).format(value)
    return albanian ? swapSeparators(text) : text
  }

  const dateFormat = albanian
    ? null
    : {
        weekday: new Intl.DateTimeFormat(intlLocale, { weekday: 'long' }),
        dayMonth: new Intl.DateTimeFormat(intlLocale, { day: 'numeric', month: 'long' }),
      }

  function names(date: Date) {
    if (!dateFormat) return { weekday: SQ_WEEKDAYS[date.getDay()], month: SQ_MONTHS[date.getMonth()] }
    const month = dateFormat.dayMonth.formatToParts(date).find((part) => part.type === 'month')?.value ?? ''
    return { weekday: dateFormat.weekday.format(date), month }
  }

  return {
    locale,
    number,
    unit: (value, unit, numberOptions) => `${number(value, numberOptions)}${NBSP}${unit}`,
    // Emrat vijnë nga Intl-i, renditja është e app-it: e njëjtë në çdo version të ICU-së
    // (versionet e reja e heqin presjen pas ditës së javës te en-GB).
    date(date, { weekday = true, year = false } = {}) {
      const parts = names(date)
      const dayMonth = `${date.getDate()} ${parts.month}${year ? ` ${date.getFullYear()}` : ''}`
      return weekday ? `${parts.weekday}, ${dayMonth}` : dayMonth
    },
    // Data me numra dhe ora kanë modele të fiksuara: 24 orë në të dyja gjuhët.
    numericDate(date) {
      const separator = lang === 'en' ? '/' : '.'
      return [pad(date.getDate()), pad(date.getMonth() + 1), String(date.getFullYear())].join(separator)
    },
    time: (date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`,
    weekday: (date) => names(date).weekday,
    plural(count, type = 'cardinal') {
      if (albanian) return albanianPlural(count, type)
      let rules = pluralRules.get(type)
      if (!rules) {
        rules = new Intl.PluralRules(intlLocale, { type })
        pluralRules.set(type, rules)
      }
      return rules.select(count)
    },
  }
}
