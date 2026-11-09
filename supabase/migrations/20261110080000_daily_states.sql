-- Etapa 3, vala e parë (V2-E3-03; SPEC §0.3d, V50): gjendja e ditës dhe vendimi i sugjerimit. Vetëm shtesë:
-- asnjë tabelë ekzistuese nuk ndryshon, dhe app-i 0.23 vazhdon të sinkronizojë pa e njohur këtë tabelë.
--
-- daily_states: një rresht për çdo ditë ushqimi (V46) me check-in-in e mëngjesit: gjendja, energjia, gjumi
-- (minutat dhe cilësia), dhimbjet me grupet, dhe vendimi i sugjerimit kur gatishmëria është e ulët ("lighter"
-- = seanca më e lehtë, "tomorrow" = shtyje për nesër, "normal" = jo sot). App-i i jep rreshtit id-në nga
-- çelësi (përdoruesi, data), si week_weights, që dy telefona të shkruajnë një rresht; indeksi unik e mbron.
-- Kufijtë janë të njëjtët që telefoni kontrollon para shkrimit (data/daily-state.ts), që asnjë rresht të mos
-- refuzohet përgjithmonë (MESIMET › Supabase).

create table public.daily_states (
  date date not null,
  mood smallint not null check (mood between 1 and 5),
  energy smallint not null check (energy between 1 and 5),
  sleep_minutes smallint not null check (sleep_minutes between 0 and 840),
  sleep_quality smallint not null check (sleep_quality between 1 and 5),
  soreness smallint not null check (soreness between 0 and 4),
  sore_groups text[] not null default '{}' check (cardinality(sore_groups) <= 12),
  choice text check (choice in ('lighter', 'tomorrow', 'normal'))
);
select private.setup_sync_table('daily_states');

-- Një gjendje e gjallë për person dhe datë.
create unique index daily_states_user_date on public.daily_states (user_id, date) where deleted_at is null;

-- Kontrolli (pritet: tabela ekziston me RLS dhe katër politikat e zakonshme):
--   select relrowsecurity from pg_class where oid = 'public.daily_states'::regclass;
--   select policyname, cmd from pg_policies where schemaname = 'public' and tablename = 'daily_states';
