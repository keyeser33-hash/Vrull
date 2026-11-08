import { currentI18n, type I18n } from '@/i18n'
import type { UpdateState } from '@/update/updater'

type UpdateFailure = Extract<UpdateState, { status: 'failed' }>['reason']

// Tekstet e përditësimit brenda app-it (SPEC §3b), për rreshtin te Sot, Cilësimet dhe fletën.
// Komponentët japin gjuhën nga useI18n(), që teksti të ndërrohet bashkë me gjuhën.

export const failureText = (reason: UpdateFailure, { t }: I18n = currentI18n()) => t(`update.failure.${reason}`)

export const percent = (fraction: number) => `${Math.round(fraction * 100)}%`
export const megabytes = (bytes: number, { fmt }: I18n = currentI18n()) => fmt.unit(Math.round(bytes / 1_048_576), 'MB')

/** Teksti i shkurtër i gjendjes, për rreshtin te Sot dhe te Cilësimet. */
export function updateDetail(state: UpdateState, { t }: I18n = currentI18n()): string | null {
  switch (state.status) {
    case 'available':
      return t('update.detail.available')
    case 'permission':
      return t('update.detail.permission')
    case 'downloading':
      return t('update.detail.downloading', { percent: percent(state.progress) })
    case 'installing':
      return t('update.detail.installing')
    case 'failed':
      return state.release ? t('update.detail.failed') : null
    case 'checking':
      return t('update.detail.checking')
    case 'current':
      return t('update.detail.current')
    default:
      return null
  }
}

/** Rreshti "Versioni" te Cilësimet: versioni i ri në pritje me numrin e tij, ndryshe si te Sot. */
export function versionRowDetail(state: UpdateState, i18n: I18n = currentI18n()): string | null {
  const release = 'release' in state ? state.release : undefined
  if (release && (state.status === 'available' || state.status === 'permission' || state.status === 'failed')) {
    return i18n.t('update.readyShort', { version: release.version })
  }
  return updateDetail(state, i18n)
}
