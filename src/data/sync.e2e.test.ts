// @vitest-environment node
// Prova reale me Supabase (TH-04): kërkon një përdorues prove, prandaj ekzekutohet vetëm me
// E2E_EMAIL dhe E2E_PASSWORD. Përdoruesi krijohet përkohësisht dhe fshihet pas provës
// (fshirja e tij heq edhe rreshtat e tij).
//   E2E_EMAIL=... E2E_PASSWORD=... npx vitest run src/data/sync.e2e.test.ts
import { createClient } from '@supabase/supabase-js'
import { createDatabase } from './db'
import { createSupabaseRemote } from './remote-supabase'
import { createLocalStore } from './store'
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './supabase'
import { createSync } from './sync'
import { CLEAN, PENDING, TABLES } from './tables'
import { weekWeightId } from './week-weights'

const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {}
const email = env.E2E_EMAIL
const password = env.E2E_PASSWORD

describe.skipIf(!email || !password)('sinkronizimi me Supabase të vërtetë', { timeout: 60_000 }, () => {
  let offline = false
  const fetchWithSwitch: typeof fetch = (input, init) =>
    offline ? Promise.reject(new TypeError('fetch failed')) : fetch(input, init)
  const client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: fetchWithSwitch },
  })
  let userId = ''

  // Dy pajisje me orë të ndryshme, që konflikti të ketë një fitues të qartë.
  function device(offsetMs: number) {
    const db = createDatabase(`e2e-${crypto.randomUUID()}`)
    const now = () => new Date(Date.now() + offsetMs)
    return {
      db,
      store: createLocalStore(db, { userId: () => userId, now }),
      sync: createSync({ db, remote: createSupabaseRemote(client), userId: () => userId, now }),
    }
  }

  beforeAll(async () => {
    const { data, error } = await client.auth.signInWithPassword({ email: email!, password: password! })
    if (error) throw error
    userId = data.user.id
    // Nis nga e pastra: rreshtat e një ekzekutimi të mëparshëm do të shkelnin rregullat e unicitetit
    // (një matje për datë, një ushtrim për library_id). Fëmijët fshihen para prindërve.
    // `ai_usage` e shkruan vetëm serveri (RLS): app-i nuk e fshin dot.
    for (const table of [...TABLES].reverse().filter((name) => name !== 'ai_usage')) {
      const { error: deleteError } = await client.from(table).delete().eq('user_id', userId)
      if (deleteError) throw deleteError
    }
  })

  it('një set i regjistruar pa internet del në Supabase kur kthehet rrjeti', async () => {
    const phone = device(0)
    offline = true
    const exercise = await phone.store.put('exercises', { name: 'Bench Press', equipment: 'barbell', library_id: 'Barbell_Bench_Press_-_Medium_Grip' })
    const session = await phone.store.put('workout_sessions', { date: '2026-11-30', status: 'in_progress', started_at: new Date().toISOString() })
    const set = await phone.store.put('set_logs', {
      session_id: session.id,
      exercise_id: exercise.id,
      position: 0,
      set_number: 1,
      weight_kg: 60,
      reps: 12,
      rir: 2,
    })

    expect(await phone.sync.run()).toMatchObject({ status: 'offline', pushed: 0 })
    expect((await phone.db.set_logs.get(set.id))?._dirty).toBe(PENDING)

    offline = false
    expect(await phone.sync.run()).toMatchObject({ status: 'ok', pushed: 3, rejected: 0 })
    expect((await phone.db.set_logs.get(set.id))?._dirty).toBe(CLEAN)

    const { data } = await client.from('set_logs').select('id, weight_kg, reps, rir, user_id, session_id').eq('id', set.id)
    expect(data).toEqual([{ id: set.id, weight_kg: 60, reps: 12, rir: 2, user_id: userId, session_id: session.id }])
  })

  it('konflikti: fiton ndryshimi më i ri, edhe kur pajisja tjetër sinkronizon më vonë', async () => {
    const phone = device(0)
    const tablet = device(10_000)
    const row = await phone.store.put('body_measurements', { date: '2026-12-01', weight_kg: 80 })
    await phone.sync.run()
    await tablet.sync.run()
    expect(await tablet.store.get('body_measurements', row.id)).toMatchObject({ weight_kg: 80 })

    await phone.store.put('body_measurements', { id: row.id, weight_kg: 81 })
    await tablet.store.put('body_measurements', { id: row.id, weight_kg: 82 })
    await tablet.sync.run()
    await phone.sync.run()

    const { data } = await client.from('body_measurements').select('weight_kg').eq('id', row.id).single()
    expect(data?.weight_kg).toBe(82)
    expect(await phone.store.get('body_measurements', row.id)).toMatchObject({ weight_kg: 82, _dirty: CLEAN })
  })

  it('fshirja arrin në Supabase dhe në pajisjen tjetër', async () => {
    const phone = device(0)
    const tablet = device(0)
    const entry = await phone.store.put('diary_entries', {
      date: '2026-12-01',
      meal: 'lunch',
      grams: 200,
      kcal: 260,
      protein_g: 5.4,
      carbs_g: 56,
      fat_g: 0.6,
      food_id: (await phone.store.put('foods', { source: 'custom', name: 'Oriz i zier', kcal: 130, protein_g: 2.7, carbs_g: 28, fat_g: 0.3 })).id,
    })
    await phone.sync.run()
    await tablet.sync.run()
    expect(await tablet.store.get('diary_entries', entry.id)).toBeDefined()

    await phone.store.remove('diary_entries', entry.id)
    await phone.sync.run()
    const { data } = await client.from('diary_entries').select('deleted_at').eq('id', entry.id).single()
    expect(data?.deleted_at).not.toBeNull()

    await tablet.sync.run()
    expect(await tablet.store.get('diary_entries', entry.id)).toBeUndefined()
  })

  // V2-E2-00: tabelat e E1 që provat e skedarëve i provojnë vetëm me bazën vendase.
  it('peshat e javës: dy pajisje me të njëjtin vendim japin një rresht; fshirja dhe rikthimi arrijnë në Supabase', async () => {
    const phone = device(0)
    const tablet = device(5_000)
    const exercise = await phone.store.put('exercises', { name: 'Leg Press', equipment: 'machine' })
    const program = await phone.store.put('programs', { name: 'Prova e2e' })
    const block = await phone.store.put('program_blocks', { program_id: program.id, position: 0, name: 'Faza 1', weeks: 4 })
    const day = await phone.store.put('program_days', { program_id: program.id, position: 0, name: 'Dita 1' })
    const slot = await phone.store.put('program_slots', { program_id: program.id, day_id: day.id, position: 0, exercise_id: exercise.id, sets: 3 })
    await phone.sync.run()
    await tablet.sync.run()

    const id = await weekWeightId({ programId: program.id, run: 1, blockId: block.id, week: 2, slotId: slot.id })
    const decision = { id, program_id: program.id, run: 1, block_id: block.id, week: 2, slot_id: slot.id, exercise_id: exercise.id, status: 'accepted' }
    await phone.store.put('week_weights', { ...decision, weight_kg: 100 })
    await tablet.store.put('week_weights', { ...decision, weight_kg: 105 })
    expect(await phone.sync.run()).toMatchObject({ status: 'ok', rejected: 0 })
    expect(await tablet.sync.run()).toMatchObject({ status: 'ok', rejected: 0 })
    const { data } = await client.from('week_weights').select('id, weight_kg').eq('slot_id', slot.id).is('deleted_at', null)
    expect(data).toEqual([{ id, weight_kg: 105 }])

    await phone.sync.run()
    await phone.store.remove('week_weights', id)
    await phone.sync.run()
    await phone.store.put('week_weights', { ...decision, weight_kg: 110 }, { revive: true })
    expect(await phone.sync.run()).toMatchObject({ status: 'ok', rejected: 0 })
    const { data: revived } = await client.from('week_weights').select('weight_kg, deleted_at').eq('id', id).single()
    expect(revived).toEqual({ weight_kg: 110, deleted_at: null })
  })

  it('videoja e formës: rreshti sinkronizohet vetëm me rrugën te dosja e pronarit', async () => {
    const phone = device(0)
    const exercise = await phone.store.put('exercises', { name: 'Squat', equipment: 'barbell' })
    const video = { exercise_id: exercise.id, date: '2026-12-03', mime_type: 'video/mp4', duration_s: 12.5, bytes: 1_000_000 }
    const own = await phone.store.put('form_videos', { ...video, storage_path: `${userId}/${crypto.randomUUID()}.mp4` })
    const foreign = await phone.store.put('form_videos', { ...video, storage_path: `${crypto.randomUUID()}/${crypto.randomUUID()}.mp4` })
    expect(await phone.sync.run()).toMatchObject({ status: 'error', rejected: 1 })
    expect((await phone.db.form_videos.get(foreign.id))?._error).toBeTruthy()
    const { data } = await client.from('form_videos').select('id, duration_s').eq('id', own.id)
    expect(data).toEqual([{ id: own.id, duration_s: 12.5 }])
  })

  it('kostoja e AI-së: app-i e lexon, por nuk e shkruan dot', async () => {
    const { error } = await client.from('ai_usage').insert({
      user_id: userId,
      month: '2026-12-01',
      feature: 'program_pdf',
      model: 'prova',
      input_tokens: 1,
      output_tokens: 1,
      cost_usd: 0,
      cost_eur: 0,
    })
    expect(error).not.toBeNull()
    const { data, error: readError } = await client.from('ai_usage').select('id').eq('user_id', userId)
    expect(readError).toBeNull()
    expect(data).toEqual([])
  })

  it('një rresht që shkel skemën nuk bllokon të tjerët', async () => {
    const phone = device(0)
    const bad = await phone.store.put('body_measurements', { date: '2026-12-02', weight_kg: 5 })
    const good = await phone.store.put('supplements', { name: 'Creatine', dose_amount: 5, dose_unit: 'g', evidence: 'strong' })
    const result = await phone.sync.run()
    expect(result).toMatchObject({ status: 'error', rejected: 1 })
    expect((await phone.db.body_measurements.get(bad.id))?._error).toMatch(/check constraint/)
    const { data } = await client.from('supplements').select('id').eq('id', good.id)
    expect(data).toHaveLength(1)
  })
})
