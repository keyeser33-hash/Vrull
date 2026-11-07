// Ditët dhe javët sipas orës së telefonit. Çastet ruhen në UTC (`logged_at`, `ended_at`), ndaj
// data e një seti merret nga ora lokale, jo nga dhjetë shkronjat e para të tekstit ISO: një set i
// së hënës 00:30 në Tiranë është 23:30 UTC e së dielës.

const pad = (value: number) => String(value).padStart(2, '0')

/** Data lokale e telefonit (YYYY-MM-DD), që një vakt pas mesnate të mos kalojë në ditën e gabuar. */
export function localDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Data lokale e një çasti të ruajtur si tekst ISO. */
export function localDay(at: string) {
  return localDate(new Date(at))
}

/** Java kalendarike (nga e hëna) që përmban `now`, e zhvendosur me `offset` javë: [fillimi, fundi). */
export function weekRange(now: Date, offset = 0): [string, string] {
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7) + 7 * offset)
  return [localDate(monday), localDate(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7))]
}
