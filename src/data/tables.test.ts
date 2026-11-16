import { SHARED_TABLES, TABLES, USER_TABLES } from './tables'

// Tabelat lokale duhet të jenë saktësisht ato të migrimeve, që asnjë tabelë të mos mbetet pa sinkronizim.
const migrations = import.meta.glob<string>('../../supabase/migrations/*.sql', {
  query: '?raw',
  import: 'default',
  eager: true,
})
const sql = Object.keys(migrations)
  .sort()
  .map((file) => migrations[file])
  .join('\n')

describe('tabelat e sinkronizuara', () => {
  it('përputhen me migrimet e Supabase, në të njëjtën radhë', () => {
    const fromMigrations = [...sql.matchAll(/private\.setup_sync_table\('(\w+)'\)/g)].map((match) => match[1])
    expect(fromMigrations).not.toHaveLength(0)
    // Tabelat e përbashkëta (`food_products`) kanë sync_touch të vetin te migrimi i tyre, jo `setup_sync_table`, dhe vijnë në fund.
    expect([...TABLES]).toEqual([...fromMigrations, ...SHARED_TABLES])
    expect([...USER_TABLES]).toEqual(fromMigrations)
  })

  it('tabelat e përbashkëta kanë migrimin, politikën e leximit dhe nuk e lexojnë added_by', () => {
    for (const table of SHARED_TABLES) {
      expect(sql).toMatch(new RegExp(`create table public\\.${table} \\(`))
      expect(sql).toMatch(new RegExp(`create trigger sync_touch before insert or update on public\\.${table}`))
      expect(sql).toMatch(new RegExp(`create policy read_all on public\\.${table} for select to authenticated`))
    }
    const grantSelect = sql.match(/grant select \(([^)]*)\)\s+on public\.food_products/)?.[1] ?? ''
    expect(grantSelect).not.toContain('added_by')
    expect(grantSelect).toContain('server_updated_at')
  })

  it('Lista e Vrullit (food_catalog) nuk sinkronizohet nga app-i: asnjë tabelë e saj te TABLES', () => {
    expect([...TABLES]).not.toContain('food_catalog')
    expect([...TABLES]).not.toContain('food_catalog_versions')
  })

  it('çdo prind vjen para fëmijës (çelësat e huaj)', () => {
    for (const [, child, body] of sql.matchAll(/create table public\.(\w+) \(([\s\S]*?)\n\);/g)) {
      // Tabelat e përbashkëta (Lista e Vrullit, produktet) nuk sinkronizohen me rreshtat e përdoruesit.
      if (!TABLES.includes(child as never)) continue
      for (const [, parent] of body.matchAll(/references public\.(\w+)/g)) {
        expect(TABLES.indexOf(parent as never), `${parent} para ${child}`).toBeLessThan(
          TABLES.indexOf(child as never),
        )
      }
    }
  })
})
