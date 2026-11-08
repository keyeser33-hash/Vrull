import { en } from './en'
import { createFormat, type Format } from './format'
import { type Language, language } from './language'
import { sq } from './sq'
import { createTranslator, type Messages, type ParamValue } from './translate'

// Dy gjuhët (SPEC V22, §0.3a). Në komponentë: `const { t, fmt } = useI18n()` (use-i18n.ts);
// jashtë React-it (tekstet e të dhënave, njoftimet): `currentI18n()`.

export type Catalog = typeof sq
export type MessageKey = keyof Catalog

type Placeholders<S> = S extends `${string}{${infer Name}}${infer Rest}` ? Name | Placeholders<Rest> : never
type FormTexts<M> = Exclude<M[keyof M], boolean | undefined>
type ParamsOf<M> = M extends string
  ? { readonly [P in Placeholders<M>]: ParamValue }
  : { readonly count: number } & { readonly [P in Exclude<Placeholders<FormTexts<M>>, 'count'>]: ParamValue }
type ParamArgs<M> = M extends string ? ([Placeholders<M>] extends [never] ? [] : [params: ParamsOf<M>]) : [params: ParamsOf<M>]

/** `t('sync.pending', { count: 2 })`: çelësi dhe parametrat kontrollohen nga katalogu shqip. */
export type T = <K extends MessageKey>(key: K, ...params: ParamArgs<Catalog[K]>) => string

export interface I18n {
  lang: Language
  t: T
  fmt: Format
}

const CATALOGS: Record<Language, Messages> = { sq, en }
const bundles = new Map<Language, I18n>()

/** Tekstet dhe formatet e një gjuhe; një objekt i vetëm për gjuhë, që React të mos rivizatojë kot. */
export function i18nFor(lang: Language): I18n {
  let bundle = bundles.get(lang)
  if (!bundle) {
    const fmt = createFormat(lang)
    bundle = { lang, fmt, t: createTranslator(lang, CATALOGS, fmt) as T }
    bundles.set(lang, bundle)
  }
  return bundle
}

/** Gjuha e tanishme, për kodin jashtë React-it; komponentët përdorin useI18n() që të rivizatohen. */
export const currentI18n = () => i18nFor(language.get())

export { type Format, NBSP } from './format'
export { DEFAULT_LANGUAGE, isLanguage, type Language, LANGUAGE_NAMES, LANGUAGES, language } from './language'
