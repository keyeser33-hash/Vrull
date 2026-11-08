// "Peshat e javës" (V2-E1-09, bordi "Sugjerimi"): si ndryshon pesha e çdo sloti kundrejt peshës së
// fundit të përdorur ("Herën e kaluar"). Pesha e javës është vendimi i përdoruesit ose propozimi (§7).

export type RowChange = 'up' | 'down' | 'same' | 'new' | 'none'

export function rowChange(row: { previousKg: number | null; weightKg: number | null }): RowChange {
  if (row.weightKg === null) return 'none'
  if (row.previousKg === null) return 'new'
  const delta = row.weightKg - row.previousKg
  if (Math.abs(delta) < 1e-6) return 'same'
  return delta > 0 ? 'up' : 'down'
}

export function daySummary(rows: { previousKg: number | null; weightKg: number | null }[]): Record<RowChange, number> {
  const summary: Record<RowChange, number> = { up: 0, down: 0, same: 0, new: 0, none: 0 }
  for (const row of rows) summary[rowChange(row)]++
  return summary
}
