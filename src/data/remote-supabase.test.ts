import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseRemote } from './remote-supabase'
import { RemoteError } from './sync'
import type { Row } from './tables'

// Produktet e grupit (food_products) kanë grant me kolona: dërgimi është `insert` pa user_id dhe pa kolonat e serverit, marrja kërkon kolona të emërtuara
// (jo `*`, që do të kërkonte `added_by`). Një barkod që ekziston tashmë është "grupi e ka", jo gabim.
function fakeClient(options: { insertError?: { code: string; message: string }; pulled?: Row[]; pullError?: { code: string; message: string; status: number } } = {}) {
  const calls: { table: string; method: string; args: unknown[] }[] = []
  const chain = (table: string, method: string, args: unknown[], result: () => unknown) => {
    calls.push({ table, method, args })
    const builder: Record<string, unknown> = {}
    for (const name of ['select', 'order', 'limit', 'or']) {
      builder[name] = (...next: unknown[]) => {
        calls.push({ table, method: name, args: next })
        return builder
      }
    }
    builder.then = (resolve: (value: unknown) => void) => resolve(result())
    return builder
  }
  const client = {
    from: (table: string) => ({
      insert: (rows: unknown) =>
        chain(table, 'insert', [rows], () =>
          options.insertError ? { data: null, error: options.insertError, status: 409 } : { data: (Array.isArray(rows) ? (rows as Row[]) : [rows as Row]).map((row) => ({ ...row, server_updated_at: '2026-11-16T10:00:00Z' })), error: null, status: 201 },
        ),
      upsert: (rows: unknown, config: unknown) => chain(table, 'upsert', [rows, config], () => ({ data: rows, error: null, status: 200 })),
      select: (columns: string) => chain(table, 'select', [columns], () => (options.pullError ? { data: null, error: options.pullError, status: options.pullError.status } : { data: options.pulled ?? [], error: null, status: 200 })),
    }),
  }
  return { client: client as unknown as SupabaseClient, calls }
}

const product = (overrides: Record<string, unknown> = {}) =>
  ({
    id: '33333333-3333-4333-8333-333333333333',
    user_id: '11111111-1111-4111-8111-111111111111',
    barcode: '3017620422003',
    source: 'open_food_facts',
    license: 'ODbL-1.0',
    name: 'Nutella',
    brand: 'Ferrero',
    kcal: 539,
    protein_g: 6.3,
    carbs_g: 57.5,
    fat_g: 30.9,
    fiber_g: 0,
    serving_g: 15,
    serving_label: '15 g',
    off_modified_at: null,
    created_at: '2026-11-16T09:00:00Z',
    updated_at: '2026-11-16T09:00:00Z',
    deleted_at: null,
    ...overrides,
  }) as unknown as Row

describe('sinkronizimi i produkteve të grupit', () => {
  it('dërgon me insert vetëm kolonat e lejuara (pa user_id, pa kolonat e serverit) dhe kërkon kolona të emërtuara', async () => {
    const { client, calls } = fakeClient()
    const accepted = await createSupabaseRemote(client).upsert('food_products', [product()])
    expect(calls[0].method).toBe('insert')
    const sent = calls[0].args[0] as Record<string, unknown>
    expect(Object.keys(sent).sort()).toEqual(['barcode', 'brand', 'carbs_g', 'fat_g', 'fiber_g', 'id', 'kcal', 'license', 'name', 'off_modified_at', 'protein_g', 'serving_g', 'serving_label', 'source'])
    expect(calls.find((call) => call.method === 'select')?.args[0]).not.toContain('added_by')
    expect(calls.find((call) => call.method === 'select')?.args[0]).toContain('server_updated_at')
    expect(accepted).toHaveLength(1)
    expect(accepted[0]).toMatchObject({ id: '33333333-3333-4333-8333-333333333333', server_updated_at: '2026-11-16T10:00:00Z' })
  })

  it('një barkod që ekziston tashmë te grupi (23505) pranohet pa gabim; gabimet e tjera e refuzojnë rreshtin', async () => {
    const duplicate = fakeClient({ insertError: { code: '23505', message: 'duplicate key value violates unique constraint "food_products_barcode"' } })
    const row = product()
    expect(await createSupabaseRemote(duplicate.client).upsert('food_products', [row])).toEqual([row])
    const invalid = fakeClient({ insertError: { code: '23514', message: 'new row violates check constraint' } })
    await expect(createSupabaseRemote(invalid.client).upsert('food_products', [row])).rejects.toBeInstanceOf(RemoteError)
  })

  it('marrja e produkteve nuk përdor select(*) dhe nuk kërkon added_by', async () => {
    const { client, calls } = fakeClient({ pulled: [product()] })
    const rows = await createSupabaseRemote(client).pull('food_products', null, 200)
    expect(rows).toHaveLength(1)
    const columns = String(calls.find((call) => call.method === 'select')?.args[0])
    expect(columns).not.toBe('*')
    expect(columns).not.toContain('added_by')
    expect(columns.split(',')).toEqual(expect.arrayContaining(['id', 'barcode', 'name', 'server_updated_at', 'deleted_at']))
  })

  it('tabela e produkteve ende pa migrim te serveri: marrja jep bosh, tabelat e tjera e shfaqin gabimin', async () => {
    const missing = { code: 'PGRST205', message: "Could not find the table 'public.food_products'", status: 404 }
    expect(await createSupabaseRemote(fakeClient({ pullError: missing }).client).pull('food_products', null, 200)).toEqual([])
    await expect(createSupabaseRemote(fakeClient({ pullError: missing }).client).pull('water_logs', null, 200)).rejects.toBeInstanceOf(RemoteError)
  })

  it('tabelat e tjera mbeten me upsert dhe select(*)', async () => {
    const { client, calls } = fakeClient()
    await createSupabaseRemote(client).upsert('water_logs', [{ id: 'w1' } as unknown as Row])
    expect(calls[0].method).toBe('upsert')
    await createSupabaseRemote(client).pull('water_logs', null, 10)
    expect(calls.findLast((call) => call.method === 'select')?.args[0]).toBe('*')
  })
})
