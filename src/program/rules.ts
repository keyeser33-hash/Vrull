import type { Program, SlotOverride } from './types'

// Rregullat e një sloti në një nivel të editorit (SPEC §4): i gjithë programi, një bllok, një
// javë në çdo bllok, ose një javë e një blloku. Për çdo fushë: vlera që vlen aty dhe nga cili
// nivel vjen.

export interface Scope {
  /** null: çdo bllok. */
  blockId: string | null
  /** null: çdo javë. */
  week: number | null
}

export type RuleField = 'exerciseId' | 'sets' | 'restSeconds' | 'prescription' | 'technique'

export interface Resolved<T> {
  value: T
  /** Niveli i rregullit që fiton; null: vlera e vetë slotit (ose asnjë rregull). */
  from: Scope | null
}

export type SlotRules = {
  [K in RuleField]: Resolved<K extends 'exerciseId' | 'sets' | 'restSeconds' ? NonNullable<SlotOverride[K]> : SlotOverride[K] | undefined>
}

export function slotRules(program: Program, slotId: string, scope: Scope): SlotRules {
  const slot = program.slots.find((candidate) => candidate.id === slotId)
  if (!slot) throw new Error('Sloti nuk gjendet.')
  function field<K extends RuleField>(name: K) {
    const row = resolveRow(program.overrides, slotId, scope, name)
    return row ? { value: row[name], from: { blockId: row.blockId, week: row.week } } : { value: undefined, from: null }
  }
  const exerciseId = field('exerciseId')
  const sets = field('sets')
  const restSeconds = field('restSeconds')
  return {
    exerciseId: { value: exerciseId.value ?? slot.exerciseId, from: exerciseId.from },
    sets: { value: sets.value ?? slot.sets, from: sets.from },
    restSeconds: { value: restSeconds.value ?? slot.restSeconds, from: restSeconds.from },
    prescription: field('prescription'),
    technique: field('technique'),
  } as SlotRules
}

/**
 * Rreshti më i saktë që e ka fushën dhe vlen në këtë nivel (blloku dhe java > vetëm blloku >
 * vetëm java > i gjithë programi). Një rregull blloku nuk vlen në nivelin "çdo bllok", e njëjta
 * për javën.
 */
export function resolveRow<K extends keyof SlotOverride>(overrides: SlotOverride[], slotId: string, scope: Scope, field: K) {
  let best: SlotOverride | undefined
  let bestScore = -1
  for (const row of overrides) {
    if (row.slotId !== slotId || row[field] === null || row[field] === undefined) continue
    if (row.blockId !== null && row.blockId !== scope.blockId) continue
    if (row.week !== null && row.week !== scope.week) continue
    const score = (row.blockId === null ? 0 : 2) + (row.week === null ? 0 : 1)
    if (score > bestScore) {
      best = row
      bestScore = score
    }
  }
  return best
}

export const sameScope = (a: Scope | null, b: Scope) => a !== null && a.blockId === b.blockId && a.week === b.week

export function describeScope(scope: Scope | null, blockNames: Record<string, string>): string {
  if (!scope) return 'Nga ushtrimi i slotit'
  const block = scope.blockId ? blockNames[scope.blockId] : null
  if (block && scope.week) return `Për ${block} · Java ${scope.week}`
  if (block) return `Për ${block}`
  if (scope.week) return `Për javën ${scope.week} të çdo blloku`
  return 'Për gjithë programin'
}
