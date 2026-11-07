import type { IconName } from '@/components/ui/icon-paths'

export type NavPlace = { to: string; label: string; icon: IconName }

// Pesë vendet e navigimit poshtë (SPEC §14).
export const NAV_PLACES: NavPlace[] = [
  { to: '/', label: 'Sot', icon: 'kalendari-nav' },
  { to: '/programi', label: 'Programi', icon: 'fitnes' },
  { to: '/ushqimi', label: 'Ushqimi', icon: 'ushqimi' },
  { to: '/progresi', label: 'Progresi', icon: 'analitika' },
  { to: '/trupi', label: 'Trupi', icon: 'perdoruesi' },
]
