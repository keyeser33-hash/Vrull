-- Uji (V36, V2-E2-07): një rresht për çdo gotë ose sasi, me datën e ditës së ushqimit (V46) dhe orën.
create table public.water_logs (
  date date not null,
  ml smallint not null check (ml between 50 and 2000),
  logged_at timestamptz not null default now()
);
select private.setup_sync_table('water_logs');

create index water_logs_date_idx on public.water_logs (user_id, date);
