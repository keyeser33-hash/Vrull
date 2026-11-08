-- Videot e formës (V2-E1-13; SPEC V26, V27, §12). Vetëm shtesë: asnjë tabelë e v1 nuk ndryshon.
--
-- Një video e një seti, e regjistruar nga seanca: rreshti sinkronizohet si çdo tabelë, skedari jeton
-- në telefon dhe te bucket-i privat form-videos, në <user_id>/<id>.mp4 (ose .webm, kur WebView-i nuk
-- regjistron MP4). Si fotot e progresit: vetëm pronari e sheh, e ngarkon dhe e fshin (V5).
-- Kufijtë e app-it (SPEC §12): deri në 60 s, 720p me 2 Mbit/s, pa zë; një skedar deri në 50 MB,
-- kufiri i planit falas të Supabase-it për një ngarkim.

create table public.form_videos (
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  -- Seanca dhe seti ku u regjistrua; pesha dhe përsëritjet lexohen nga set_logs i së njëjtës seancë,
  -- ushtrim dhe numër seti (videoja mund të regjistrohet para se seti të ruhet).
  session_id uuid references public.workout_sessions (id) on delete set null,
  set_number smallint check (set_number >= 1),
  date date not null,
  storage_path text not null,
  mime_type text not null check (mime_type in ('video/mp4', 'video/webm')),
  duration_s numeric(4, 1) not null check (duration_s > 0 and duration_s <= 600),
  bytes integer not null check (bytes > 0 and bytes <= 52428800),
  width integer check (width > 0),
  height integer check (height > 0)
);
select private.setup_sync_table('form_videos');

alter table public.form_videos
  add constraint form_videos_path_owner check (split_part(storage_path, '/', 1) = user_id::text),
  add constraint form_videos_path_unique unique (storage_path);

create index form_videos_exercise_idx on public.form_videos (exercise_id, date);
create index form_videos_session_idx on public.form_videos (session_id);

-- Bucket-i privat; çdo përdorues lexon, shkruan dhe fshin vetëm te dosja e tij.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('form-videos', 'form-videos', false, 52428800, array['video/mp4', 'video/webm']);

create policy form_videos_select on storage.objects for select to authenticated
  using (bucket_id = 'form-videos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy form_videos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'form-videos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy form_videos_update on storage.objects for update to authenticated
  using (bucket_id = 'form-videos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'form-videos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy form_videos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'form-videos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Prova e RLS-it: supabase/tests/rls_isolation.sql (form_videos dhe bucket-i form-videos), në një
-- transaksion që kthehet mbrapsht:
--   psql "$DATABASE_URL" -f supabase/tests/rls_isolation.sql
-- Pritet failed = 0: A sheh rreshtin dhe videon e vet; B nuk sheh, nuk ndryshon dhe nuk fshin rreshtin,
-- nuk sheh dhe nuk fshin videon e A-së, nuk ngarkon te dosja e A-së; anon nuk sheh asgjë.
