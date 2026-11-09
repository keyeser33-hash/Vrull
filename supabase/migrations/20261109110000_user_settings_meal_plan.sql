-- Plani i vakteve të përdoruesit (V35, V2-E2-06): vaktet e hequra dhe orët e lëvizura, nga `from`;
-- `previous` mban planin e ditëve para saj. Pa të, orari i parazgjedhur i §9.
alter table public.user_settings
  add column meal_plan jsonb check (meal_plan is null or jsonb_typeof(meal_plan) = 'object');
