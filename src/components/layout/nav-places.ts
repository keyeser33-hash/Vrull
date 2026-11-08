import type { IconName } from '@/components/ui/icon-paths'
import type { MessageKey } from '@/i18n'

export type NavPlace = { to: string; label: Extract<MessageKey, `tab.${string}`>; icon: IconName }

// Pesë vendet e navigimit poshtë (SPEC §14); etiketat janë çelësa të katalogut (i18n/sq.ts).
export const NAV_PLACES: NavPlace[] = [
  { to: '/', label: 'tab.today', icon: 'kalendari-nav' },
  { to: '/programi', label: 'tab.programme', icon: 'fitnes' },
  { to: '/ushqimi', label: 'tab.food', icon: 'ushqimi' },
  { to: '/progresi', label: 'tab.progress', icon: 'analitika' },
  { to: '/trupi', label: 'tab.body', icon: 'perdoruesi' },
]
