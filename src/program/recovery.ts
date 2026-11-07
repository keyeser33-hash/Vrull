import type { MuscleGroup } from './muscles'

export type RecoveryStatus = 'gati' | 'pothuajse_gati' | 'i_lodhur'

export interface WorkedSession {
  endedAt: string
  /** Muskujt kryesorë të ushtrimeve që u bënë në seancë. */
  primaryKeys: string[]
}

export interface GroupRecovery {
  group: MuscleGroup
  hours: number | null
  status: RecoveryStatus
}

/** Sipas orëve nga stërvitja e fundit ku muskuli ishte kryesor (§11). Pa stërvitje: "Gati". */
export function recoveryStatus(hours: number | null): RecoveryStatus {
  if (hours === null || hours > 72) return 'gati'
  return hours < 48 ? 'i_lodhur' : 'pothuajse_gati'
}

/**
 * Rikuperimi i grupeve që punohen sot si kryesorë, me radhën e muskujve të stërvitjes. Orët e një
 * grupi: nga seanca më e afërt ku një nga muskujt e tij të sotëm ishte kryesor.
 */
export function recoveryFor(groups: MuscleGroup[], todayKeys: string[], sessions: WorkedSession[], now: Date): GroupRecovery[] {
  const lastByKey = new Map<string, number>()
  for (const session of sessions) {
    const at = Date.parse(session.endedAt)
    for (const key of session.primaryKeys) lastByKey.set(key, Math.max(lastByKey.get(key) ?? 0, at))
  }
  const ordered: MuscleGroup[] = []
  for (const key of todayKeys) {
    const group = groups.find((candidate) => candidate.keys.includes(key))
    if (group && !ordered.includes(group)) ordered.push(group)
  }
  return ordered.map((group) => {
    const times = todayKeys.filter((key) => group.keys.includes(key)).map((key) => lastByKey.get(key)).filter((at) => at !== undefined)
    const hours = times.length ? (now.getTime() - Math.max(...times)) / 3_600_000 : null
    return { group, hours, status: recoveryStatus(hours) }
  })
}
