import { useNavigate, useSearchParams } from 'react-router'
import { store } from '@/data/app-data'
import type { TodayView } from '@/data/today'
import { markStorySeen } from '@/today/stories'
import { CheckInStories } from './checkin-stories'
import { SHEET } from './sheet-params'

// Gjendja e ditës dhe "Gati" (V50; V57, SPEC §0.3f) si story, të hapura nga rrathët e Sot dhe nga rikujtuesi i mëngjesit:
// me një parametër në adresë (`fleta=gjendja|gati`), që butoni mbrapa i Android-it t'i mbyllë. Kur story mbyllet,
// rrethi bëhet i shikuar: "Si ndihesh?" gjithnjë, "Gati N%" kur u arrit story i 5-të.

export function ReadinessSheets({ view }: { view: TodayView }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const sheet = params.get(SHEET)
  if (sheet !== 'gjendja' && sheet !== 'gati') return null
  const close = ({ ready }: { ready: boolean }) => {
    // Një nga një: `markStorySeen` lexon dhe shkruan të njëjtën vlerë.
    void markStorySeen(store, view.date, 'checkin').then(() => (ready ? markStorySeen(store, view.date, 'ready') : undefined))
    navigate(-1)
  }
  return <CheckInStories view={view} start={sheet} onClose={close} />
}
