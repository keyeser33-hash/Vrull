import Dexie from 'dexie'
import { createDatabase } from './db'

// Baza e një telefoni me versionin 2 (para peshave të javës) hapet me kodin e ri pa humbur asgjë.
describe('baza lokale', () => {
  it('një bazë e versionit 2 kalon te versioni i ri: rreshtat mbeten dhe tabela e re punon', async () => {
    const name = `db-${crypto.randomUUID()}`
    const old = new Dexie(name)
    const tables = [
      'exercises', 'programs', 'program_blocks', 'program_days', 'program_slots', 'slot_prescriptions', 'program_state',
      'workout_sessions', 'set_logs', 'one_rm_overrides', 'body_measurements', 'progress_photos', 'foods', 'recipes',
      'recipe_items', 'meal_templates', 'diary_entries', 'nutrition_targets', 'supplements', 'supplement_logs', 'user_settings',
    ]
    old.version(1).stores({ _meta: 'key', ...Object.fromEntries(tables.map((table) => [table, 'id, _dirty'])) })
    old.version(2).stores({ _photo_files: 'id, uploaded' })
    await old.open()
    await old.table('set_logs').put({ id: 'set-1', _dirty: 0, weight_kg: 60, reps: 13 })
    old.close()

    const db = createDatabase(name)
    await db.open()
    expect(db.tables.map((table) => table.name)).toContain('week_weights')
    expect(await db.set_logs.get('set-1')).toMatchObject({ weight_kg: 60, reps: 13 })
    await db.week_weights.put({ id: 'w-1', _dirty: 1, program_id: 'p' } as never)
    expect(await db.week_weights.where('program_id').equals('p').count()).toBe(1)
    db.close()
  })
})
