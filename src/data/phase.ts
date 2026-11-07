import type { AuthStatus } from './auth'
import type { SyncStatus } from './sync'

// Ku shkon app-i në nisje (TH-22):
// - pa sesion: hyrja;
// - me profil të plotësuar në telefon: Sot, menjëherë, edhe pa internet;
// - pas hyrjes, para hapave: të dhënat ekzistuese merren nga Supabase, që një instalim i ri
//   të mos i përsërisë hapat dhe të mos krijojë një profil të dytë;
// - pastaj: hapat e hyrjes së parë.

export type AppPhase = 'loading' | 'signed_out' | 'fetching' | 'fetch_failed' | 'onboarding' | 'ready'

export interface PhaseInput {
  auth: AuthStatus
  /** Profili lokal ka onboarded_at; undefined sa kohë leximi lokal nuk ka mbaruar. */
  onboarded: boolean | undefined
  /** Të dhënat e këtij përdoruesi janë marrë të paktën një herë në këtë telefon. */
  pulled: boolean | undefined
  syncing: boolean
  lastStatus: SyncStatus | undefined
}

export function decidePhase(input: PhaseInput): AppPhase {
  if (input.auth === 'loading') return 'loading'
  if (input.auth === 'signed_out') return 'signed_out'
  if (input.onboarded === undefined || input.pulled === undefined) return 'loading'
  if (input.onboarded) return 'ready'
  if (input.pulled) return 'onboarding'
  if (!input.syncing && (input.lastStatus === 'offline' || input.lastStatus === 'error')) return 'fetch_failed'
  return 'fetching'
}
