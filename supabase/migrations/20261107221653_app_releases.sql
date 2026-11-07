-- Versionet e app-it për përditësimin brenda app-it (SPEC §3b, TH-23). GitHub Actions ngarkon
-- APK-në dhe latest.json me një çelës sekret (që nuk kalon nga RLS); app-i i lexon me sesionin e
-- përdoruesit. Regjistrimet janë të mbyllura, ndaj "authenticated" është vetëm llogaria e vetme.
-- Asnjë politikë shkrimi: nga app-i bucket-i është vetëm për lexim.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('app-releases', 'app-releases', false, 52428800, array['application/vnd.android.package-archive', 'application/json']);

create policy app_releases_select on storage.objects for select to authenticated
  using (bucket_id = 'app-releases');
