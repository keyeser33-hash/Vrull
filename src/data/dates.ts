/** Data lokale e telefonit (YYYY-MM-DD), që një vakt pas mesnate të mos kalojë në ditën e gabuar. */
export function localDate(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
