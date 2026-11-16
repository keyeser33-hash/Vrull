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

// Produktet e grupit (food_products, V59): grant me kolona. Dërgimi është `insert` vetëm me kolonat që lejohen (pa user_id dhe pa kolonat e
// serverit), marrja kërkon kolona të emërtuara (`select *` do të kërkonte `added_by`, që nuk lexohet). Një barkod që ekziston tashmë
// (23505, indeksi unik) do të thotë që grupi e ka produktin: rreshti pranohet dhe rreshti i grupit vjen me marrjen.
const PRODUCT_INSERT = ['id', 'barcode', 'source', 'license', 'name', 'brand', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'serving_g', 'serving_label', 'off_modified_at']
const PRODUCT_READ = [...PRODUCT_INSERT, 'created_at', 'updated_at', 'deleted_at', 'server_updated_at'].join(',')
const UNIQUE_VIOLATION = '23505'
// Tabela ende nuk është krijuar te serveri (migrimi pret përdoruesin): marrja e produkteve të grupit jep bosh, që sinkronizimi i të gjitha tabelave të tjera të mos dështojë.
const MISSING_TABLE = 'PGRST205'

async function insertProducts(client: SupabaseClient, rows: Row[]): Promise<Row[]> {
  const accepted: Row[] = []
  for (const row of rows) {
    const sent = Object.fromEntries(PRODUCT_INSERT.filter((column) => column in row).map((column) => [column, (row as Record<string, unknown>)[column]]))
    const { data, error, status } = await client.from('food_products').insert(sent).select(PRODUCT_READ)
    if (error?.code === UNIQUE_VIOLATION) {
      accepted.push(row)
      continue
    }
    if (error) fail(error, status)
    accepted.push(...((data ?? []) as unknown as Row[]))
  }
  return accepted
}

export function createSupabaseRemote(client: SupabaseClient): Remote {
  return {
    async upsert(table, rows) {
      if (table === 'food_products') return insertProducts(client, rows)
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
        .select(table === 'food_products' ? PRODUCT_READ : '*')
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
      if (error && table === 'food_products' && (error.code === MISSING_TABLE || status === 404)) return []
      if (error) fail(error, status)
      return (data ?? []) as unknown as Row[]
    },
  }
}
