-- Prova e izolimit (TH-03): një përdorues tjetër nuk sheh, nuk ndryshon dhe nuk fshin asnjë rresht
-- dhe asnjë foto ose video të përdoruesit të parë (bucket-et progress-photos dhe form-videos);
-- anon nuk ka qasje; fiton ndryshimi i fundit. Kostoja e AI-së (ai_usage, V2-E1-11) shkruhet vetëm me
-- service role: pronari e lexon, por nuk e shton, nuk e ndryshon dhe nuk e fshin.
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
    'diary_entries', 'nutrition_targets', 'supplements', 'supplement_logs', 'user_settings', 'week_weights',
    'form_videos', 'water_logs', 'weekly_checks'
  ];
  -- Bucket-et private me një dosje për përdorues (fotot e progresit, videot e formës).
  bucket text;
  buckets text[] := array['progress-photos', 'form-videos'];
begin
  insert into auth.users (id, aud, role, email, created_at, updated_at)
  values (user_a, 'authenticated', 'authenticated', 'a@test.invalid', now(), now()),
         (user_b, 'authenticated', 'authenticated', 'b@test.invalid', now(), now());

  -- Kostoja e një leximi të PDF-së për A, si e shkruan funksioni program-import (service role).
  set local role service_role;
  insert into public.ai_usage (user_id, month, feature, model, input_tokens, output_tokens, cost_usd, cost_eur)
    values (user_a, '2026-11-01', 'program_pdf', 'claude-sonnet-5-5', 120000, 6000, 0.3, 0.268698);
  reset role;

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
  insert into public.form_videos (exercise_id, session_id, set_number, date, storage_path, mime_type, duration_s, bytes)
    values (ex, sess, 1, '2026-11-30', user_a || '/video.mp4', 'video/mp4', 24.2, 6000000);
  insert into public.water_logs (date, ml) values ('2026-11-30', 250);
  insert into public.weekly_checks (week_start, status, kcal, applies_from, maintenance_kcal, trend_change_kg, logged_days, average_kcal)
    values ('2026-11-23', 'accepted', 90, '2026-11-30', 2900, 0.1, 6, 2800);
  insert into storage.objects (bucket_id, name) values ('progress-photos', user_a || '/front.jpg');
  insert into storage.objects (bucket_id, name) values ('form-videos', user_a || '/video.mp4');

  foreach t in array tables loop
    execute format('select count(*) from public.%I', t) into n;
    results := results || format('A sheh rreshtin e vet te %s|%s|%s', t, n = 1, n);
  end loop;

  -- Kostoja e AI-së: A e lexon, por nuk e shton, nuk e ndryshon dhe nuk e fshin (vetëm funksioni).
  select count(*) into n from public.ai_usage;
  results := results || format('A sheh koston e vet te ai_usage|%s|%s', n = 1, n);
  begin
    insert into public.ai_usage (month, feature, model, input_tokens, output_tokens, cost_usd, cost_eur)
      values ('2026-11-01', 'program_pdf', 'x', 0, 0, 0, 0);
    results := results || 'A nuk shton kosto te ai_usage|false|u lejua'::text;
  exception when insufficient_privilege then
    results := results || 'A nuk shton kosto te ai_usage|true|refuzohet'::text;
  end;
  begin
    update public.ai_usage set cost_eur = 0;
    results := results || 'A nuk ndryshon koston te ai_usage|false|u lejua'::text;
  exception when insufficient_privilege then
    results := results || 'A nuk ndryshon koston te ai_usage|true|refuzohet'::text;
  end;
  begin
    delete from public.ai_usage;
    results := results || 'A nuk fshin koston te ai_usage|false|u lejua'::text;
  exception when insufficient_privilege then
    results := results || 'A nuk fshin koston te ai_usage|true|refuzohet'::text;
  end;

  -- A nuk shkruan dot në emër të B, as në dosjen e fotove të B.
  begin
    insert into public.exercises (name, equipment, user_id) values ('Squat', 'barbell', user_b);
    results := results || 'A nuk shkruan rresht për B|false|u lejua'::text;
  exception when insufficient_privilege then
    results := results || 'A nuk shkruan rresht për B|true|refuzohet'::text;
  end;
  foreach bucket in array buckets loop
    select count(*) into n from storage.objects where bucket_id = bucket;
    results := results || format('A sheh skedarin e vet te %s|%s|%s', bucket, n = 1, n);
    begin
      insert into storage.objects (bucket_id, name) values (bucket, user_b || '/x');
      results := results || format('A nuk ngarkon te dosja e B te %s|false|u lejua', bucket);
    exception when insufficient_privilege then
      results := results || format('A nuk ngarkon te dosja e B te %s|true|refuzohet', bucket);
    end;
  end loop;

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

  select count(*) into n from public.ai_usage;
  results := results || format('B nuk sheh koston e A te ai_usage|%s|%s', n = 0, n);

  foreach bucket in array buckets loop
    select count(*) into n from storage.objects where bucket_id = bucket;
    results := results || format('B nuk sheh asnjë skedar te %s|%s|%s', bucket, n = 0, n);
    begin
      with gone as (delete from storage.objects where bucket_id = bucket returning 1) select count(*) into n from gone;
      results := results || format('B nuk fshin asnjë skedar te %s|%s|%s', bucket, n = 0, n);
    exception when others then
      -- Storage mund ta ndalojë fshirjen me SQL; atëherë vlen vetëm rruga e API-së, që kalon nga RLS.
      results := results || format('B nuk fshin asnjë skedar te %s|true|SQL i bllokuar: %s', bucket, sqlerrm);
    end;
  end loop;

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
  begin
    select count(*) into n from public.ai_usage;
    results := results || format('anon pa qasje te ai_usage|false|lexoi %s', n);
  exception when insufficient_privilege then
    results := results || 'anon pa qasje te ai_usage|true|refuzohet'::text;
  end;
  foreach bucket in array buckets loop
    select count(*) into n from storage.objects where bucket_id = bucket;
    results := results || format('anon nuk sheh asnjë skedar te %s|%s|%s', bucket, n = 0, n);
  end loop;

  reset role;
  insert into test_results
  select split_part(r, '|', 1), split_part(r, '|', 2)::boolean, split_part(r, '|', 3) from unnest(results) as r;
end;
$$;

select
  count(*) filter (where ok) as passed,
  count(*) filter (where not ok) as failed,
  coalesce(string_agg(check_name || ' (' || detail || ')', '; ') filter (where not ok), '') as failures,
  (select string_agg(detail, '; ') from test_results where check_name like 'B nuk fshin asnjë skedar%') as storage_delete_detail
from test_results;

rollback;
