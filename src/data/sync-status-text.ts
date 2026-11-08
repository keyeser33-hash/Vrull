import { currentI18n, type I18n } from '@/i18n'
import type { SyncStatus } from './scheduler'

// Gjendja e sinkronizimit me fjalë, për Cilësimet (SPEC §14: gjendjet shkruhen me fjalë).
// Komponenti i jep gjuhën nga useI18n(), që teksti të ndërrohet bashkë me gjuhën.

function relative(at: Date, now: Date, { t, fmt }: I18n) {
  const minutes = Math.floor((now.getTime() - at.getTime()) / 60_000)
  if (minutes < 1) return t('sync.justNow')
  if (minutes < 60) return t('sync.minutesAgo', { minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('sync.hoursAgo', { count: hours })
  return t('sync.on', { date: fmt.numericDate(at), time: fmt.time(at) })
}

export function describeSync(status: SyncStatus, now: Date = new Date(), i18n: I18n = currentI18n()): string {
  const { t } = i18n
  if (status.syncing) return t('sync.syncing')
  const last = status.last
  if (!last) return t('sync.never')
  switch (last.status) {
    case 'ok':
      return t('sync.done', { when: relative(new Date(last.at), now, i18n) })
    case 'offline':
      return t('sync.offline')
    case 'signed_out':
      return t('sync.signedOut')
    case 'error':
      if (last.rejected > 0) return t('sync.rejected', { count: last.rejected })
      return t('sync.failed')
  }
}
