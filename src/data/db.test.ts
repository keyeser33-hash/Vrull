import Dexie from 'dexie'
import { createDatabase } from './db'

// Tabelat e sinkronizuara të versionit 1 të bazës lokale.
const TABLES_V1 = [
  'exercises', 'programs', 'program_blocks', 'program_days', 'program_slots', 'slot_prescriptions', 'program_state',
  'workout_sessions', 'set_logs', 'one_rm_overrides', 'body_measurements', 'progress_photos', 'foods', 'recipes',
  'recipe_items', 'meal_templates', 'diary_entries', 'nutrition_targets', 'supplements', 'supplement_logs', 'user_settings',
]

// Baza e një telefoni me versionin 2 (para peshave të javës) hapet me kodin e ri pa humbur asgjë.
describe('baza lokale', () => {
  it('një bazë e versionit 2 kalon te versioni i ri: rreshtat mbeten dhe tabela e re punon', async () => {
    const name = `db-${crypto.randomUUID()}`
    const old = new Dexie(name)
    old.version(1).stores({ _meta: 'key', ...Object.fromEntries(TABLES_V1.map((table) => [table, 'id, _dirty'])) })
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

  it('një bazë e versionit 3 merr videot e formës (V2-E1-13) pa humbur fotot dhe peshat e javës', async () => {
    const name = `db-${crypto.randomUUID()}`
    // Skema e versionit 3, siç është në telefonat para kësaj detyre.
    const old = new Dexie(name)
    old.version(1).stores({ _meta: 'key', ...Object.fromEntries(TABLES_V1.map((table) => [table, 'id, _dirty'])) })
    old.version(2).stores({ _photo_files: 'id, uploaded' })
    old.version(3).stores({ week_weights: 'id, _dirty, program_id' })
    await old.open()
    await old.table('week_weights').put({ id: 'w-1', _dirty: 0, program_id: 'p' })
    await old.table('_photo_files').put({ id: 'f-1', data: new ArrayBuffer(2), type: 'image/jpeg', uploaded: 1, storagePath: 'u/f-1.jpg' })
    old.close()

    const db = createDatabase(name)
    await db.open()
    expect(db.verno).toBe(5)
    expect(await db.week_weights.get('w-1')).toMatchObject({ program_id: 'p' })
    expect(await db._photo_files.get('f-1')).toMatchObject({ storagePath: 'u/f-1.jpg' })
    await db.form_videos.put({ id: 'v-1', _dirty: 1, exercise_id: 'e', session_id: 's' } as never)
    expect(await db.form_videos.where('exercise_id').equals('e').count()).toBe(1)
    await db._video_files.put({ id: 'v-1', data: null, type: 'video/mp4', uploaded: 1, removed: 1, storagePath: 'u/v-1.mp4' })
    expect(await db._video_files.where('removed').equals(1).count()).toBe(1)
    db.close()
  })

  it('një bazë e versionit 4 merr koston e AI-së (V2-E1-11) pa humbur videot', async () => {
    const name = `db-${crypto.randomUUID()}`
    const old = new Dexie(name)
    old.version(1).stores({ _meta: 'key', ...Object.fromEntries(TABLES_V1.map((table) => [table, 'id, _dirty'])) })
    old.version(2).stores({ _photo_files: 'id, uploaded' })
    old.version(3).stores({ week_weights: 'id, _dirty, program_id' })
    old.version(4).stores({ form_videos: 'id, _dirty, exercise_id, session_id', _video_files: 'id, uploaded, removed' })
    await old.open()
    await old.table('form_videos').put({ id: 'v-1', _dirty: 0, exercise_id: 'e', session_id: 's' })
    old.close()

    const db = createDatabase(name)
    await db.open()
    expect(db.verno).toBe(5)
    expect(await db.form_videos.get('v-1')).toMatchObject({ exercise_id: 'e' })
    await db.ai_usage.put({ id: 'a-1', _dirty: 0, month: '2026-11-01', cost_eur: 0.27 } as never)
    expect(await db.ai_usage.where('month').equals('2026-11-01').count()).toBe(1)
    db.close()
  })
})
