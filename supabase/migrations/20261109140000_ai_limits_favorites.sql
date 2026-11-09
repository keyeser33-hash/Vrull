-- 0.22 (V2-E2-16, V2-E2-17; SPEC V42): kufiri i AI-së për person dhe ushqimet e preferuara. Vetëm shtesë:
-- asnjë rresht ekzistues nuk ndryshon kuptim, dhe app-i 0.21 vazhdon të sinkronizojë.
--
-- 1. ai_limits: një rresht për person me kufirin mujor në euro (pronari 40 €, çdo mik 10 €). E shkruan vetëm
--    funksioni ai-admin (me çelësin sekret), pas kontrollit që thirrësi është admini; përdoruesi lexon vetëm
--    rreshtin e vet (Cilësimet › AI, me sinkronizimin) dhe nuk e ndryshon. Pa rresht, kufiri është 10 €.
-- 2. Admini: pronari, i shënuar te app_metadata (vrull_admin), që përdoruesi nuk e ndryshon dot vetë.
--    Pronari është llogaria e parë e krijuar në projekt; pyetja në fund e tregon para dhe pas.
-- 3. foods.favorite_g: porcioni i një ushqimi të preferuar (bosh = jo i preferuar), për "Të preferuarat".

-- 1. Kufiri për person
create table public.ai_limits (
  monthly_eur numeric(6, 2) not null check (monthly_eur >= 0 and monthly_eur <= 500)
);
select private.setup_sync_table('ai_limits');

-- Vetëm leximi për pronarin e rreshtit: setup_sync_table jep të katër politikat dhe grant-et e zakonshme.
drop policy own_insert on public.ai_limits;
drop policy own_update on public.ai_limits;
drop policy own_delete on public.ai_limits;
revoke insert, update, delete on public.ai_limits from authenticated;

-- Një kufi i gjallë për person.
create unique index ai_limits_user_unique on public.ai_limits (user_id) where deleted_at is null;

-- 2. Admini dhe kufiri i tij: llogaria e parë e projektit (pronari), pa llogaritë e provës.
with owner as (
  select id from auth.users where email not like 'e2e-%@example.invalid' order by created_at limit 1
)
update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"vrull_admin": true}'::jsonb
where id in (select id from owner);

insert into public.ai_limits (user_id, monthly_eur)
select id, 40 from auth.users where coalesce((raw_app_meta_data ->> 'vrull_admin')::boolean, false)
on conflict do nothing;

-- 3. Të preferuarat
alter table public.foods add column favorite_g numeric(7, 1) check (favorite_g > 0);

-- Kontrolli (pritet një rresht: pronari, 40 €):
--   select u.email, l.monthly_eur from auth.users u join public.ai_limits l on l.user_id = u.id
--   where (u.raw_app_meta_data ->> 'vrull_admin')::boolean;
-- Prova e RLS-it: supabase/tests/rls_isolation.sql (ai_limits).
