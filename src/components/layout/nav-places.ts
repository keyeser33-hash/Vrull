import type { IconName } from '@/components/ui/icons'
import type { MessageKey } from '@/i18n'

// Pesë tab-et e Vrullit (SPEC §0.3a): Sot, Programi, Ushqimi, Progresi, Miqtë. Etiketat janë
// çelësa të katalogut; ikonat janë ato të tab-bar-it të sistemit (icon-paths-vrull.ts).
export type TabId = 'today' | 'programme' | 'food' | 'progress' | 'friends'

export type NavPlace = { id: TabId; to: string; label: Extract<MessageKey, `tab.${string}`>; icon: IconName }

export const NAV_PLACES: NavPlace[] = [
  { id: 'today', to: '/', label: 'tab.today', icon: 'sot' },
  { id: 'programme', to: '/programi', label: 'tab.programme', icon: 'programi' },
  { id: 'food', to: '/ushqimi', label: 'tab.food', icon: 'pjata' },
  { id: 'progress', to: '/progresi', label: 'tab.progress', icon: 'progresi' },
  { id: 'friends', to: '/miqte', label: 'tab.friends', icon: 'miqte' },
]

/**
 * Çdo rrugë brenda kornizës e thotë te `handle`: cili tab është aktiv, ose `null` kur ekrani nuk ka
 * tab-bar (cilësimet dhe editorët, si te bordet). Seanca është jashtë kornizës.
 */
export interface ShellHandle {
  tab: TabId | null
}

const isShellHandle = (handle: unknown): handle is ShellHandle =>
  typeof handle === 'object' && handle !== null && 'tab' in handle

/** Tab-i i ekranit të hapur, nga rruga më e thellë që e thotë; `null` pa tab-bar. */
export function activeTab(matches: readonly { handle?: unknown }[]): TabId | null {
  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const handle = matches[index].handle
    if (isShellHandle(handle)) return handle.tab
  }
  return null
}
