-- Suplementet e mia (V39, V2-E2-10): lloji, gramët e një luge, makrot për një lugë dhe "Numëroje te
-- ushqimi" për pluhurat e proteinës; njësia e re "tabletë". Leximi i etiketës me AI shkruan koston te
-- ai_usage me veçorinë e re supplement_label. Vetëm shtesë: rreshtat ekzistues mbeten të vlefshëm.
alter table public.supplements
  add column kind text check (kind in ('protein', 'creatine', 'capsule', 'other')),
  add column scoop_g numeric(5, 1) check (scoop_g > 0 and scoop_g <= 200),
  add column kcal numeric(6, 1) check (kcal >= 0 and kcal <= 2000),
  add column protein_g numeric(5, 1) check (protein_g >= 0 and protein_g <= 200),
  add column carbs_g numeric(5, 1) check (carbs_g >= 0 and carbs_g <= 200),
  add column fat_g numeric(5, 1) check (fat_g >= 0 and fat_g <= 200),
  add column counts_as_food boolean not null default false;

alter table public.supplements drop constraint supplements_dose_unit_check;
alter table public.supplements
  add constraint supplements_dose_unit_check check (dose_unit in ('g', 'mg', 'scoop', 'dose', 'piece', 'capsule', 'tablet'));

alter table public.ai_usage drop constraint ai_usage_feature_check;
alter table public.ai_usage
  add constraint ai_usage_feature_check check (feature in ('program_pdf', 'food_photo', 'food_text', 'explain', 'supplement_label'));
