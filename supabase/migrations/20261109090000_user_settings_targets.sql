-- Objektivat personale (V32, V2-E2-03, SPEC Shtojca C): të dhënat e kalkulatorit te cilësimet e
-- sinkronizuara. Të gjitha opsionale: pa gjininë, gjatësinë, aktivitetin dhe qëllimin, app-i mban
-- objektivat e Jimit. `targets_from`: data nga e cila vlejnë objektivat personale.
alter table public.user_settings
  add column sex text check (sex in ('male', 'female')),
  add column birth_year smallint check (birth_year between 1900 and 2100),
  add column height_cm numeric(4, 1) check (height_cm between 100 and 250),
  add column activity text check (activity in ('sedentary', 'light', 'standing', 'physical')),
  add column goal text check (goal in ('gain', 'maintain', 'lose')),
  add column rate_pct numeric(3, 2) check (rate_pct between 0 and 1),
  add column protein_g_per_kg numeric(3, 2) check (protein_g_per_kg between 1.6 and 2.4),
  add column fat_g_per_kg numeric(3, 2) check (fat_g_per_kg between 0.6 and 1.2),
  add column body_fat_pct numeric(3, 1) check (body_fat_pct between 3 and 60),
  add column maintenance_kcal smallint check (maintenance_kcal between 1000 and 6000),
  add column targets_from date;
