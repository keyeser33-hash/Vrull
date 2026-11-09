// Tabelat e sinkronizuara (SPEC §15), në radhën e lidhjeve: prindi para fëmijës. Sinkronizimi i
// dërgon me këtë radhë, që një rresht të mos arrijë në Supabase para rreshtit ku tregon.
export const TABLES = [
  'exercises',
  'programs',
  'program_blocks',
  'program_days',
  'program_slots',
  'slot_prescriptions',
  'program_state',
  'workout_sessions',
  'set_logs',
  'one_rm_overrides',
  'body_measurements',
  'progress_photos',
  'foods',
  'recipes',
  'recipe_items',
  'meal_templates',
  'diary_entries',
  'nutrition_targets',
  'supplements',
  'supplement_logs',
  'user_settings',
  'week_weights',
  'form_videos',
  // Kostoja e AI-së (V2-E1-11): e shkruan vetëm funksioni program-import; telefoni vetëm e merr.
  'ai_usage',
  // Uji (V36, V2-E2-07).
  'water_logs',
  // Kontrolli javor (V33, V2-E2-04).
  'weekly_checks',
] as const

export type TableName = (typeof TABLES)[number]

// Gjendja lokale e një rreshti: 0 i sinkronizuar, 1 pret dërgimin, 2 i refuzuar nga serveri
// (provohet përsëri një nga një, që të mos bllokojë rreshtat e tjerë).
export const CLEAN = 0
export const PENDING = 1
export const REJECTED = 2
export type DirtyState = typeof CLEAN | typeof PENDING | typeof REJECTED

// Kolonat e përbashkëta të çdo tabele (migrimi schema_v1).
export interface SyncColumns {
  id: string
  user_id: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  server_updated_at?: string | null
}

// Fushat që jetojnë vetëm në telefon dhe nuk dërgohen kurrë.
export interface LocalColumns {
  _dirty: DirtyState
  _error?: string
}

export type Row = SyncColumns & Record<string, unknown>
export type LocalRow = Row & LocalColumns

// Indekset e Dexie përveç çelësit kryesor dhe _dirty. Të shtohen këtu sipas nevojës së ekraneve;
// çdo ndryshim kërkon një version të ri te db.ts.
export const INDEXES: Record<TableName, string[]> = {
  exercises: ['library_id'],
  programs: [],
  program_blocks: ['program_id'],
  program_days: ['program_id'],
  program_slots: ['program_id', 'day_id'],
  slot_prescriptions: ['program_id', 'slot_id'],
  program_state: ['program_id'],
  workout_sessions: ['date', 'program_id'],
  set_logs: ['session_id', 'exercise_id'],
  one_rm_overrides: ['exercise_id'],
  body_measurements: ['date'],
  progress_photos: ['date'],
  foods: ['[source+source_id]'],
  recipes: [],
  recipe_items: ['recipe_id'],
  meal_templates: [],
  diary_entries: ['date'],
  nutrition_targets: ['date'],
  supplements: [],
  supplement_logs: ['date', 'supplement_id'],
  water_logs: ['date'],
  weekly_checks: ['week_start'],
  user_settings: [],
  week_weights: ['program_id'],
  form_videos: ['exercise_id', 'session_id'],
  ai_usage: ['month'],
}
