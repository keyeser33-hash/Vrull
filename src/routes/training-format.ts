// Ora e timer-it dhe e seancës, e njëjtë në të dyja gjuhët. Numrat, datat dhe objektivat e setit
// sipas gjuhës: `fmt` (`@/i18n`) dhe `session-format.ts`.

/** "1:30", "18:42", "1:02:03" */
export function clock(totalSeconds: number) {
  const seconds = Math.max(0, Math.round(totalSeconds))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const rest = String(seconds % 60).padStart(2, '0')
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`
}
