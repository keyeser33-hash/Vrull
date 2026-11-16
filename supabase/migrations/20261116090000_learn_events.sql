-- 0.27 (V2-E3-34c; SPEC §0.3e, V56, V57, V63): Mëso. Vetëm shtesë: një tabelë e re dhe një kolonë te
-- user_settings me vlerë që vlen për rreshtat ekzistues; app-i 0.26 vazhdon të sinkronizojë pa i njohur.
--
-- learn_events: faktet e para dhe kuizet e së dielës, që sinkronizohen.
--   fact: një rresht për çdo fakt të parë në një vend, një në ditë ushqimi (V46) për secilin vend: Sot (story
--         "A e dije?"), pushimi mes seteve, pas regjistrimit të një ushqimi. `dismissed` = "×", e mbyll kartën
--         për atë ditë. Fakti është id-ja e paketës që vjen me app-in (`src/learn/facts/*.json`).
--   quiz: një rresht për kuizin e javës (e hëna e javës), me përgjigjet (5, me faktin dhe përgjigjen e zgjedhur),
--         rezultatin dhe ditën kur u mbyll (arritja "Kuizi 4 javë" merr këtë ditë).
-- Çdo rresht ka një çelës natyror (dita dhe vendi; java): app-i i jep id-në nga ai (`naturalId`), që dy
-- telefona të shkruajnë të njëjtin rresht, dhe indeksi unik mbron nga dyfishimi. Përdoruesi i shkruan vetë
-- (politikat e zakonshme të setup_sync_table, me private.sync_touch si te çdo tabelë që sinkronizohet).

create table public.learn_events (
  kind text not null check (kind in ('fact', 'quiz')),
  -- fact: dita e ushqimit kur u pa; quiz: e hëna e javës së kuizit.
  date date not null,
  place text check (place in ('today', 'rest', 'food')),
  fact_id text check (fact_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(fact_id) <= 80),
  dismissed boolean not null default false,
  -- [{"fact": "bench-press-1", "chosen": 0}, ...]: pesë pyetjet me radhë.
  answers jsonb check (answers is null or (jsonb_typeof(answers) = 'array' and jsonb_array_length(answers) = 5)),
  score smallint check (score between 0 and 5),
  closed_on date,
  check (kind <> 'fact' or (place is not null and fact_id is not null and answers is null and score is null and closed_on is null)),
  check (kind <> 'quiz' or (place is null and fact_id is null and answers is not null and score is not null and closed_on is not null
    and extract(isodow from date) = 1 and closed_on >= date))
);
select private.setup_sync_table('learn_events');

-- Një fakt i gjallë për ditë dhe vend, një kuiz i gjallë për javë.
create unique index learn_events_fact_day on public.learn_events (user_id, date, place)
  where kind = 'fact' and deleted_at is null;
create unique index learn_events_quiz_week on public.learn_events (user_id, date)
  where kind = 'quiz' and deleted_at is null;

-- Cilësimet › Mëso: çelësi "A e dije?" (i ndezur si parazgjedhje, sinkronizohet si gjuha dhe sfondi).
alter table public.user_settings
  add column learn_facts boolean not null default true;

-- Kontrolli (pritet: tabela me RLS dhe katër politikat e zakonshme; kolona te user_settings):
--   select relrowsecurity from pg_class where oid = 'public.learn_events'::regclass;
--   select policyname, cmd from pg_policies where schemaname = 'public' and tablename = 'learn_events';
--   select column_name, data_type, column_default from information_schema.columns
--     where table_schema = 'public' and table_name = 'user_settings' and column_name = 'learn_facts';
