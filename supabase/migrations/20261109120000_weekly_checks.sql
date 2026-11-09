-- Kontrolli javor (V33, V2-E2-04): një rresht për çdo javë të rishikuar, kur përdoruesi e pranon
-- korrigjimin ose e lë ("Jo tani"). Korrigjimi i pranuar vlen nga applies_from; objektivat e ditës
-- së stërvitjes dhe të pushimit marrin të njëjtat kcal, te karbohidratet.
create table public.weekly_checks (
  week_start date not null,
  status text not null check (status in ('accepted', 'dismissed')),
  kcal smallint not null check (kcal between -150 and 150),
  applies_from date not null,
  maintenance_kcal smallint check (maintenance_kcal between 500 and 8000),
  trend_change_kg numeric(4, 2) check (trend_change_kg between -10 and 10),
  logged_days smallint check (logged_days between 0 and 7),
  average_kcal smallint check (average_kcal between 0 and 15000),
  check (extract(isodow from week_start) = 1)
);
select private.setup_sync_table('weekly_checks');

create index weekly_checks_week_idx on public.weekly_checks (user_id, week_start);
