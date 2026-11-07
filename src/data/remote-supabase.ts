import type { SupabaseClient } from '@supabase/supabase-js'
import { NetworkError, RemoteError, type Remote } from './sync'
import type { Row } from './tables'

// Përshtatja e Supabase (PostgREST) me ndërfaqen Remote të sinkronizimit.
// Gabimet ndahen në tri lloje, sepse sinkronizimi sillet ndryshe me secilin:
// - pa lidhje (status 0) ose server i padisponueshëm (5xx, p.sh. projekti në pauzë): NetworkError,
//   provohet më vonë;
// - sesioni i skaduar (401): Error i zakonshëm, sinkronizimi ndalet pa prekur rreshtat;
// - gabim i një rreshti (4xx tjetër, p.sh. një kontroll i skemës): RemoteError, rreshti veçohet.

interface Failure {
  message: string
  code?: string
}

function fail(error: Failure, status: number): never {
  if (status === 0 || status >= 500) throw new NetworkError(error.message)
  if (status === 401) throw new Error(`Sesioni nuk vlen më: ${error.message}`)
  throw new RemoteError(error.message, error.code)
}

export function createSupabaseRemote(client: SupabaseClient): Remote {
  return {
    async upsert(table, rows) {
      // defaultToNull: false, që një kolonë që mungon në rresht të marrë vlerën e parazgjedhur të skemës.
      const { data, error, status } = await client
        .from(table)
        .upsert(rows, { onConflict: 'id', defaultToNull: false })
        .select()
      if (error) fail(error, status)
      return (data ?? []) as Row[]
    },

    async pull(table, after, limit) {
      let query = client
        .from(table)
        .select('*')
        .order('server_updated_at', { ascending: true })
        .order('id', { ascending: true })
        .limit(limit)
      if (after) {
        // Vlerat në thonjëza: koha përmban "+" dhe ":".
        query = query.or(
          `server_updated_at.gt."${after.at}",and(server_updated_at.eq."${after.at}",id.gt.${after.id})`,
        )
      }
      const { data, error, status } = await query
      if (error) fail(error, status)
      return (data ?? []) as Row[]
    },
  }
}
