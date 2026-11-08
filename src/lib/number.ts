/** Një vlerë nga baza ose nga JS-i si numër; null dhe undefined mbeten null. */
export const numberOrNull = (value: unknown): number | null => (value === null || value === undefined ? null : Number(value))
