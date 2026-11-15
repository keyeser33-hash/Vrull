-- 0.42 (V2-E3-27; SPEC V59, §0.3h, V31): Lista e Vrullit dhe produktet e grupit. Vetëm shtesë: asnjë tabelë
-- ekzistuese nuk ndryshon, dhe app-i 0.41 vazhdon të sinkronizojë.
--
-- 1. food_catalog_versions: një rresht për çdo Version të listës (v1, v2…). Telefoni krahason numrin e vet me
--    të fundit dhe merr vetëm rreshtat e ndryshuar pas tij.
-- 2. food_catalog: ushqimet e Listës së Vrullit (USDA, Ciqual, CoFID, Livsmedelsverket, Frida, pjatat
--    vendase), një rresht për ushqim, i njëjtë për të gjithë. Lexojnë përdoruesit e kyçur; shkruajnë vetëm
--    ndërtimi i listës (çelësi sekret, jo telefoni) dhe Admini (app_metadata.vrull_admin). Rreshtat "draft" dhe
--    "gati" i sheh vetëm Admini (V31).
-- 3. food_products: produktet me barkod të grupit, nga Open Food Facts (ODbL, të pandryshuara) ose nga etiketa.
--    Çdo përdorues i kyçur i lexon dhe shton; kush e shtoi ruhet (added_by) por nuk lexohet nga app-i.
--    Etiketa ndahet me grupin vetëm pasi përdoruesi e kontrollon (vlerësimi i AI-së mbetet në telefon).
--    Asnjë përdorues nuk ndryshon produktet, as ato të Open Food Facts; gabimet i rregullon Admini.

-- 1. Versionet e listës
create table public.food_catalog_versions (
  version int primary key check (version > 0),
  published_at timestamptz not null default now(),
  row_count int not null check (row_count >= 0),
  -- Çfarë ndryshoi: "Ciqual 2025, 3 484 ushqime" ose "Admini: 12 pjata".
  notes text check (char_length(notes) <= 500)
);
alter table public.food_catalog_versions enable row level security;
revoke all on public.food_catalog_versions from anon, authenticated;
grant select on public.food_catalog_versions to authenticated;
grant select, insert, update, delete on public.food_catalog_versions to service_role;
create policy read_all on public.food_catalog_versions for select to authenticated using (true);
create policy admin_write on public.food_catalog_versions for all to authenticated
  using (coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'vrull_admin')::boolean, false))
  with check (coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'vrull_admin')::boolean, false));
grant insert, update on public.food_catalog_versions to authenticated;

-- 2. Lista e Vrullit
create table public.food_catalog (
  -- ID e qëndrueshme: "usda-fdc-171077", "ciqual-13050", "vrull-byrek-me-spinaq".
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{2,79}$'),
  source text not null check (source in (
    'usda_foundation', 'usda_sr_legacy', 'usda_fndds', 'ciqual', 'cofid', 'livsmedelsverket', 'frida', 'vrull_recipe'
  )),
  source_id text not null check (char_length(source_id) between 1 and 80),
  license text not null check (license in ('CC0-1.0', 'etalab-2.0', 'OGL-3.0', 'CC-BY-4.0', 'vrull')),
  name_en text not null check (char_length(name_en) between 1 and 200),
  -- Emri në gjuhën e burimit (frëngjisht, suedisht, danisht), kur nuk është anglisht.
  name_source text check (char_length(name_source) <= 300),
  name_sq text check (char_length(name_sq) <= 200),
  -- false = përkthim i pakontrolluar (SPEC §0.3h); Admini e kthen true.
  name_sq_checked boolean not null default false,
  food_group text check (char_length(food_group) <= 80),
  -- Për 100 g pjesë të ngrënshme. Deri në 950 kcal: USDA ka yndyra me 902 kcal (rrumbullakimi i faktorëve).
  kcal numeric(6, 1) not null check (kcal between 0 and 950),
  protein_g numeric(5, 1) not null check (protein_g between 0 and 100),
  -- Karbohidratet pa fibrat, si te etiketat në BE (V61). computed: USDA ("by difference") me fibrat e zbritura;
  -- includes_fiber: USDA pa fibra të njohura, ndaj vlera i përfshin; bosh: vlera e burimit, pa fibrat.
  carbs_g numeric(5, 1) not null check (carbs_g between 0 and 100),
  carbs_note text check (carbs_note in ('computed', 'includes_fiber')),
  fat_g numeric(5, 1) not null check (fat_g between 0 and 100),
  fiber_g numeric(5, 1) check (fiber_g between 0 and 100),
  -- [{"label_en": "1 cup", "label_sq": "1 gotë", "grams": 240}]
  portions jsonb not null default '[]'::jsonb check (jsonb_typeof(portions) = 'array'),
  -- Vetëm pjatat vendase: [{"id": "usda-fdc-...", "grams": 120}] dhe ku u mor receta.
  ingredients jsonb check (ingredients is null or jsonb_typeof(ingredients) = 'array'),
  recipe_source text check (char_length(recipe_source) <= 500),
  -- Burimet e tjera ku del i njëjti ushqim ("edhe te"), sipas ID-ve të tyre.
  also_in text[] not null default '{}',
  -- Radha e të zakonshmeve (1 = më i zakonshmi); bosh = pa radhë.
  common_rank int check (common_rank > 0),
  status text not null default 'publikuar' check (status in ('draft', 'gati', 'publikuar')),
  list_version int not null references public.food_catalog_versions (version),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (source, source_id),
  check (source <> 'vrull_recipe' or (ingredients is not null and recipe_source is not null))
);
-- Telefoni merr ndryshimet pas versionit të vet.
create index food_catalog_version_idx on public.food_catalog (list_version);

alter table public.food_catalog enable row level security;
revoke all on public.food_catalog from anon, authenticated;
grant select, insert, update on public.food_catalog to authenticated;
grant select, insert, update, delete on public.food_catalog to service_role;
create policy read_published on public.food_catalog for select to authenticated
  using (status = 'publikuar' or coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'vrull_admin')::boolean, false));
create policy admin_insert on public.food_catalog for insert to authenticated
  with check (coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'vrull_admin')::boolean, false));
create policy admin_update on public.food_catalog for update to authenticated
  using (coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'vrull_admin')::boolean, false))
  with check (coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'vrull_admin')::boolean, false));
-- Fshirja është deleted_at (që telefoni ta marrë me versionin), jo delete.

-- 3. Produktet e grupit
create table public.food_products (
  id uuid primary key default gen_random_uuid(),
  barcode text not null check (barcode ~ '^[0-9]{6,14}$'),
  source text not null check (source in ('open_food_facts', 'label')),
  -- ODbL për Open Food Facts; bosh për etiketën.
  license text check (license is null or license = 'ODbL-1.0'),
  check ((source = 'open_food_facts') = (license is not null)),
  name text not null check (char_length(name) between 1 and 200),
  brand text check (char_length(brand) <= 120),
  kcal numeric(6, 1) not null check (kcal between 0 and 950),
  protein_g numeric(5, 1) not null check (protein_g between 0 and 100),
  carbs_g numeric(5, 1) not null check (carbs_g between 0 and 100),
  fat_g numeric(5, 1) not null check (fat_g between 0 and 100),
  fiber_g numeric(5, 1) check (fiber_g between 0 and 100),
  serving_g numeric(7, 1) check (serving_g > 0),
  serving_label text check (char_length(serving_label) <= 80),
  -- Open Food Facts: last_modified_t i produktit, për rifreskimin.
  off_modified_at timestamptz,
  -- Kush e shtoi: e vendos baza (auth.uid()), app-i nuk e shkruan dhe nuk e lexon.
  added_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now()
);
-- Një produkt i gjallë për barkod dhe burim.
create unique index food_products_barcode on public.food_products (barcode, source) where deleted_at is null;
create index food_products_sync_idx on public.food_products (server_updated_at);
create trigger sync_touch before insert or update on public.food_products
  for each row execute function private.sync_touch();

alter table public.food_products enable row level security;
revoke all on public.food_products from anon, authenticated;
-- Leximi dhe shtimi vetëm i kolonave pa added_by: app-i i zgjedh kolonat me emër (jo select('*')).
grant select (id, barcode, source, license, name, brand, kcal, protein_g, carbs_g, fat_g, fiber_g, serving_g,
  serving_label, off_modified_at, created_at, updated_at, deleted_at, server_updated_at)
  on public.food_products to authenticated;
grant insert (barcode, source, license, name, brand, kcal, protein_g, carbs_g, fat_g, fiber_g, serving_g,
  serving_label, off_modified_at) on public.food_products to authenticated;
-- Ndryshimi dhe fshirja (deleted_at): vetëm Admini.
grant update (name, brand, kcal, protein_g, carbs_g, fat_g, fiber_g, serving_g, serving_label, off_modified_at,
  deleted_at) on public.food_products to authenticated;
grant select, insert, update, delete on public.food_products to service_role;
create policy read_all on public.food_products for select to authenticated using (true);
create policy insert_signed_in on public.food_products for insert to authenticated
  with check ((select auth.uid()) is not null);
create policy admin_update on public.food_products for update to authenticated
  using (coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'vrull_admin')::boolean, false))
  with check (coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'vrull_admin')::boolean, false));

-- Kontrolli (pritet: 3 tabela me RLS aktive, 0 rreshta):
--   select relname, relrowsecurity from pg_class where relname in
--     ('food_catalog_versions', 'food_catalog', 'food_products');
-- Prova e RLS-it: supabase/tests/rls_isolation.sql (food_catalog, food_products), në një transaksion që
-- kthehet mbrapsht. Pritet: A dhe B lexojnë rreshtat "publikuar" dhe produktet; asnjëri nuk shkruan te lista;
-- asnjëri nuk ndryshon produktet dhe nuk lexon added_by; anon nuk sheh asgjë.

-- Prodhuar nga Claude (AI); rishikohet nga Andi
