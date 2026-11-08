// Dita e ushqimit (V46, GLOSSARY): ushqimi, uji dhe suplementet e një dite nuk ndërrohen në mesnatë,
// por 3 orë para zgjimit (05:20 me zgjim në 08:20), që vakti para gjumit pas mesnate t'i përkasë
// ditës që po mbaron. Me zgjim para orës 03:00 ndërrimi mbetet në mesnatë.

export const FOOD_DAY_LEAD_MINUTES = 180

const pad = (value: number) => String(value).padStart(2, '0')
const isoDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

/** Data e ditës së ushqimit për një çast, sipas orës së zgjimit ("HH:MM"). */
export function foodDate(now: Date, wakeTime: string): string {
  const [hours, minutes] = wakeTime.split(':').map(Number)
  const start = Math.max(0, hours * 60 + minutes - FOOD_DAY_LEAD_MINUTES)
  if (now.getHours() * 60 + now.getMinutes() >= start) return isoDate(now)
  const previous = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
  return isoDate(previous)
}

/** Minutat e një çasti nga mesnata e datës së dhënë (pas mesnate kalojnë 1440). */
export function minutesInFoodDay(now: Date, date: string): number {
  const [year, month, day] = date.split('-').map(Number)
  const midnight = new Date(year, month - 1, day)
  return Math.round((now.getTime() - midnight.getTime()) / 60_000)
}
