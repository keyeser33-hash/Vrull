import { useNavigate, useSearchParams } from 'react-router'
import { store, useLocalQuery } from '@/data/app-data'
import { readinessView } from '@/data/readiness-view'
import type { TodayView } from '@/data/today'
import { CheckInSheet } from './checkin-sheet'
import { ReadinessSheet } from './readiness-sheet'
import { SHEET, useOpenSheet } from './sheet-params'

// Fletat "Gjendja e ditës" dhe "Gati" (V50, V2-E3-04/05; bordet "Gjendja e ditës", "Fleta Gati"), të hapura nga rrathët
// e Sot (V57): me një parametër në adresë (`fleta=gjendja|gati`), që butoni mbrapa i Android-it t'i mbyllë.

export function ReadinessSheets({ view }: { view: TodayView }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const open = useOpenSheet()
  const rv = useLocalQuery(() => readinessView(store, view.date), [view.date])
  const sheet = params.get(SHEET)
  const close = () => navigate(-1)
  if (!rv) return null
  const { readiness, state } = rv
  return (
    <>
      {sheet === 'gjendja' ? <CheckInSheet view={view} state={state} onClose={close} /> : null}
      {sheet === 'gati' && state && readiness ? <ReadinessSheet view={view} rv={rv} onClose={close} onChange={() => open('gjendja', {}, true)} /> : null}
    </>
  )
}
