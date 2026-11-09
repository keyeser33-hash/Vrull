-- Etapa 3, vala e parë, pas rishikimit (V2-E3-03; SPEC §0.3d, V50). Tabela daily_states u aplikua më
-- 09.11.2026 dhe është ende bosh: asnjë version i app-it nuk e përdor ende.
--
-- 1. Grupet me dhimbje deri në 15, sa grupet e muskujve: çipi "Këmbët" ruan 5 grupe dhe kufiri 12 e priste barkun.
-- 2. Gatishmëria llogaritet vetëm nga rreshti: rikuperimi i grupit kryesor dhe nëse një grup me dhimbje stërvitej,
--    në çastin e check-in-it. Kështu nuk ndryshon kur stërvitja shtyhet ose mbyllet, dhe korniza nuk lexon gjithë Sot.
-- 3. Vendimi i sugjerimit del në tabelën e vet, daily_choices, me id nga (përdoruesi, data). Një check-in nga telefoni
--    tjetër nuk e fshin më vendimin (rreshtat sinkronizohen të tërë, i fundit fiton). Vendimi mban stërvitjen ku vlen
--    dhe llojet e ditëve para shtyrjes, që "Ktheje për sot" t'i rikthejë nga çdo telefon.

alter table public.daily_states drop constraint daily_states_sore_groups_check;
alter table public.daily_states add constraint daily_states_sore_groups_check check (cardinality(sore_groups) <= 15);
alter table public.daily_states add column recovery text check (recovery in ('gati', 'pothuajse_gati', 'i_lodhur'));
alter table public.daily_states add column sore_trained boolean not null default false;
alter table public.daily_states drop column choice;

create table public.daily_choices (
  date date not null,
  choice text not null check (choice in ('lighter', 'tomorrow', 'normal')),
  -- Stërvitja ku vlen vendimi ("blloku|java|dita" e programit), që stërvitja e radhës të mos lehtësohet.
  workout text check (char_length(workout) <= 200),
  -- Llojet e ditëve të zgjedhura me dorë para "Shtyje për nesër" (null = automatik).
  prev_today text check (prev_today in ('training', 'rest')),
  prev_tomorrow text check (prev_tomorrow in ('training', 'rest'))
);
select private.setup_sync_table('daily_choices');

-- Një vendim i gjallë për person dhe datë.
create unique index daily_choices_user_date on public.daily_choices (user_id, date) where deleted_at is null;

-- Kontrolli:
--   select column_name from information_schema.columns where table_schema = 'public' and table_name = 'daily_states' order by ordinal_position;
--   select policyname, cmd from pg_policies where schemaname = 'public' and tablename = 'daily_choices';
