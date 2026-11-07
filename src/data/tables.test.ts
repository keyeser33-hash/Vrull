import { TABLES } from './tables'

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
    expect([...TABLES]).toEqual(fromMigrations)
  })

  it('çdo prind vjen para fëmijës (çelësat e huaj)', () => {
    for (const [, child, body] of sql.matchAll(/create table public\.(\w+) \(([\s\S]*?)\n\);/g)) {
      for (const [, parent] of body.matchAll(/references public\.(\w+)/g)) {
        expect(TABLES.indexOf(parent as never), `${parent} para ${child}`).toBeLessThan(
          TABLES.indexOf(child as never),
        )
      }
    }
  })
})
