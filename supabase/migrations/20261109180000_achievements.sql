-- 0.23 (V2-E2-21; SPEC §0.3c, V47): arritjet. Vetëm shtesë: asnjë tabelë ekzistuese nuk ndryshon, dhe
-- app-i 0.22 vazhdon të sinkronizojë pa e njohur këtë tabelë.
--
-- achievements: një rresht për çdo arritje të fituar, me datën kur u fitua. Secila jepet një herë, ndaj
-- indeksi unik (user_id, key) mbron nga dyfishimi kur dy telefona e japin njëkohësisht; app-i i jep rreshtit
-- id-në nga çelësi (si week_weights), që të dy shkrimet të bien mbi të njëjtin rresht. Përdoruesi i shkruan
-- vetë (politikat e zakonshme të setup_sync_table): arritjet janë të dhënat e tij, pa ndikim te të tjerët.
-- Çelësi është i lirë brenda formës, që një arritje e re të mos kërkojë migrim.

create table public.achievements (
  key text not null check (key ~ '^[a-z0-9_]{1,40}$'),
  earned_on date not null
);
select private.setup_sync_table('achievements');

-- Një arritje e gjallë për person dhe çelës.
create unique index achievements_user_key on public.achievements (user_id, key) where deleted_at is null;

-- Kontrolli (pritet: tabela ekziston me RLS dhe katër politikat e zakonshme):
--   select relrowsecurity from pg_class where oid = 'public.achievements'::regclass;
--   select policyname, cmd from pg_policies where schemaname = 'public' and tablename = 'achievements';
