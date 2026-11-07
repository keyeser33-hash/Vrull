-- Training Hub · skema v1 (docs/SPEC.md §15).
-- Një përdorues. Çdo tabelë ka pronarin (user_id), kolonat e sinkronizimit dhe RLS.
--
-- Kolonat e sinkronizimit (TH-04):
--   id                 UUID i krijuar në telefon.
--   updated_at         koha e ndryshimit në telefon; fiton ndryshimi i fundit.
--   deleted_at         fshirje e butë; rreshti mbetet që fshirja të arrijë kudo.
--   server_updated_at  vendoset nga serveri në çdo shkrim; kursori i tërheqjes.
-- Datat e ditarit, të stërvitjes dhe të matjeve janë `date` lokale (YYYY-MM-DD e telefonit);
-- kohët janë `timestamptz` (UTC).

-- 1. Asnjë objekt i ri në public nuk del vetvetiu te Data API; çdo tabelë merr grant-et e saj më poshtë.
alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke execute on functions from public;

-- 2. Ndihmësit jetojnë në një skemë që nuk ekspozohet.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create function private.sync_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    -- Një version më i vjetër se ai në server nuk e mbishkruan (fiton ndryshimi i fundit).
    if new.updated_at < old.updated_at then
      return null;
    end if;
    new.created_at := old.created_at;
  end if;
  new.server_updated_at := now();
  return new;
end;
$$;
revoke all on function private.sync_touch() from public, anon, authenticated;

-- Kolonat e përbashkëta, indeksi i sinkronizimit, trigger-i, RLS, politikat vetëm për pronarin
-- dhe grant-et (anon nuk merr asgjë). Thirret menjëherë pas çdo create table.
create function private.setup_sync_table(t text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  cmd text;
begin
  execute format($f$
    alter table public.%1$I
      add column id uuid primary key default gen_random_uuid(),
      add column user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
      add column created_at timestamptz not null default now(),
      add column updated_at timestamptz not null default now(),
      add column deleted_at timestamptz,
      add column server_updated_at timestamptz not null default now()
  $f$, t);
  execute format('create index %1$I on public.%2$I (user_id, server_updated_at)', t || '_sync_idx', t);
  execute format(
    'create trigger sync_touch before insert or update on public.%I for each row execute function private.sync_touch()',
    t
  );
  execute format('alter table public.%I enable row level security', t);
  foreach cmd in array array['select', 'insert', 'update', 'delete'] loop
    execute format(
      'create policy %1$I on public.%2$I for %3$s to authenticated %4$s',
      'own_' || cmd, t, cmd,
      case cmd
        when 'insert' then 'with check ((select auth.uid()) = user_id)'
        when 'update' then 'using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)'
        else 'using ((select auth.uid()) = user_id)'
      end
    );
  end loop;
  execute format('revoke all on public.%I from anon, authenticated', t);
  execute format('grant select, insert, update, delete on public.%I to authenticated, service_role', t);
end;
$$;
revoke all on function private.setup_sync_table(text) from public, anon, authenticated;

-- 3. Vlerat e lejuara.
create domain public.meal_key as text check (value in (
  'breakfast_1', 'breakfast_2', 'snack_am', 'lunch', 'snack_pm', 'dinner', 'bedtime',
  'pre_workout', 'intra_workout', 'post_workout'
));

-- Çelësat e muskujve të modelit 3D (SPEC, Shtojca D).
create domain public.muscle_keys as text[] check (value <@ array[
  'pectoralis_major_clavicular', 'pectoralis_major_sternocostal', 'pectoralis_minor',
  'deltoid_anterior', 'deltoid_lateral', 'deltoid_posterior', 'trapezius', 'latissimus_dorsi',
  'rhomboid_major', 'rhomboid_minor', 'teres_major', 'infraspinatus', 'erector_spinae',
  'biceps_brachii', 'brachialis', 'brachioradialis', 'forearm_flexors', 'triceps_brachii',
  'rectus_abdominis', 'external_oblique', 'gluteus_maximus', 'gluteus_medius',
  'tensor_fasciae_latae', 'adductor_magnus', 'adductor_longus', 'rectus_femoris',
  'vastus_lateralis', 'vastus_medialis', 'biceps_femoris', 'semitendinosus', 'semimembranosus',
  'gastrocnemius', 'soleus', 'sternocleidomastoid'
]::text[]);

-- 4. Tabelat. Kolonat e përbashkëta (id, user_id, ...) i shton private.setup_sync_table.

-- Ushtrimet e përdoruesit: ato të bibliotekës që përdor (library_id nga free-exercise-db)
-- dhe ato që krijon vetë (library_id null). Biblioteka e plotë vjen me app-in.
create table public.exercises (
  library_id text,
  name text not null check (length(trim(name)) between 1 and 120),
  primary_muscles public.muscle_keys not null default '{}',
  secondary_muscles public.muscle_keys not null default '{}',
  equipment text not null check (equipment in (
    'barbell', 'ez_bar', 'dumbbell', 'cable', 'machine', 'bodyweight', 'kettlebell', 'band', 'other'
  )),
  tracking text not null default 'weight_reps'
    check (tracking in ('weight_reps', 'bodyweight_reps', 'timed')),
  video_url text check (video_url ~ '^https://'),
  notes text
);
select private.setup_sync_table('exercises');

create table public.programs (
  name text not null check (length(trim(name)) between 1 and 120),
  description text,
  source text not null default 'custom' check (source in ('shortcut_to_size', 'custom'))
);
select private.setup_sync_table('programs');

-- Blloqet (fazat) me radhë; Shortcut to Size: Java 0 (1 javë) dhe Faza 1–3 (nga 4 javë).
create table public.program_blocks (
  program_id uuid not null references public.programs (id) on delete cascade,
  position smallint not null check (position >= 0),
  name text not null,
  weeks smallint not null check (weeks between 1 and 52)
);
select private.setup_sync_table('program_blocks');

-- Ditët e stërvitjes që përsëriten çdo javë.
create table public.program_days (
  program_id uuid not null references public.programs (id) on delete cascade,
  position smallint not null check (position >= 0),
  name text not null
);
select private.setup_sync_table('program_days');

-- Slotet e një dite. Ushtrimi, setet dhe pushimi këtu janë parazgjedhja;
-- slot_prescriptions i ndryshon sipas bllokut dhe javës.
create table public.program_slots (
  program_id uuid not null references public.programs (id) on delete cascade,
  day_id uuid not null references public.program_days (id) on delete cascade,
  position smallint not null check (position >= 0),
  exercise_id uuid not null references public.exercises (id),
  sets smallint not null check (sets between 1 and 20),
  rest_seconds smallint not null default 90 check (rest_seconds between 0 and 900),
  notes text
);
select private.setup_sync_table('program_slots');

-- Receta e një sloti (SPEC §4). block_id dhe week null do të thonë "çdo bllok" dhe "çdo javë";
-- motori i programit (TH-06) zgjedh rreshtin më specifik. Fushat null trashëgohen nga sloti.
-- prescription: {"type": "rep_ladder" | "timed" | "percent_1rm" | "linear" | "rpe" | "rir", ...}
-- technique:    {"type": "none" | "rest_pause" | "drop_set" | "to_failure", ...}
create table public.slot_prescriptions (
  program_id uuid not null references public.programs (id) on delete cascade,
  slot_id uuid not null references public.program_slots (id) on delete cascade,
  block_id uuid references public.program_blocks (id) on delete cascade,
  week smallint check (week between 1 and 52),
  exercise_id uuid references public.exercises (id),
  sets smallint check (sets between 1 and 20),
  rest_seconds smallint check (rest_seconds between 0 and 900),
  prescription jsonb check (
    prescription is null or (
      jsonb_typeof(prescription) = 'object'
      and coalesce(prescription ->> 'type', '') in ('rep_ladder', 'timed', 'percent_1rm', 'linear', 'rpe', 'rir')
    )
  ),
  technique jsonb check (
    technique is null or (
      jsonb_typeof(technique) = 'object'
      and coalesce(technique ->> 'type', '') in ('none', 'rest_pause', 'drop_set', 'to_failure')
    )
  )
);
select private.setup_sync_table('slot_prescriptions');

-- Treguesi "stërvitja e radhës" për çdo program (SPEC §4, Radha). run rritet kur programi rinis.
create table public.program_state (
  program_id uuid not null references public.programs (id) on delete cascade,
  run smallint not null default 1 check (run >= 1),
  block_id uuid references public.program_blocks (id),
  week smallint not null default 1 check (week between 1 and 52),
  day_id uuid references public.program_days (id),
  started_at timestamptz,
  completed_at timestamptz
);
select private.setup_sync_table('program_state');

create table public.workout_sessions (
  program_id uuid references public.programs (id),
  run smallint check (run >= 1),
  block_id uuid references public.program_blocks (id),
  week smallint check (week between 1 and 52),
  day_id uuid references public.program_days (id),
  date date not null,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'completed', 'skipped')),
  started_at timestamptz,
  ended_at timestamptz,
  notes text,
  check (ended_at is null or started_at is null or ended_at >= started_at)
);
select private.setup_sync_table('workout_sessions');

-- Një set. Te dumbbell-at pesha e një dumbbell-i; te ushtrimet me peshën e trupit, pesha shtesë.
-- segments: rest-pause ose drop set, [{"weight_kg": 60, "reps": 4}, ...].
create table public.set_logs (
  session_id uuid not null references public.workout_sessions (id) on delete cascade,
  slot_id uuid references public.program_slots (id),
  exercise_id uuid not null references public.exercises (id),
  position smallint not null check (position >= 0),
  set_number smallint not null check (set_number >= 1),
  weight_kg numeric(6, 2) check (weight_kg >= 0),
  reps smallint check (reps between 0 and 200),
  seconds smallint check (seconds between 0 and 3600),
  rpe numeric(3, 1) check (rpe between 1 and 10),
  rir smallint check (rir between 0 and 10),
  technique text check (technique in ('none', 'rest_pause', 'drop_set', 'to_failure')),
  segments jsonb check (segments is null or jsonb_typeof(segments) = 'array'),
  is_warmup boolean not null default false,
  logged_at timestamptz not null default now(),
  notes text,
  check (reps is not null or seconds is not null)
);
select private.setup_sync_table('set_logs');

-- 1RM e vendosur me dorë; vlen derisa një seancë të japë më shumë (SPEC §7).
create table public.one_rm_overrides (
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  one_rm_kg numeric(6, 2) not null check (one_rm_kg > 0),
  set_at timestamptz not null default now()
);
select private.setup_sync_table('one_rm_overrides');

create table public.body_measurements (
  date date not null,
  weight_kg numeric(5, 2) check (weight_kg between 20 and 400),
  body_fat_pct numeric(4, 1) check (body_fat_pct between 2 and 70),
  neck_cm numeric(5, 1) check (neck_cm > 0),
  shoulders_cm numeric(5, 1) check (shoulders_cm > 0),
  chest_cm numeric(5, 1) check (chest_cm > 0),
  waist_cm numeric(5, 1) check (waist_cm > 0),
  hips_cm numeric(5, 1) check (hips_cm > 0),
  arm_left_cm numeric(5, 1) check (arm_left_cm > 0),
  arm_right_cm numeric(5, 1) check (arm_right_cm > 0),
  forearm_left_cm numeric(5, 1) check (forearm_left_cm > 0),
  forearm_right_cm numeric(5, 1) check (forearm_right_cm > 0),
  thigh_left_cm numeric(5, 1) check (thigh_left_cm > 0),
  thigh_right_cm numeric(5, 1) check (thigh_right_cm > 0),
  calf_left_cm numeric(5, 1) check (calf_left_cm > 0),
  calf_right_cm numeric(5, 1) check (calf_right_cm > 0),
  notes text
);
select private.setup_sync_table('body_measurements');

-- Fotot jetojnë te bucket-i privat progress-photos, në <user_id>/<emri>.
create table public.progress_photos (
  date date not null,
  pose text not null check (pose in ('front', 'side', 'back')),
  storage_path text not null,
  width integer check (width > 0),
  height integer check (height > 0),
  bytes integer check (bytes > 0)
);
select private.setup_sync_table('progress_photos');

-- Ushqimet: kopje lokale nga Open Food Facts dhe USDA, plus ato të përdoruesit. Vlerat për 100 g.
create table public.foods (
  source text not null check (source in ('off', 'usda', 'custom', 'template')),
  source_id text,
  name text not null check (length(trim(name)) between 1 and 200),
  brand text,
  kcal numeric(6, 1) not null check (kcal >= 0),
  protein_g numeric(5, 1) not null check (protein_g >= 0),
  carbs_g numeric(5, 1) not null check (carbs_g >= 0),
  fat_g numeric(5, 1) not null check (fat_g >= 0),
  fiber_g numeric(5, 1) check (fiber_g >= 0),
  serving_g numeric(6, 1) check (serving_g > 0),
  serving_label text
);
select private.setup_sync_table('foods');

create table public.recipes (
  name text not null check (length(trim(name)) between 1 and 200),
  total_weight_g numeric(7, 1) check (total_weight_g > 0),
  servings numeric(5, 2) check (servings > 0),
  notes text
);
select private.setup_sync_table('recipes');

create table public.recipe_items (
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  food_id uuid not null references public.foods (id),
  grams numeric(7, 1) not null check (grams > 0),
  position smallint not null default 0 check (position >= 0)
);
select private.setup_sync_table('recipe_items');

-- Vaktet e gatshme (shablloni i Jimit dhe të përdoruesit). items: [{"food_id": "...", "grams": 200}, ...].
create table public.meal_templates (
  name text not null,
  meal public.meal_key not null,
  day_type text not null default 'any' check (day_type in ('any', 'training', 'rest')),
  items jsonb not null default '[]' check (jsonb_typeof(items) = 'array'),
  position smallint not null default 0
);
select private.setup_sync_table('meal_templates');

-- Një regjistrim në ditar. Makrot ruhen në momentin e regjistrimit, që historia
-- të mos ndryshojë kur ndryshohet më vonë një ushqim.
create table public.diary_entries (
  date date not null,
  meal public.meal_key not null,
  food_id uuid references public.foods (id),
  recipe_id uuid references public.recipes (id),
  grams numeric(7, 1) check (grams > 0),
  servings numeric(5, 2) check (servings > 0),
  kcal numeric(7, 1) not null check (kcal >= 0),
  protein_g numeric(6, 1) not null check (protein_g >= 0),
  carbs_g numeric(6, 1) not null check (carbs_g >= 0),
  fat_g numeric(6, 1) not null check (fat_g >= 0),
  logged_at timestamptz not null default now(),
  check (num_nonnulls(food_id, recipe_id) = 1),
  check (grams is not null or servings is not null)
);
select private.setup_sync_table('diary_entries');

-- Objektivat e një dite, të ruajtura që grafiku i përputhjes të mos ndryshojë pas faktit.
create table public.nutrition_targets (
  date date not null,
  day_type text not null check (day_type in ('training', 'rest')),
  kcal numeric(6, 0) not null check (kcal > 0),
  protein_g numeric(5, 0) not null check (protein_g >= 0),
  carbs_g numeric(5, 0) not null check (carbs_g >= 0),
  fat_g numeric(5, 0) not null check (fat_g >= 0),
  bodyweight_kg numeric(5, 2) check (bodyweight_kg > 0),
  is_manual boolean not null default false
);
select private.setup_sync_table('nutrition_targets');

create table public.supplements (
  name text not null check (length(trim(name)) between 1 and 120),
  dose_amount numeric(6, 2) check (dose_amount > 0),
  dose_unit text check (dose_unit in ('g', 'mg', 'scoop', 'dose', 'piece', 'capsule')),
  timing public.meal_key[] not null default '{}',
  evidence text check (evidence in ('strong', 'moderate', 'limited', 'weak', 'food', 'deficiency_only')),
  enabled boolean not null default true,
  position smallint not null default 0,
  notes text
);
select private.setup_sync_table('supplements');

create table public.supplement_logs (
  supplement_id uuid not null references public.supplements (id) on delete cascade,
  date date not null,
  timing public.meal_key not null,
  taken_at timestamptz not null default now(),
  amount numeric(6, 2) check (amount > 0)
);
select private.setup_sync_table('supplement_logs');

-- Cilësimet: një rresht për përdorues (SPEC §3a, §7, §13, §14).
-- training_days: ditët ISO (1 = e hënë ... 7 = e diel). training_times: {"1": "18:00", ...}.
create table public.user_settings (
  training_days smallint[] not null default '{1,2,4,5}'
    check (training_days <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]),
  training_times jsonb not null default '{}' check (jsonb_typeof(training_times) = 'object'),
  wake_time time,
  sleep_time time,
  weight_steps jsonb not null default '{"barbell": 2.5, "ez_bar": 2.5, "dumbbell": 2, "cable": 5, "machine": 5, "kettlebell": 4}'
    check (jsonb_typeof(weight_steps) = 'object'),
  theme text not null default 'oled' check (theme in ('oled', 'dark', 'light')),
  reminders jsonb not null default '{"meals": true, "supplements": true, "training": true, "measurements": true}'
    check (jsonb_typeof(reminders) = 'object'),
  measurement_day smallint not null default 7 check (measurement_day between 1 and 7),
  active_program_id uuid references public.programs (id) on delete set null,
  onboarded_at timestamptz
);
select private.setup_sync_table('user_settings');

-- 5. Kufizime dhe indekse unike që varen nga kolonat e përbashkëta.
alter table public.progress_photos
  add constraint progress_photos_path_owner check (split_part(storage_path, '/', 1) = user_id::text),
  add constraint progress_photos_path_unique unique (storage_path);

create unique index exercises_library_unique on public.exercises (user_id, library_id)
  where library_id is not null and deleted_at is null;
create unique index foods_source_unique on public.foods (user_id, source, source_id)
  where source_id is not null and deleted_at is null;
create unique index program_state_program_unique on public.program_state (program_id)
  where deleted_at is null;
create unique index body_measurements_date_unique on public.body_measurements (user_id, date)
  where deleted_at is null;
create unique index nutrition_targets_date_unique on public.nutrition_targets (user_id, date)
  where deleted_at is null;
create unique index supplement_logs_unique on public.supplement_logs (supplement_id, date, timing)
  where deleted_at is null;
create unique index user_settings_user_unique on public.user_settings (user_id);
create unique index slot_prescriptions_scope_unique on public.slot_prescriptions
  (slot_id, coalesce(block_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(week, 0))
  where deleted_at is null;

-- 6. Indekset e lidhjeve (çelësat e huaj) dhe të kërkimeve sipas datës.
create index program_blocks_program_idx on public.program_blocks (program_id, position);
create index program_days_program_idx on public.program_days (program_id, position);
create index program_slots_program_idx on public.program_slots (program_id);
create index program_slots_day_idx on public.program_slots (day_id, position);
create index program_slots_exercise_idx on public.program_slots (exercise_id);
create index slot_prescriptions_program_idx on public.slot_prescriptions (program_id);
create index slot_prescriptions_block_idx on public.slot_prescriptions (block_id);
create index slot_prescriptions_exercise_idx on public.slot_prescriptions (exercise_id);
create index program_state_block_idx on public.program_state (block_id);
create index program_state_day_idx on public.program_state (day_id);
create index workout_sessions_date_idx on public.workout_sessions (user_id, date);
create index workout_sessions_program_idx on public.workout_sessions (program_id);
create index workout_sessions_block_idx on public.workout_sessions (block_id);
create index workout_sessions_day_idx on public.workout_sessions (day_id);
create index set_logs_session_idx on public.set_logs (session_id, position);
create index set_logs_slot_idx on public.set_logs (slot_id);
create index set_logs_exercise_idx on public.set_logs (exercise_id, logged_at);
create index one_rm_overrides_exercise_idx on public.one_rm_overrides (exercise_id, set_at);
create index progress_photos_date_idx on public.progress_photos (user_id, date);
create index recipe_items_recipe_idx on public.recipe_items (recipe_id, position);
create index recipe_items_food_idx on public.recipe_items (food_id);
create index diary_entries_date_idx on public.diary_entries (user_id, date);
create index diary_entries_food_idx on public.diary_entries (food_id);
create index diary_entries_recipe_idx on public.diary_entries (recipe_id);
create index supplement_logs_date_idx on public.supplement_logs (user_id, date);
create index supplement_logs_supplement_idx on public.supplement_logs (supplement_id);
create index program_state_program_idx on public.program_state (program_id);
create index user_settings_program_idx on public.user_settings (active_program_id);

-- 7. Fotot e progresit: bucket privat; çdo përdorues lexon dhe shkruan vetëm te dosja e tij.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('progress-photos', 'progress-photos', false, 5242880, array['image/jpeg', 'image/webp']);

create policy progress_photos_select on storage.objects for select to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy progress_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy progress_photos_update on storage.objects for update to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy progress_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
