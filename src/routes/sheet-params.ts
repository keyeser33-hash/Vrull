import { useSearchParams } from 'react-router'
import type { TodayView } from '@/data/today'

// Fletat e Sot hapen me një parametër në adresë, që butoni mbrapa i Android-it t'i mbyllë (`onClose` = navigate(-1)).

export const SHEET = 'fleta'
export const DAY_PARAM = 'dita'

/** Hap një fletë të Sot me parametrin e adresës; `replace` kur vjen nga një fletë tjetër (Ndrysho gjendjen). */
export function useOpenSheet() {
  const [, setParams] = useSearchParams()
  return (name: string, extra: Record<string, string> = {}, replace = false) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        next.set(SHEET, name)
        for (const [key, value] of Object.entries(extra)) next.set(key, value)
        return next
      },
      { replace },
    )
}

/** Sa stërvitje të planifikuara ka para `date` nga sot (përfshirë sot kur ende pret): vendi i stërvitjes te programi. */
export function trainingsAhead(week: TodayView['week'], today: string, date: string): number {
  return week.filter((day) => day.date >= today && day.date < date && day.state === 'planned').length
}
