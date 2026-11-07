import type { UpdateState } from '@/update/updater'

// Tekstet e përditësimit brenda app-it (SPEC §3b), për rreshtin te Sot, Cilësimet dhe fletën.

export const FAILURE_TEXT = {
  check: 'Kontrolli nuk u krye. Shiko internetin dhe provo përsëri.',
  download: 'Shkarkimi nuk u krye. Shiko internetin dhe provo përsëri.',
  mismatch: 'Skedari i shkarkuar nuk përputhet me versionin, ndaj nuk u instalua. Provo përsëri.',
  install: 'Android-i nuk e instaloi përditësimin. Provo përsëri.',
} as const

export const percent = (fraction: number) => `${Math.round(fraction * 100)}%`
export const megabytes = (bytes: number) => `${Math.round(bytes / 1_048_576)} MB`

/** Teksti i shkurtër i gjendjes, për rreshtin te Sot dhe te Cilësimet. */
export function updateDetail(state: UpdateState): string | null {
  switch (state.status) {
    case 'available':
      return 'Shiko çfarë ka të re'
    case 'permission':
      return 'Lejo instalimin nga Training Hub'
    case 'downloading':
      return `Po shkarkohet · ${percent(state.progress)}`
    case 'installing':
      return 'Po instalohet'
    case 'failed':
      return state.release ? 'Përditësimi nuk u krye' : null
    case 'checking':
      return 'Po kontrollohet'
    case 'current':
      return 'I fundit'
    default:
      return null
  }
}

/** Rreshti "Versioni" te Cilësimet: versioni i ri në pritje me numrin e tij, ndryshe si te Sot. */
export function versionRowDetail(state: UpdateState): string | null {
  const release = 'release' in state ? state.release : undefined
  if (release && (state.status === 'available' || state.status === 'permission' || state.status === 'failed')) return `${release.version} është gati`
  return updateDetail(state)
}
