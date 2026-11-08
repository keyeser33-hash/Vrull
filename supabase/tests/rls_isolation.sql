-- Prova e izolimit (TH-03): një përdorues tjetër nuk sheh, nuk ndryshon dhe nuk fshin asnjë rresht
-- dhe asnjë foto të përdoruesit të parë; anon nuk ka qasje; fiton ndryshimi i fundit.
-- Gjithçka ndodh në një transaksion që kthehet mbrapsht: projekti nuk ndryshon.
-- Ekzekutimi: psql "$DATABASE_URL" -f supabase/tests/rls_isolation.sql (ose SQL Editor / MCP).
-- Rezultati: një rresht për çdo kontroll, me ok = true. Çdo ok = false është gabim.

begin;

create temporary table test_results (check_name text, ok boolean, detail text) on commit drop;

do $$
declare
  user_a uuid := gen_random_uuid();
  user_b uuid := gen_random_uuid();
  ex uuid; prog uuid; blk uuid; dy uuid; slot uuid; sess uuid; fd uuid; rcp uuid; supp uuid;
  t text;
  n bigint;
  results text[] := '{}';
  tables text[] := array[
    'exercises', 'programs', 'program_blocks', 'program_days', 'program_slots',
    'slot_prescriptions', 'program_state', 'workout_sessions', 'set_logs', 'one_rm_overrides',
    'body_measurements', 'progress_photos', 'foods', 'recipes', 'recipe_items', 'meal_templates',
    'diary_entries', 'nutrition_targets', 'supplements', 'supplement_logs', 'user_settings', 'week_weights'
  ];
begin
  insert into auth.users (id, aud, role, email, created_at, updated_at)
  values (user_a, 'authenticated', 'authenticated', 'a@test.invalid', now(), now()),
         (user_b, 'authenticated', 'authenticated', 'b@test.invalid', now(), now());

  -- Përdoruesi A shkruan një rresht në çdo tabelë përmes rolit authenticated (si nga app-i).
  perform set_config('request.jwt.claims', json_build_object('sub', user_a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  insert into public.exercises (name, equipment) values ('Bench Press', 'barbell') returning id into ex;
  insert into public.programs (name, source) values ('Shortcut to Size', 'shortcut_to_size') returning id into prog;
  insert into public.program_blocks (program_id, position, name, weeks) values (prog, 0, 'Java 0', 1) returning id into blk;
  insert into public.program_days (program_id, position, name) values (prog, 0, 'Gjoks, triceps, pulpa') returning id into dy;
  insert into public.program_slots (program_id, day_id, position, exercise_id, sets) values (prog, dy, 0, ex, 4) returning id into slot;
  insert into public.slot_prescriptions (program_id, slot_id, block_id, prescription, progression)
    values (prog, slot, blk, '{"type": "rep_ladder", "ranges": [[12, 15]]}', '{"minRir": 2, "incrementKg": 2.5}');
  insert into public.program_state (program_id, block_id, day_id) values (prog, blk, dy);
  insert into public.workout_sessions (program_id, block_id, week, day_id, date) values (prog, blk, 1, dy, '2026-11-30') returning id into sess;
  insert into public.set_logs (session_id, slot_id, exercise_id, position, set_number, weight_kg, reps, rir)
    values (sess, slot, ex, 0, 1, 60, 12, 2);
  insert into public.one_rm_overrides (exercise_id, one_rm_kg) values (ex, 90);
  insert into public.body_measurements (date, weight_kg, waist_cm) values ('2026-11-30', 80, 84);
  insert into public.progress_photos (date, pose, storage_path) values ('2026-11-30', 'front', user_a || '/front.jpg');
  insert into public.foods (source, name, kcal, protein_g, carbs_g, fat_g) values ('custom', 'Vezë', 143, 12.6, 0.7, 9.5) returning id into fd;
  insert into public.recipes (name, total_weight_g) values ('Omëletë', 300) returning id into rcp;
  insert into public.recipe_items (recipe_id, food_id, grams) values (rcp, fd, 200);
  insert into public.meal_templates (name, meal, items) values ('Mëngjesi 1', 'breakfast_1', jsonb_build_array(jsonb_build_object('food_id', fd, 'grams', 100)));
  insert into public.diary_entries (date, meal, food_id, grams, kcal, protein_g, carbs_g, fat_g)
    values ('2026-11-30', 'breakfast_1', fd, 100, 143, 12.6, 0.7, 9.5);
  insert into public.nutrition_targets (date, day_type, kcal, protein_g, carbs_g, fat_g) values ('2026-11-30', 'training', 3625, 328, 333, 108);
  insert into public.supplements (name, dose_amount, dose_unit, timing, evidence) values ('Creatine', 5, 'g', '{pre_workout,post_workout}', 'strong') returning id into supp;
  insert into public.supplement_logs (supplement_id, date, timing) values (supp, '2026-11-30', 'post_workout');
  insert into public.user_settings default values;
  insert into public.week_weights (program_id, block_id, week, slot_id, exercise_id, weight_kg, status)
    values (prog, blk, 1, slot, ex, 62.5, 'accepted');
  insert into storage.objects (bucket_id, name) values ('progress-photos', user_a || '/front.jpg');

  foreach t in array tables loop
    execute format('select count(*) from public.%I', t) into n;
    results := results || format('A sheh rreshtin e vet te %s|%s|%s', t, n = 1, n);
  end loop;

  -- A nuk shkruan dot në emër të B, as në dosjen e fotove të B.
  begin
    insert into public.exercises (name, equipment, user_id) values ('Squat', 'barbell', user_b);
    results := results || 'A nuk shkruan rresht për B|false|u lejua'::text;
  exception when insufficient_privilege then
    results := results || 'A nuk shkruan rresht për B|true|refuzohet'::text;
  end;
  begin
    insert into storage.objects (bucket_id, name) values ('progress-photos', user_b || '/x.jpg');
    results := results || 'A nuk ngarkon foto te dosja e B|false|u lejua'::text;
  exception when insufficient_privilege then
    results := results || 'A nuk ngarkon foto te dosja e B|true|refuzohet'::text;
  end;

  -- Fiton ndryshimi i fundit: një version më i vjetër nuk mbishkruan.
  update public.exercises set name = 'Bench Press (i ri)', updated_at = now() + interval '1 minute' where id = ex;
  update public.exercises set name = 'Bench Press (i vjetër)', updated_at = now() - interval '1 day' where id = ex;
  select count(*) into n from public.exercises where id = ex and name = 'Bench Press (i ri)';
  results := results || format('versioni më i vjetër nuk mbishkruan|%s|%s', n = 1, n);

  -- Përdoruesi B.
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', user_b, 'role', 'authenticated')::text, true);
  set local role authenticated;

  foreach t in array tables loop
    execute format('select count(*) from public.%I', t) into n;
    results := results || format('B nuk sheh asgjë te %s|%s|%s', t, n = 0, n);
    execute format('with changed as (update public.%I set deleted_at = now() returning 1) select count(*) from changed', t) into n;
    results := results || format('B nuk ndryshon asgjë te %s|%s|%s', t, n = 0, n);
    execute format('with gone as (delete from public.%I returning 1) select count(*) from gone', t) into n;
    results := results || format('B nuk fshin asgjë te %s|%s|%s', t, n = 0, n);
  end loop;

  select count(*) into n from storage.objects where bucket_id = 'progress-photos';
  results := results || format('B nuk sheh asnjë foto|%s|%s', n = 0, n);
  begin
    with gone as (delete from storage.objects where bucket_id = 'progress-photos' returning 1) select count(*) into n from gone;
    results := results || format('B nuk fshin asnjë foto|%s|%s', n = 0, n);
  exception when others then
    -- Storage mund ta ndalojë fshirjen me SQL; atëherë vlen vetëm rruga e API-së, që kalon nga RLS.
    results := results || format('B nuk fshin asnjë foto|true|SQL i bllokuar: %s', sqlerrm);
  end;

  -- Pa sesion (anon): asnjë qasje në asnjë tabelë.
  reset role;
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  set local role anon;
  foreach t in array tables loop
    begin
      execute format('select count(*) from public.%I', t) into n;
      results := results || format('anon pa qasje te %s|false|lexoi %s', t, n);
    exception when insufficient_privilege then
      results := results || format('anon pa qasje te %s|true|refuzohet', t);
    end;
  end loop;
  select count(*) into n from storage.objects where bucket_id = 'progress-photos';
  results := results || format('anon nuk sheh asnjë foto|%s|%s', n = 0, n);

  reset role;
  insert into test_results
  select split_part(r, '|', 1), split_part(r, '|', 2)::boolean, split_part(r, '|', 3) from unnest(results) as r;
end;
$$;

select
  count(*) filter (where ok) as passed,
  count(*) filter (where not ok) as failed,
  coalesce(string_agg(check_name || ' (' || detail || ')', '; ') filter (where not ok), '') as failures,
  (select detail from test_results where check_name = 'B nuk fshin asnjë foto') as photo_delete_detail
from test_results;

rollback;
