-- 0.28 (V2-E3-27, vala 5; SPEC V59, §0.3h): ushqimi i Listës së Vrullit që përdoruesi e shton te një vakt ruhet te `foods` e tij me
-- source = 'catalog' dhe source_id = ID e listës ("usda-fdc-171287", "ciqual-22000"). Vetëm shtesë: `check`-u i burimit lejon edhe 'catalog';
-- asnjë rresht ekzistues nuk ndryshon. Pa këtë migrim, sinkronizimi i një ushqimi të tillë refuzohet nga serveri (provohet përsëri më vonë, asgjë nuk humbet).
-- Lista vetë nuk dërgohet nga app-i: `food_catalog` mbetet vetëm për përditësimet e Adminit (V31).

alter table public.foods drop constraint foods_source_check;
alter table public.foods add constraint foods_source_check check (source in ('off', 'usda', 'custom', 'template', 'catalog'));

-- Kontrolli (pritet: një rresht me 'catalog' brenda):
--   select pg_get_constraintdef(oid) from pg_constraint where conname = 'foods_source_check';

-- Prodhuar nga Claude (AI); rishikohet nga Andi
