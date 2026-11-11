-- Shënimet e mentorit (Paneli në Claude, P3 dhe P8; docs "Training Hub - Paneli në Claude"). Vetëm shtesë:
-- asnjë tabelë ekzistuese nuk ndryshon.
--
-- Mentori është Claude: detyrat e planifikuara (raporti i së hënës, plani i së dielës, komenti pas seancës) dhe
-- pyetjet e lira te paneli. Ai shkruan me lidhjen e Supabase-it të pronarit, jo nga telefoni; telefoni i merr
-- rreshtat me sinkronizimin dhe i tregon te Sot, Mbyllja dhe Historiku. Përdoruesi i lexon vetëm të vetat dhe
-- nuk i shkruan, nuk i ndryshon e nuk i fshin (si ai_usage). Mentori nuk ndryshon asnjë tabelë tjetër.
--
-- Mentori shkruan vetëm tekst. Propozimet (peshat, kaloritë) pranohen te app-i si sot (V23, V33).

create table public.mentor_notes (
  -- raport_javor: e hënë pas zgjimit; plani_javes: e diel në mbrëmje; komenti_seances: brenda një ore pas
  -- mbylljes; pergjigje: një pyetje e lirë e ruajtur nga paneli; prove: shënimet e provave, që app-i i fsheh.
  kind text not null check (kind in ('raport_javor', 'plani_javes', 'komenti_seances', 'pergjigje', 'prove')),
  -- Java kalendarike (e hënë) për raportin dhe planin; data e seancës për komentin.
  period_start date,
  period_end date check (period_end is null or period_end >= period_start),
  session_id uuid references public.workout_sessions (id),
  title text not null check (char_length(title) between 1 and 200),
  body text not null check (char_length(body) between 1 and 8000),
  -- Hapat e javës: listë me tekste të shkurtra, të shumtën 5.
  steps jsonb not null default '[]'::jsonb check (jsonb_typeof(steps) = 'array' and jsonb_array_length(steps) <= 5),
  -- "Mëso": një mësim i shkurtër për çdo shënim (P4, P11).
  learn_title text check (char_length(learn_title) <= 200),
  learn_body text check (char_length(learn_body) <= 2000),
  -- Burimet e mësimit: [{"label": "...", "url": "https://..."}].
  sources jsonb not null default '[]'::jsonb check (jsonb_typeof(sources) = 'array'),
  -- Çfarë lexoi mentori: "1 seancë, 21 sete, 1 ditë ushqimi, 2 peshime".
  based_on text check (char_length(based_on) <= 300),
  model text check (char_length(model) <= 100),
  language text not null default 'sq' check (language in ('sq', 'en')),
  check (kind <> 'komenti_seances' or session_id is not null),
  check (kind not in ('raport_javor', 'plani_javes') or period_start is not null)
);
select private.setup_sync_table('mentor_notes');

-- Vetëm leximi për pronarin: setup_sync_table jep të katër politikat dhe grant-et e zakonshme.
drop policy own_insert on public.mentor_notes;
drop policy own_update on public.mentor_notes;
drop policy own_delete on public.mentor_notes;
revoke insert, update, delete on public.mentor_notes from authenticated;

-- Një koment i gjallë për seancë dhe një raport ose plan i gjallë për javë: një detyrë që niset dy herë nuk
-- shkruan dy herë (insert ... on conflict do nothing).
create unique index mentor_notes_session_comment on public.mentor_notes (session_id)
  where kind = 'komenti_seances' and deleted_at is null;
create unique index mentor_notes_week on public.mentor_notes (user_id, kind, period_start)
  where kind in ('raport_javor', 'plani_javes') and deleted_at is null;
-- Lista e panelit dhe e app-it: më të rejat sipas llojit.
create index mentor_notes_kind_idx on public.mentor_notes (user_id, kind, created_at desc);

-- Prova e RLS-it: supabase/tests/rls_isolation.sql (mentor_notes), në një transaksion që kthehet mbrapsht.
-- Pritet: A sheh shënimin e vet, por nuk e shton, nuk e ndryshon dhe nuk e fshin; B nuk e sheh; anon nuk sheh asgjë.
