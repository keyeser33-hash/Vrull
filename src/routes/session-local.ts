import { useEffect, useRef } from 'react'
import type { SetRecord } from '@/data/training'

// Setet e seancës para bazës (SPEC §0.3g, V58; docs/MESIMET.md: një prekje që duhet të duket menjëherë
// nuk pret leximin). "Ruaj setin", segmenti dhe "Zhbëj" shfaqen në prekje si ndryshime lokale mbi leximin e
// bazës; secili largohet kur shkrimi i tij ka mbaruar dhe leximi e tregon. Pa UI, që provat ta mbulojnë.

/** Një ndryshim lokal i një seti (sloti dhe numri): seti siç duhet të duket, ose null kur u zhbë. */
export interface LocalChange {
  key: string
  set: SetRecord | null
  /** Shkrimi te baza mbaroi. */
  written: boolean
  /** Ndryshimi i fundit për të njëjtin set fiton; shkrimi i një ndryshimi të vjetër nuk e shënon të riun. */
  token: number
}

export const setKey = (set: Pick<SetRecord, 'slotId' | 'setNumber'>) => `${set.slotId}:${set.setNumber}`

/**
 * Kohët e seancës: "Zhbëj" rri 6 s; një prekje e dytë brenda 450 ms nga shfaqja e butonit nuk ruan setin
 * tjetër. Te provat roja është 0 (klikimet e `userEvent` vijnë menjëherë); prova e saj e vendos vetë.
 */
export const SESSION_TIMING = { undoMs: 6000, tapGuardMs: import.meta.env.MODE === 'test' ? 0 : 450 }

/** Leximi me ndryshimet lokale: setet e zhbëra hiqen, ato të ndryshuara zënë vendin e vet, të rejat dalin të fundit. */
export function withLocal(read: readonly SetRecord[], changes: readonly LocalChange[]): SetRecord[] {
  const byKey = new Map(changes.map((change) => [change.key, change]))
  const out = read.flatMap((set) => {
    const change = byKey.get(setKey(set))
    if (!change) return [set]
    return change.set ? [change.set] : []
  })
  const keys = new Set(read.map(setKey))
  for (const change of changes) if (change.set && !keys.has(change.key)) out.push(change.set)
  return out
}

/** Ndryshimet që leximi s'i tregon ende; të tjerat largohen. */
export function settled(read: readonly SetRecord[], changes: readonly LocalChange[]): LocalChange[] {
  return changes.filter((change) => {
    if (!change.written) return true
    const found = read.find((set) => setKey(set) === change.key)
    if (change.set === null) return found !== undefined
    return !found || found.segments.length !== change.set.segments.length
  })
}

/**
 * Një prekje e dytë që bie mbi butonin e ri në të njëjtin vend (pas "Ruaj setin" vjen "Ruaj setin 2" te
 * pushimi, ose "Ruaj segmentin") nuk ruan setin tjetër: butoni pranon prekje 450 ms pasi del.
 */
export function useTapGuard() {
  const shown = useRef(0)
  useEffect(() => {
    shown.current = performance.now()
  }, [])
  return () => performance.now() - shown.current >= SESSION_TIMING.tapGuardMs
}
