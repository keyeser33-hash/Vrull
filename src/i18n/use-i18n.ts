import { useSyncExternalStore } from 'react'
import { type I18n, i18nFor } from './index'
import { language } from './language'

/** Tekstet (`t`) dhe formatet (`fmt`) në gjuhën e tanishme; ndërrimi i gjuhës rivizaton komponentin. */
export function useI18n(): I18n {
  return i18nFor(useSyncExternalStore(language.subscribe, language.get))
}
