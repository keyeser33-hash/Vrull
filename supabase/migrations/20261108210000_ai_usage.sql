-- Kostoja e AI-së për përdorues dhe muaj (V2-E1-11; SPEC V6, V21, V25). Vetëm shtesë: asnjë tabelë e v1
-- nuk ndryshon.
--
-- Një rresht për çdo thirrje te AI-ja, edhe kur leximi dështon pasi AI-ja ka harxhuar tokena. Rreshtin e
-- shkruan vetëm Edge Function-i (program-import, me service role), pasi ka kontrolluar kufirin e muajit;
-- përdoruesi lexon vetëm rreshtat e vet (Cilësimet › AI, me sinkronizimin) dhe nuk i shkruan, nuk i
-- ndryshon e nuk i fshin. Kufiri (€10 në muaj për person) jeton te funksioni; faqja e Adminit e bën për
-- person me Etapën 2 (V31).

create table public.ai_usage (
  -- Dita e parë e muajit sipas orës së Tiranës ("2026-11-01"): AI-ja ndalet te kufiri deri në muajin tjetër.
  month date not null check (extract(day from month) = 1),
  -- Çfarë e përdori AI-në (bordi "Cilësimet · AI"); ushqimi dhe shpjegimet vijnë me Etapat 2 dhe 3.
  feature text not null check (feature in ('program_pdf', 'food_photo', 'food_text', 'explain')),
  model text not null check (length(model) between 1 and 100),
  input_tokens integer not null check (input_tokens >= 0),
  output_tokens integer not null check (output_tokens >= 0),
  -- Kostoja nga tokenat me çmimet e modelit (USD) dhe në euro me kursin e funksionit.
  cost_usd numeric(10, 6) not null check (cost_usd >= 0),
  cost_eur numeric(10, 6) not null check (cost_eur >= 0)
);
select private.setup_sync_table('ai_usage');

-- Vetëm leximi për pronarin: setup_sync_table jep të katër politikat dhe grant-et e zakonshme.
drop policy own_insert on public.ai_usage;
drop policy own_update on public.ai_usage;
drop policy own_delete on public.ai_usage;
revoke insert, update, delete on public.ai_usage from authenticated;

-- Shuma e muajit para çdo thirrjeje (funksioni) dhe Cilësimet › AI.
create index ai_usage_month_idx on public.ai_usage (user_id, month);

-- Prova e RLS-it: supabase/tests/rls_isolation.sql (ai_usage), në një transaksion që kthehet mbrapsht:
--   psql "$DATABASE_URL" -f supabase/tests/rls_isolation.sql
-- Pritet failed = 0: A sheh rreshtin e vet, por nuk e shton, nuk e ndryshon dhe nuk e fshin; B nuk e sheh;
-- anon nuk sheh asgjë.
