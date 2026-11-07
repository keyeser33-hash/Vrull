// Oraret në formatin 24 orësh "HH:MM" (DESIGN.md: ora 24h), për hapat e parë dhe cilësimet.

const DAY = 24 * 60
const pad = (value: number) => String(value).padStart(2, '0')

/** "23:45" + 15 → "00:00": ora rrotullohet brenda ditës. */
export function addMinutes(time: string, minutes: number): string {
  const [hours, mins] = time.split(':').map(Number)
  const total = (((hours * 60 + mins + minutes) % DAY) + DAY) % DAY
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`
}

/** "7" → "07:00", "1830" → "18:30", "6.45" → "06:45"; null kur nuk është orë e vlefshme. */
export function parseTimeInput(text: string): string | null {
  const value = text.trim()
  const match = /^(\d{1,2})(?:[:.](\d{1,2}))?$/.exec(value) ?? /^(\d{2})(\d{2})$/.exec(value)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2] ?? 0)
  if (hours > 23 || minutes > 59) return null
  return `${pad(hours)}:${pad(minutes)}`
}
