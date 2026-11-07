import type { SyncStatus } from './scheduler'

// Gjendja e sinkronizimit me fjalë, për Cilësimet (SPEC §14: gjendjet shkruhen me fjalë).

function relative(at: Date, now: Date) {
  const minutes = Math.floor((now.getTime() - at.getTime()) / 60_000)
  if (minutes < 1) return 'tani'
  if (minutes < 60) return `para ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return hours === 1 ? 'para 1 ore' : `para ${hours} orësh`
  const pad = (value: number) => String(value).padStart(2, '0')
  return `më ${pad(at.getDate())}.${pad(at.getMonth() + 1)}.${at.getFullYear()}, ${pad(at.getHours())}:${pad(at.getMinutes())}`
}

export function describeSync(status: SyncStatus, now: Date = new Date()): string {
  if (status.syncing) return 'Po sinkronizohet'
  const last = status.last
  if (!last) return 'Ende pa sinkronizim'
  switch (last.status) {
    case 'ok':
      return `Sinkronizuar ${relative(new Date(last.at), now)}`
    case 'offline':
      return 'Pa internet. Ndryshimet ruhen në telefon dhe dërgohen kur të kthehet rrjeti.'
    case 'signed_out':
      return 'Hyr në llogari që të dhënat të ruhen edhe në Supabase.'
    case 'error':
      if (last.rejected === 1) return '1 ndryshim nuk u pranua nga serveri. Mbetet në telefon.'
      if (last.rejected > 1) return `${last.rejected} ndryshime nuk u pranuan nga serveri. Mbeten në telefon.`
      return 'Sinkronizimi nuk u krye. Provohet përsëri vetë.'
  }
}
